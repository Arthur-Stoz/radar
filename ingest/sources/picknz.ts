// PickNZ jobs board (jobs.picknz.co.nz, run by Horticulture NZ).
// DISABLED: robots.txt allows crawling, but the PickNZ terms forbid using, copying, storing or
// displaying site content "except with our prior written permission". The connector is complete
// (sitemap + JobPosting JSON-LD); enable it with ENABLED_SOURCES=picknz once permission is obtained.

import type { RawJob, Source } from '../types';
import { fillFromJsonLd } from './detailjsonld';

export function parseSitemap(xml: string): { loc: string; lastmod: string | null }[] {
  const out: { loc: string; lastmod: string | null }[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1]?.trim();
    if (loc) out.push({ loc, lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1] ?? null });
  }
  return out;
}

export const picknz: Source = {
  id: 'picknz',
  name: 'PickNZ',
  homepage: 'https://www.picknz.co.nz',
  enabled: false,
  kind: 'site',
  hosts: ['jobs.picknz.co.nz', 'www.picknz.co.nz'],
  async *fetchListings(ctx) {
    const r = await ctx.http.text('https://jobs.picknz.co.nz/job-sitemap.xml', { conditional: true });
    ctx.counters.pages++;
    const cutoff = ctx.now.getTime() - 120 * 864e5;
    const urls = parseSitemap(r.text).filter((u) => /\/job\//.test(u.loc) && (!u.lastmod || Date.parse(u.lastmod) > cutoff));
    const list: RawJob[] = urls.map((u) => ({ sourceId: u.loc.replace(/\/$/, '').split('/').pop()!, url: u.loc, title: '' }));
    const filled = await fillFromJsonLd(ctx, list, 'picknz');
    for (const j of filled) {
      if (!j.title) continue;
      if (j.expiresAt && Date.parse(j.expiresAt) < ctx.now.getTime()) continue;
      yield j;
    }
  },
};
