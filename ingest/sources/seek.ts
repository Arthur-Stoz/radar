// Seek NZ (Tier A — the owner holds written permission to collect listings).
// Details come from the GraphQL endpoint the site itself uses (JSON, ~20x lighter than the job page).
// Method: the JSON search API that nz.seek.com's own frontend calls, partitioned so that every
// partition stays under the API's pagination cap; detail pages (window.SEEK_REDUX_DATA) only for
// new listings, within the run's detail budget.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RawJob, Source, SourceContext } from '../types';
import { BlockedError, pool } from '../http';

const API = 'https://nz.seek.com/api/jobsearch/v5/search';
const PAGE_SIZE = 100;
const CAP = 500; // partitions above this are split further

const REGIONS = [
  'All Auckland', 'All Bay of Plenty', 'All Canterbury', 'All Gisborne', "All Hawkes Bay", 'All Manawatu', 'All Marlborough',
  'All Northland', 'All Otago', 'All Southland', 'All Taranaki', 'All Tasman', 'All Waikato', 'All Wellington', 'All West Coast',
];

const CLASSIFICATIONS = [
  '1200', '6251', '6304', '1203', '1204', '7019', '6163', '1206', '6076', '6263', '6123', '1209', '6205', '1210', '1211',
  '1212', '6317', '6281', '1214', '1216', '6092', '6008', '6058', '1220', '6043', '6362', '1223', '6261', '6246', '1225',
];

const WORK_TYPES = ['242', '243', '244', '245'];

type Params = { where: string; classification?: string; worktype?: string };

function url(p: Params, page: number): string {
  const q = new URLSearchParams({ siteKey: 'NZ-Main', sortmode: 'ListedDate', pageSize: String(PAGE_SIZE), page: String(page), where: p.where });
  if (p.classification) q.set('classification', p.classification);
  if (p.worktype) q.set('worktype', p.worktype);
  return `${API}?${q}`;
}

function toRaw(d: any): RawJob {
  const loc = d.locations?.[0]?.label || null;
  const arrangements: string[] = (d.workArrangements?.data || []).map((a: any) => a?.label?.text).filter(Boolean);
  const cls = d.classifications?.[0];
  return {
    sourceId: String(d.id),
    url: `https://nz.seek.com/job/${d.id}`,
    title: d.title,
    company: d.companyName || d.advertiser?.description || null,
    companyLogo: d.branding?.serpLogoUrl || null,
    location: [loc, ...arrangements.filter((a) => a !== 'On-site')].filter(Boolean).join(' · ') || null,
    remote: arrangements.includes('Remote'),
    workTypes: d.workTypes || [],
    category: cls ? `${cls.classification?.description}${cls.subclassification ? ' › ' + cls.subclassification.description : ''}` : null,
    payText: d.salaryLabel || null,
    postedAt: d.listingDate || null,
    teaser: d.teaser || null,
    bullets: (d.bulletPoints || []).filter(Boolean),
  };
}

/** Pull the job object out of a detail page. */
export function parseSeekDetail(html: string): { description: string | null; expiresAt: string | null; payText: string | null } | null {
  const start = html.indexOf('window.SEEK_REDUX_DATA = ');
  if (start < 0) return null;
  const end = html.indexOf(';\n', start);
  try {
    const data = JSON.parse(html.slice(start + 'window.SEEK_REDUX_DATA = '.length, end));
    const job = data?.jobdetails?.result?.job;
    if (!job) return null;
    return {
      description: job.content2 || job.content || null,
      expiresAt: job.expiresAt?.dateTimeUtc || null,
      payText: job.salary?.label || null,
    };
  } catch {
    return null;
  }
}

const GQL = 'https://nz.seek.com/graphql';
const GQL_QUERY = 'query jobDetails($jobId: ID!) { jobDetails(id: $jobId) { job { id content(platform: WEB) expiresAt { dateTimeUtc } salary { label } products { branding { id cover { url } } } } } }';
const GQL_QUERY_BASIC = 'query jobDetails($jobId: ID!) { jobDetails(id: $jobId) { job { id content(platform: WEB) expiresAt { dateTimeUtc } salary { label } } } }';

