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
const GQL_QUERY = 'query jobDetails($jobId: ID!) { jobDetails(id: $jobId) { job { id content(platform: WEB) expiresAt { dateTimeUtc } salary { label } } } }';

/** Job details through the JSON endpoint Seek's own frontend uses; falls back to the job page. */
export async function fetchSeekDetail(ctx: SourceContext, r: RawJob): Promise<ReturnType<typeof parseSeekDetail>> {
  try {
    const res = await ctx.http.text(GQL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'jobDetails', variables: { jobId: r.sourceId }, query: GQL_QUERY }),
      headers: { 'content-type': 'application/json', accept: 'application/json', 'seek-request-brand': 'seek', 'seek-request-country': 'NZ' },
    });
    if (res.status === 200) {
      const job = JSON.parse(res.text)?.data?.jobDetails?.job;
      if (job) return { description: job.content || null, expiresAt: job.expiresAt?.dateTimeUtc || null, payText: job.salary?.label || null };
      return null; // listing gone
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
    yield* batch;
  },
};
