import { pool } from '../http';
import { findJobPostings, jobPostingToRaw } from '../jsonld';
import type { RawJob, SourceContext } from '../types';

export type DetailParser = (html: string, listing: RawJob) => Partial<RawJob> | null;

/** Default parser: the page's schema.org JobPosting JSON-LD. */
export const jsonLdParser: DetailParser = (html) => {
  const jp = findJobPostings(html)[0];
  return jp ? jobPostingToRaw(jp) : null;
};

/**
 * Fill listings from their detail pages (new listings only, within the run's detail budget).
 * Listings already detailed in the previous run are rebuilt from the stored raw listing.
 */
export async function fillFromDetail(
  ctx: SourceContext,
  list: RawJob[],
  tag: string,
  opts: {
    userAgent?: string;
    parse?: DetailParser;
    /** Company logo shown on the page (absolute URL), when the site has one per employer. */
    logo?: (html: string, url: string) => string | null;
  } = {},
): Promise<RawJob[]> {
  const parse = opts.parse ?? jsonLdParser;
  const keep: RawJob[] = [];
  const need: RawJob[] = [];
  for (const r of list) {
    const prev = ctx.previous(r.sourceId);
    // Listings stored before pictures were collected are read once more when the site shows a logo.
    if (prev?.hasDetail && prev.raw && (prev.raw.imageChecked || !opts.logo)) {
      keep.push({ ...prev.raw, ...stripEmpty(r), description: prev.description, hasDetail: true });
    } else need.push(r);
  }
  const todo = need.filter(() => ctx.takeDetail());
  ctx.log(`${tag}: fetching ${todo.length} detail pages (${need.length - todo.length} deferred)`);
  await pool(todo, 2, async (r) => {
    try {
      const res = await ctx.http.text(r.url, { userAgent: opts.userAgent });
      ctx.counters.details++;
      if (res.status >= 400) {
        (r as RawJob & { gone?: boolean }).gone = res.status === 404 || res.status === 410;
        return;
      }
      const d = parse(res.text, r);
      if (!d) return;
      d.imageChecked = true;
      const logo = opts.logo?.(res.text, r.url);
      if (logo) d.companyLogo = logo;
      for (const [k, v] of Object.entries(d)) {
        const key = k as keyof RawJob;
        if (v != null && v !== '' && !(Array.isArray(v) && !v.length) && (r[key] == null || r[key] === '' || key === 'descriptionHtml'))
          (r as unknown as Record<string, unknown>)[key] = v;
      }
    } catch (e) {
      ctx.counters.errors++;
      ctx.log(`${tag}: detail failed ${r.url}: ${(e as Error).message}`);
    }
  });
  // Deferred listings go out with what we know; pages that answered 404/410 are dropped.
  return [...keep, ...need.filter((r) => !(r as RawJob & { gone?: boolean }).gone)];
}

/** @deprecated name kept for older connectors. */
export const fillFromJsonLd = (ctx: SourceContext, list: RawJob[], tag: string, opts: { userAgent?: string } = {}) => fillFromDetail(ctx, list, tag, opts);

function stripEmpty(r: RawJob): Partial<RawJob> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v != null && v !== '') out[k] = v;
  return out as Partial<RawJob>;
}