// Branded Seek ads carry a cover photo. The brand id is the one in the listing's logo URL; the branding gateway
// answers /<brand>/jdpCover with a redirect to the cover (or 404 when the brand has none). Results are cached
// between runs in the DB (source_cache), so each brand is checked once a month at most.
const BRANDING = 'https://bx-branding-gateway.cloud.seek.com.au';
const COVER_KEY = (brand: string) => `seek-cover:${brand}`;
const COVER_TTL = 30 * 864e5;

export function seekBrandId(logoUrl: string | null | undefined): string | null {
  return /^https:\/\/bx-branding-gateway\.cloud\.seek\.com\.au\/([A-Za-z0-9.-]+)\//.exec(logoUrl || '')?.[1] ?? null;
}

async function checkCovers(ctx: SourceContext, batch: RawJob[]): Promise<void> {
  const jobsPerBrand = new Map<string, number>();
  for (const r of batch) {
    const b = seekBrandId(r.companyLogo);
    if (b) jobsPerBrand.set(b, (jobsPerBrand.get(b) || 0) + 1);
  }
  const stale = (b: string) => {
    const hit = ctx.cache.get(COVER_KEY(b));
    return !hit || Date.now() - Date.parse(hit.checkedAt) > COVER_TTL;
  };
  // Brands with the most jobs first.
  const todo = [...jobsPerBrand.entries()].filter(([b]) => stale(b)).sort((a, b) => b[1] - a[1]).map(([b]) => b).slice(0, Number(process.env.IMAGE_BUDGET || 1500));
  ctx.log(`seek: checking ${todo.length} brand covers (${jobsPerBrand.size} brands)`);
  let done = 0;
  await pool(todo, 2, async (b) => {
    if (Date.now() > ctx.stopAt) return;
    try {
      const res = await ctx.http.text(`${BRANDING}/${b}/jdpCover`, { redirect: 'manual', retries: 1, timeoutMs: 15_000 });
      if (res.status >= 300 && res.status < 400 && res.location) ctx.cache.set(COVER_KEY(b), new URL(res.location, BRANDING).href);
      else if (res.status === 404) ctx.cache.set(COVER_KEY(b), '');
      if (++done % 500 === 0) ctx.log(`seek: ${done}/${todo.length} brand covers checked`);
    } catch {
      // try again next run
    }
  });
}

/** Job details through the JSON endpoint Seek's own frontend uses; falls back to the job page. */
export async function fetchSeekDetail(ctx: SourceContext, r: RawJob): Promise<ReturnType<typeof parseSeekDetail>> {
  try {
    for (const query of [GQL_QUERY, GQL_QUERY_BASIC]) {
      const res = await ctx.http.text(GQL, {
        method: 'POST',
        body: JSON.stringify({ operationName: 'jobDetails', variables: { jobId: r.sourceId }, query }),
        headers: { 'content-type': 'application/json', accept: 'application/json', 'seek-request-brand': 'seek', 'seek-request-country': 'NZ' },
      });
      if (res.status !== 200) break;
      const body = JSON.parse(res.text);
      // A schema change in the optional branding fields must not cost us the description: retry without them.
      if (body?.errors?.length && !body?.data?.jobDetails && query === GQL_QUERY) continue;
      const job = body?.data?.jobDetails?.job;
      if (!job) return null; // listing gone
      const branding = job.products?.branding;
      if (branding?.id) ctx.cache.set(COVER_KEY(branding.id), branding.cover?.url || '');
      return { description: job.content || null, expiresAt: job.expiresAt?.dateTimeUtc || null, payText: job.salary?.label || null };
    }
  } catch (e) {
    if (e instanceof BlockedError) throw e;
  }
  const page = await ctx.http.text(r.url);
  if (page.status === 404 || page.status === 410) return null;
  return parseSeekDetail(page.text);
}

