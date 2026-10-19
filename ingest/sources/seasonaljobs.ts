// SeasonalJobs NZ (seasonaljobs.co.nz)
// The owner states written permission to collect listings (2026-10-19). Method: sitemap.xml
// (job URLs look like /309/Housekeepers) + the job detail page HTML (no JSON-LD on this site).

import { decodeEntities } from '../../lib/text';
import type { RawJob, Source } from '../types';
import { fillFromDetail, type DetailParser } from './detailjsonld';
import { parseSitemap } from './picknz';

const clean = (s: string | undefined) => (s ? decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '');

/** "2 days ago" / "3 weeks ago" / "today" → ISO date (approximate, relative to now). */
export function relativeDate(s: string, now: Date): string | null {
  const t = s.toLowerCase();
  if (/today|just now|hours? ago|minutes? ago/.test(t)) return now.toISOString();
  if (/yesterday/.test(t)) return new Date(now.getTime() - 864e5).toISOString();
  const m = /(\d+)\s*(day|week|month)s?\s+ago/.exec(t);
  if (!m) return null;
  const days = Number(m[1]) * ({ day: 1, week: 7, month: 30 } as const)[m[2] as 'day'];
  return new Date(now.getTime() - days * 864e5).toISOString();
}

export function parseSeasonalJob(html: string, now = new Date()): Partial<RawJob> | null {
  const i = html.indexOf('card-body-custom');
  if (i < 0) return null;
  const card = html.slice(i, i + 40000);
  const title = clean(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(card)?.[1]);
  if (!title) return null;
  const head = /<div class="mt-2 mb-4">([\s\S]*?)<\/div>/.exec(card)?.[1] || '';
  const spans = [...head.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => clean(m[1])).filter(Boolean);
  const rows = [...card.matchAll(/<div class="row mb-1">([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => clean(m[1].replace(/<!--[\s\S]*?-->/g, '')));
  const posted = rows.find((r) => /^Posted:/i.test(r))?.replace(/^Posted:\s*/i, '') || '';
  const salary = rows.find((r) => /\$|negotiable|per hour|hourly|salary/i.test(r)) || null;
  const jobType = rows.find((r) => /full|part|casual|temporary|contract|seasonal|permanent/i.test(r)) || null;
  const knownRows = new Set([salary, jobType, rows.find((r) => /^Posted:/i.test(r)), rows.find((r) => /experience/i.test(r))]);
  const category = rows.find((r) => !knownRows.has(r)) || null;
  const summary = clean(/Job Summary<\/h3>\s*<div class="card-text">([\s\S]*?)<\/div>/.exec(card)?.[1]);
  const description = /Job Description<\/h3>\s*<div class="card-text">([\s\S]*?)<\/div>\s*<h3/.exec(card)?.[1] || '';
  const location = spans[1] ? spans[1].replace(/,\s*New Zealand$/i, '') : null;
  return {
    title,
    company: spans[0] || null,
    location,
    payText: salary && /\$\s?\d/.test(salary) ? salary : null,
    workTypes: jobType ? [jobType] : [],
    category,
    postedAt: relativeDate(posted, now),
    teaser: summary || null,
    descriptionHtml: description || null,
    hasDetail: !!description,
  };
}

const parser: DetailParser = (html) => parseSeasonalJob(html);

export const seasonaljobs: Source = {
  id: 'seasonaljobs',
  name: 'SeasonalJobs NZ',
  homepage: 'https://seasonaljobs.co.nz',
  enabled: true,
  kind: 'site',
  hosts: ['seasonaljobs.co.nz', 'www.seasonaljobs.co.nz'],
  async *fetchListings(ctx) {
    const r = await ctx.http.text('https://seasonaljobs.co.nz/sitemap.xml', { conditional: true });
    ctx.counters.pages++;
    const urls = parseSitemap(r.text).filter((u) => /^https:\/\/seasonaljobs\.co\.nz\/\d+\/[^/?#]+$/.test(u.loc));
    const list: RawJob[] = urls.map((u) => ({ sourceId: u.loc.split('/')[3], url: u.loc, title: '' }));
    ctx.log(`seasonaljobs: ${list.length} job URLs in sitemap`);
    for (const j of await fillFromDetail(ctx, list, 'seasonaljobs', { parse: parser })) if (j.title) yield j;
  },
};
