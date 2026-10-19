// jobs.co.nz
// The owner states written permission to collect listings (2026-10-19); the public terms alone
// forbid automated collection. Method: sitemap.xml (every live job URL) + JobPosting JSON-LD on
// detail pages for new listings.

import type { RawJob, Source } from '../types';
import { fillFromDetail } from './detailjsonld';
import { parseSitemap } from './picknz';

export const jobsconz: Source = {
  id: 'jobsconz',
  name: 'jobs.co.nz',
  homepage: 'https://jobs.co.nz',
  enabled: true,
  kind: 'site',
  hosts: ['jobs.co.nz', 'www.jobs.co.nz'],
  async *fetchListings(ctx) {
    const r = await ctx.http.text('https://jobs.co.nz/sitemap.xml', { conditional: true });
    ctx.counters.pages++;
    const urls = parseSitemap(r.text).filter((u) => /^https:\/\/jobs\.co\.nz\/jobs\/[^/?#]+$/.test(u.loc));
    const list: RawJob[] = urls.map((u) => ({ sourceId: u.loc.split('/').pop()!, url: u.loc, title: '' }));
    ctx.log(`jobsconz: ${list.length} job URLs in sitemap`);
    for (const j of await fillFromDetail(ctx, list, 'jobsconz')) {
      if (!j.title) continue;
      if (j.expiresAt && Date.parse(j.expiresAt) < ctx.now.getTime()) continue;
      yield j;
    }
  },
};