async function* walk(ctx: SourceContext, p: Params, seen: Set<string>, depth: number): AsyncGenerator<RawJob> {
  const first = await ctx.http.json<any>(url(p, 1));
  ctx.counters.pages++;
  const total: number = first.totalCount ?? 0;
  if (!total) return;
  if (total > CAP) {
    const children: Params[] =
      depth === 0 ? REGIONS.map((where) => ({ ...p, where }))
      : depth === 1 ? CLASSIFICATIONS.map((classification) => ({ ...p, classification }))
      : depth === 2 ? WORK_TYPES.map((worktype) => ({ ...p, worktype }))
      : [];
    if (children.length) {
      for (const c of children) yield* walk(ctx, c, seen, depth + 1);
      return;
    }
    ctx.log(`seek: partition still over cap (${total}) ${JSON.stringify(p)}; taking what pagination allows`);
  }
  let page = 1;
  let data: any[] = first.data || [];
  while (data.length) {
    for (const d of data) {
      const id = String(d.id);
      if (seen.has(id)) continue;
      seen.add(id);
      yield toRaw(d);
    }
    if (page * PAGE_SIZE >= total) break;
    page++;
    const next = await ctx.http.json<any>(url(p, page));
    ctx.counters.pages++;
    data = next.data || [];
  }
}

export const seek: Source = {
  id: 'seek',
  name: 'Seek',
  homepage: 'https://www.seek.co.nz',
  enabled: true,
  kind: 'site',
  hosts: ['nz.seek.com', 'www.seek.co.nz', 'seek.co.nz'],
  async *fetchListings(ctx) {
    const seen = new Set<string>();
    const batch: RawJob[] = [];
    for await (const raw of walk(ctx, { where: 'All New Zealand' }, seen, 0)) batch.push(raw);
    ctx.log(`seek: ${batch.length} listings from search`);

    // Detail pages: reuse the previous run's description; fetch only new listings within budget.
    const need: RawJob[] = [];
    for (const r of batch) {
      const prev = ctx.previous(r.sourceId);
      if (prev?.hasDetail) {
        r.description = prev.description;
        r.hasDetail = true;
        if (prev.expiresAt) r.expiresAt = prev.expiresAt;
      } else need.push(r);
    }
    // Newest first so fresh jobs get full descriptions.
    need.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
    const todo = need.filter(() => ctx.takeDetail());
    ctx.log(`seek: fetching ${todo.length} detail pages (${need.length - todo.length} deferred)`);
    let blockedInARow = 0;
    const covers = checkCovers(ctx, batch);
    await pool(todo, 2, async (r) => {
      if (blockedInARow >= 5) return; // circuit breaker: the site is refusing us, stop asking this run
      try {
        const d = await fetchSeekDetail(ctx, r);
        ctx.counters.details++;
        blockedInARow = 0;
        if (ctx.counters.details % 250 === 0) ctx.log(`seek: ${ctx.counters.details}/${todo.length} details`);
        if (!d) return;
        if (d.description) {
          r.descriptionHtml = d.description;
          r.hasDetail = true;
        }
        if (d.expiresAt) r.expiresAt = d.expiresAt;
        if (!r.payText && d.payText) r.payText = d.payText;
      } catch (e) {
        ctx.counters.errors++;
        if (e instanceof BlockedError && ++blockedInARow === 5) ctx.log('seek: details blocked 5 times in a row; skipping the rest this run');
        else if (!(e instanceof BlockedError)) ctx.log(`seek: detail failed ${r.url}: ${(e as Error).message}`);
      }
    });
    await covers;
    for (const r of batch) {
      const b = seekBrandId(r.companyLogo);
      const cover = b ? ctx.cache.get(COVER_KEY(b))?.value : null;
      if (cover) r.image = cover;
    }
    yield* batch;
  },
};
