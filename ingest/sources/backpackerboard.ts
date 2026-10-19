// Backpacker Board (backpackerboard.co.nz).
// The owner states written permission to collect listings (2026-10-19); the public terms alone
// require it ("cannot be copied, republished or distributed without written permission").

import { decodeEntities } from '../../lib/text';
import type { RawJob, Source } from '../types';
import { fillFromDetail } from './detailjsonld';

const BASE = 'https://www.backpackerboard.co.nz/work_jobs/';

export function parseBackpackerList(html: string): { jobs: RawJob[]; lastPage: number } {
  const jobs: RawJob[] = [];
  const re = /<td class="jobtabletitle"><a href="(new-zealand-jobs(\d+)\.html)">([\s\S]*?)<\/a><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    jobs.push({
      sourceId: m[2],
      url: BASE + m[1],
      title: decodeEntities(m[3]).replace(/\s+/g, ' ').trim(),
      location: decodeEntities(m[4].replace(/<[^>]+>/g, '')).trim() || null,
    });
  }
  const pages = [...html.matchAll(/job_listings\.php\?page=(\d+)/g)].map((x) => Number(x[1]));
  return { jobs, lastPage: pages.length ? Math.max(...pages) : 1 };
}

export const backpackerboard: Source = {
  id: 'backpackerboard',
  name: 'Backpacker Board',
  homepage: 'https://www.backpackerboard.co.nz',
  enabled: true,
  kind: 'site',
  hosts: ['www.backpackerboard.co.nz', 'backpackerboard.co.nz'],
  async *fetchListings(ctx) {
    const all = new Map<string, RawJob>();
    let last = 1;
    for (let page = 1; page <= last && page <= 60; page++) {
      const r = await ctx.http.text(`${BASE}job_listings.php${page > 1 ? `?page=${page}` : ''}`);
      ctx.counters.pages++;
      const p = parseBackpackerList(r.text);
      if (!p.jobs.length) {
        if (page === 1) throw new Error(`backpackerboard: no listings on page 1 (HTTP ${r.status}, ${r.text.length} bytes)`);
        break;
      }
      for (const j of p.jobs) all.set(j.sourceId, j);
      last = Math.max(last, p.lastPage);
    }
    yield* await fillFromDetail(ctx, [...all.values()], 'backpackerboard');
  },
};
