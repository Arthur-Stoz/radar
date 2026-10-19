// Public ATS job boards (Greenhouse, Lever, SmartRecruiters, Workable, Ashby).
// All five publish documented, key-less JSON endpoints meant for embedding job boards on
// company career pages. Companies are listed in ingest/ats-companies.json; only NZ jobs are kept.

/* eslint-disable @typescript-eslint/no-explicit-any */
import companies from '../ats-companies.json';
import { pool } from '../http';
import type { RawJob, Source, SourceContext } from '../types';

type Company = { slug: string; name: string };
type AtsId = 'greenhouse' | 'lever' | 'smartrecruiters' | 'workable' | 'ashby';

const NZ_TEXT =
  /\b(new zealand|aotearoa|nz)\b|\b(auckland|wellington|christchurch|tauranga|dunedin|queenstown|whangarei|whangārei|napier|new plymouth|palmerston north|rotorua|invercargill|lower hutt|upper hutt|porirua|wanaka|wānaka|blenheim|timaru|whanganui|taupo|taupō)\b/i;

export function isNZLocation(text: string | null | undefined, country?: string | null): boolean {
  if (country) {
    const c = country.trim().toLowerCase();
    if (c === 'nz' || c === 'nzl' || c === 'new zealand') return true;
  }
  return NZ_TEXT.test(text || '');
}

const LEVER_INTERVAL: Record<string, RawJob['payPeriod']> = {
  'per-hour-wage': 'hour',
  'per-year-salary': 'year',
  'per-month-salary': 'month',
  'per-day-wage': 'day',
  'per-week-wage': 'week',
};

const companyList = (ats: AtsId): Company[] => ((companies as Record<string, unknown>)[ats] as Company[]) || [];

async function forCompanies(ctx: SourceContext, ats: AtsId, fn: (c: Company) => Promise<RawJob[]>): Promise<RawJob[]> {
  const out: RawJob[] = [];
  await pool(companyList(ats), 2, async (c) => {
    try {
      const jobs = await fn(c);
      out.push(...jobs);
      ctx.log(`${ats}/${c.slug}: ${jobs.length} NZ jobs`);
    } catch (e) {
      ctx.counters.errors++;
      ctx.log(`${ats}/${c.slug}: failed (${(e as Error).message})`);
    }
  });
  return out;
}

function make(id: AtsId, name: string, homepage: string, hosts: string[], fetchAll: (ctx: SourceContext) => Promise<RawJob[]>): Source {
  return {
    id,
    name,
    homepage,
    enabled: true,
    kind: 'ats',
    hosts,
    async *fetchListings(ctx) {
      yield* await fetchAll(ctx);
    },
  };
}

