// PickNZ jobs board (jobs.picknz.co.nz, run by Horticulture NZ).
// The owner states written permission to collect listings (2026-10-19); the public terms alone
// forbid reuse without prior written permission. Method: job-sitemap.xml + JobPosting JSON-LD.

import type { RawJob, Source } from '../types';
import { fillFromDetail } from './detailjsonld';

export function parseSitemap(xml: string): { loc: string; lastmod: string | null }[] {
  const out: { loc: string; lastmod: string | null }[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1]?.trim();
    if (loc) out.push({ loc, lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1] ?? null });
  }
  return out;
}

/** The employer logo WP Job Board shows on the job page (not the PickNZ site logo). */
export function picknzLogo(html: string): string | null {
  return /<img[^>]+src=["'](https:\/\/jobs\.picknz\.co\.nz\/wp-content\/uploads\/wpjobboard\/job\/\d+\/company-logo\/[^"']+)["']/i.exec(html)?.[1] ?? null;
}

export const picknz: Source = {
  id: 'picknz',
  name: 'PickNZ',
  homepage: 'https://www.picknz.co.nz',
  enabled: true,
  kind: 'site',
  hosts: ['jobs.picknz.co.nz', 'www.picknz.co.nz'],
  async *fetchListings(ctx) {
    const r = await ctx.http.text('https://jobs.picknz.co.nz/job-sitemap.xml', { conditional: true });
    ctx.counters.pages++;
    const cutoff = ctx.now.getTime() - 120 * 864e5;
    const urls = parseSitemap(r.text).filter((u) => /\/job\//.test(u.loc) && (!u.lastmod || Date.parse(u.lastmod) > cutoff));
    const list: RawJob[] = urls.map((u) => ({ sourceId: u.loc.replace(/\/$/, '').split('/').pop()!, url: u.loc, title: '' }));
    const filled = await fillFromDetail(ctx, list, 'picknz', { logo: picknzLogo });
    for (const j of filled) {
      if (!j.title) continue;
      if (j.expiresAt && Date.parse(j.expiresAt) < ctx.now.getTime()) continue;
      yield j;
    }
  },
};
