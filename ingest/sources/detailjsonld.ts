import { pool } from '../http';
import { findJobPostings, jobPostingToRaw } from '../jsonld';
import type { RawJob, SourceContext } from '../types';

/** Fill listings from JobPosting JSON-LD on their detail pages (new listings only, within budget). */
export async function fillFromJsonLd(ctx: SourceContext, list: RawJob[], tag: string, opts: { userAgent?: string } = {}): Promise<RawJob[]> {
  const keep: RawJob[] = [];
  const need: RawJob[] = [];
  for (const r of list) {
    const prev = ctx.previous(r.sourceId);
    if (prev?.hasDetail && prev.raw) {
      keep.push({ ...prev.raw, ...stripEmpty(r), description: prev.description, hasDetail: true });
    } else need.push(r);
  }
  const todo = need.filter(() => ctx.takeDetail());
  ctx.log(`${tag}: fetching ${todo.length} detail pages (${need.length - todo.length} deferred)`);
  await pool(todo, 2, async (r) => {
    try {
      const res = await ctx.http.text(r.url, { userAgent: opts.userAgent });
      ctx.counters.details++;
      if (res.status >= 400) return;
      const jp = findJobPostings(res.text)[0];
      if (!jp) return;
      const d = jobPostingToRaw(jp);
      for (const [k, v] of Object.entries(d)) {
        const key = k as keyof RawJob;
        if (v != null && v !== '' && !(Array.isArray(v) && !v.length) && (r[key] == null || key === 'descriptionHtml')) (r as unknown as Record<string, unknown>)[key] = v;
      }
    } catch (e) {
      ctx.counters.errors++;
      ctx.log(`${tag}: detail failed ${r.url}: ${(e as Error).message}`);
    }
  });
  // Listings whose detail is deferred still go out with what the list page gave us.
  return [...keep, ...need];
}

function stripEmpty(r: RawJob): Partial<RawJob> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v != null && v !== '') out[k] = v;
  return out as Partial<RawJob>;
}