export const greenhouse = make('greenhouse', 'Greenhouse', 'https://www.greenhouse.com', ['boards.greenhouse.io', 'job-boards.greenhouse.io'], (ctx) =>
  forCompanies(ctx, 'greenhouse', async (c) => {
    const j = await ctx.http.json<any>(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`);
    ctx.counters.pages++;
    return (j.jobs || [])
      .filter((x: any) => isNZLocation([x.location?.name, ...(x.offices || []).map((o: any) => o.name)].join(' | ')))
      .map(
        (x: any): RawJob => ({
          sourceId: `${c.slug}-${x.id}`,
          url: x.absolute_url,
          title: x.title,
          company: c.name,
          location: x.location?.name || null,
          category: x.departments?.[0]?.name || null,
          postedAt: x.first_published || x.updated_at || null,
          descriptionHtml: x.content || null,
          hasDetail: true,
        }),
      );
  }),
);

export const lever = make('lever', 'Lever', 'https://www.lever.co', ['jobs.lever.co'], (ctx) =>
  forCompanies(ctx, 'lever', async (c) => {
    const j = await ctx.http.json<any[]>(`https://api.lever.co/v0/postings/${c.slug}?mode=json`);
    ctx.counters.pages++;
    return (j || [])
      .filter((x: any) => isNZLocation([x.categories?.location, ...(x.categories?.allLocations || [])].join(' | '), x.country))
      .map((x: any): RawJob => {
        const lists = (x.lists || []).map((l: any) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join('');
        const sr = x.salaryRange;
        return {
          sourceId: `${c.slug}-${x.id}`,
          url: x.hostedUrl,
          title: x.text,
          company: c.name,
          location: x.categories?.location || null,
          remote: x.workplaceType === 'remote',
          workTypes: [x.categories?.commitment],
          category: x.categories?.team || x.categories?.department || null,
          payMin: sr?.min ?? null,
          payMax: sr?.max ?? null,
          payPeriod: sr ? (LEVER_INTERVAL[sr.interval] ?? null) : null,
          postedAt: x.createdAt ? new Date(x.createdAt).toISOString() : null,
          descriptionHtml: [x.description, lists, x.additional].filter(Boolean).join(''),
          hasDetail: true,
        };
      });
  }),
);

export const smartrecruiters = make('smartrecruiters', 'SmartRecruiters', 'https://www.smartrecruiters.com', ['jobs.smartrecruiters.com'], (ctx) =>
  forCompanies(ctx, 'smartrecruiters', async (c) => {
    const items: any[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const j = await ctx.http.json<any>(`https://api.smartrecruiters.com/v1/companies/${c.slug}/postings?limit=100&offset=${offset}&country=nz`);
      ctx.counters.pages++;
      items.push(...(j.content || []));
      if (!j.content?.length || items.length >= (j.totalFound ?? 0)) break;
    }
    const nz = items.filter((x) => isNZLocation(x.location?.fullLocation || x.location?.city, x.location?.country));
    const out: RawJob[] = [];
    await pool(nz, 2, async (x) => {
      const raw: RawJob = {
        sourceId: `${c.slug}-${x.id}`,
        url: `https://jobs.smartrecruiters.com/${encodeURIComponent(x.company?.identifier || c.slug)}/${x.id}`,
        title: x.name,
        company: x.company?.name || c.name,
        location: x.location?.fullLocation || [x.location?.city, x.location?.region].filter(Boolean).join(', '),
        remote: !!x.location?.remote,
        workTypes: [x.typeOfEmployment?.label],
        category: x.department?.label || x.function?.label || null,
        postedAt: x.releasedDate || null,
      };
      const prev = ctx.previous(raw.sourceId);
      if (prev?.hasDetail) {
        raw.description = prev.description;
        raw.hasDetail = true;
      } else if (ctx.takeDetail()) {
        try {
          const d = await ctx.http.json<any>(`https://api.smartrecruiters.com/v1/companies/${c.slug}/postings/${x.id}`);
          ctx.counters.details++;
          const s = d.jobAd?.sections || {};
          raw.descriptionHtml = [s.jobDescription?.text, s.qualifications?.text, s.additionalInformation?.text, s.companyDescription?.text]
            .filter(Boolean)
            .join('');
          raw.hasDetail = !!raw.descriptionHtml;
          if (d.postingUrl) raw.url = d.postingUrl;
        } catch {
          ctx.counters.errors++;
        }
      }
      out.push(raw);
    });
    return out;
  }),
);

export const workable = make('workable', 'Workable', 'https://www.workable.com', ['apply.workable.com'], (ctx) =>
  forCompanies(ctx, 'workable', async (c) => {
    const j = await ctx.http.json<any>(`https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`);
    ctx.counters.pages++;
    return (j.jobs || [])
      .filter((x: any) =>
        isNZLocation(
          [x.city, x.state, x.country, ...(x.locations || []).map((l: any) => `${l.city} ${l.country}`)].join(' | '),
          x.countryCode || x.locations?.[0]?.countryCode,
        ),
      )
      .map(
        (x: any): RawJob => ({
          sourceId: `${c.slug}-${x.shortcode}`,
          url: x.url || x.shortlink || `https://apply.workable.com/${c.slug}/j/${x.shortcode}/`,
          title: x.title,
          company: j.name || c.name,
          location: [x.city, x.state].filter(Boolean).join(', ') || x.country,
          remote: !!x.telecommuting,
          workTypes: [x.employment_type],
          category: x.department || x.function || null,
          postedAt: x.published_on || x.created_at || null,
          descriptionHtml: x.description || null,
          hasDetail: !!x.description,
        }),
      );
  }),
);

export const ashby = make('ashby', 'Ashby', 'https://www.ashbyhq.com', ['jobs.ashbyhq.com'], (ctx) =>
  forCompanies(ctx, 'ashby', async (c) => {
    const j = await ctx.http.json<any>(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`);
    ctx.counters.pages++;
    return (j.jobs || [])
      .filter((x: any) => x.isListed !== false)
      .filter((x: any) =>
        isNZLocation([x.location, ...(x.secondaryLocations || []).map((l: any) => l.location)].join(' | '), x.address?.postalAddress?.addressCountry),
      )
      .map((x: any): RawJob => {
        const locs: string[] = [x.location, ...(x.secondaryLocations || []).map((l: any) => l.location)].filter(Boolean);
        return {
          sourceId: `${c.slug}-${x.id}`,
          url: x.jobUrl,
          title: x.title,
          company: c.name,
          location: locs.find((l) => isNZLocation(l)) || x.location,
          remote: !!x.isRemote || x.workplaceType === 'Remote',
          workTypes: [x.employmentType],
          category: x.department || x.team || null,
          payText: x.compensation?.compensationTierSummary || x.compensation?.scrapeableCompensationSalarySummary || null,
          postedAt: x.publishedAt || null,
          descriptionHtml: x.descriptionHtml || null,
          hasDetail: !!x.descriptionHtml,
        };
      });
  }),
);
