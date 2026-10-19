// NZ Government Jobs — jobs.govt.nz (Te Kawa Mataaho Public Service Commission).
// Covers public service agencies and Te Whatu Ora / Health NZ. robots.txt allows the search
// and job pages. Method: paginated search results (form POST, 20 per page) + JobPosting JSON-LD
// on detail pages for new listings.

import { decodeEntities } from '../../lib/text';
import { pool } from '../http';
import { findJobPostings, jobPostingToRaw } from '../jsonld';
import type { RawJob, Source } from '../types';

const BASE = 'https://jobs.govt.nz';
const ORG = '16563';

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** "19-Oct-2026" → "2026-10-19" */
export function govDate(s: string | undefined): string | null {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s || '');
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}` : null;
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseGovResults(html: string): { total: number; jobs: RawJob[] } {
  const total = Number(/Results \d+ to \d+ of (\d+)/.exec(html)?.[1] || 0);
  const jobs: RawJob[] = [];
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const a = /<A HREF="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
    if (!a) continue;
    const href = decodeEntities(a[1]);
    const url = href.startsWith('http') ? href : href.startsWith('/') ? BASE + href : `${BASE}/jobtools/${href}`;
    const id = /in_jnCounter=(\d+)/i.exec(href)?.[1] || /\/jobs\/(?:[^/]+\/)?([^/?#]+)/.exec(href)?.[1];
    if (!id) continue;
    const employer = /<\/div><div>at ([\s\S]*?)<\/div>/i.exec(row)?.[1];
    const minSal = /class="minimum-sal">([^<]*)</i.exec(row)?.[1] || '';
    const maxSal = /class="maximum-sal">([^<]*)</i.exec(row)?.[1] || '';
    const hl = /class="highlight ([^"]*)"/i.exec(row)?.[1] || '';
    const loc = /class="job_location">([^<]*)</i.exec(row)?.[1] || '';
    const listed = /class="job_listed">([^<]*)</i.exec(row)?.[1];
    const closing = /class="job_closing">([^<]*)</i.exec(row)?.[1];
    const sal = [minSal, maxSal].filter((x) => /\$\d/.test(x));
    jobs.push({
      sourceId: id,
      url,
      title: clean(a[2]),
      company: employer ? clean(employer) : null,
      location: clean(loc) || null,
      workTypes: hl ? hl.split(' - ') : [],
      payText: sal.length ? sal.join(' - ') + (Number(sal[0].replace(/\D/g, '')) > 1000 ? ' per year' : '') : null,
      postedAt: govDate(listed),
      expiresAt: govDate(closing) ? `${govDate(closing)}T23:59:59+13:00` : null,
    });
  }
  return { total, jobs };
}

export const jobsgovt: Source = {
  id: 'jobsgovt',
  name: 'NZ Government Jobs',
  homepage: 'https://jobs.govt.nz',
  enabled: true,
  kind: 'site',
  hosts: ['jobs.govt.nz', 'www.jobs.govt.nz'],
  async *fetchListings(ctx) {
    const all = new Map<string, RawJob>();
    const first = await ctx.http.text(`${BASE}/jobtools/jncustomsearch.searchResults?in_organid=${ORG}&in_jobDate=All`);
    ctx.counters.pages++;
    const { total, jobs } = parseGovResults(first.text);
    for (const j of jobs) all.set(j.sourceId, j);
    for (let pg = 20; pg < total; pg += 20) {
      const r = await ctx.http.text(`${BASE}/jobtools/jncustomsearch.searchAction`, {
        body: `in_organid=${ORG}&in_jobDate=All&in_summary=S&in_totalrows=${total}&in_nav=next_set&in_pg=${pg}`,
      });
      ctx.counters.pages++;
      const page = parseGovResults(r.text);
      if (!page.jobs.length) break;
      for (const j of page.jobs) all.set(j.sourceId, j);
    }
    const list = [...all.values()];
    ctx.log(`jobsgovt: ${list.length}/${total} listings`);

    const need: RawJob[] = [];
    for (const r of list) {
      const prev = ctx.previous(r.sourceId);
      if (prev?.hasDetail) {
        r.description = prev.description;
        r.hasDetail = true;
      } else need.push(r);
    }
    need.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
    const todo = need.filter(() => ctx.takeDetail());
    ctx.log(`jobsgovt: fetching ${todo.length} detail pages (${need.length - todo.length} deferred)`);
    await pool(todo, 2, async (r) => {
      try {
        const res = await ctx.http.text(r.url);
        ctx.counters.details++;
        if (ctx.counters.details % 250 === 0) ctx.log(`jobsgovt: ${ctx.counters.details}/${todo.length} detail pages`);
        const jp = findJobPostings(res.text)[0];
        if (!jp) return;
        const d = jobPostingToRaw(jp);
        if (d.descriptionHtml) {
          r.descriptionHtml = d.descriptionHtml;
          r.hasDetail = true;
        }
        if (!r.company && d.company) r.company = d.company;
        if (!r.payText && (d.payText || d.payMin)) Object.assign(r, { payText: d.payText, payMin: d.payMin, payMax: d.payMax, payPeriod: d.payPeriod });
      } catch (e) {
        ctx.counters.errors++;
        ctx.log(`jobsgovt: detail failed ${r.url}: ${(e as Error).message}`);
      }
    });
    yield* list;
  },
};
