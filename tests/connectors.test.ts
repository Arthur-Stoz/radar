import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findJobPostings, jobPostingToRaw } from '@/ingest/jsonld';
import { normalize } from '@/ingest/normalize';
import { isNZLocation } from '@/ingest/sources/ats';
import { parseBackpackerList } from '@/ingest/sources/backpackerboard';
import { govDate, parseGovResults } from '@/ingest/sources/jobsgovt';
import { parseSeekDetail } from '@/ingest/sources/seek';
import { tmDate, trademeToRaw } from '@/ingest/sources/trademe';
import { parseSitemap } from '@/ingest/sources/picknz';

// Saved, trimmed real snapshots: CI never hits live sites (BUILD.md §9.2).
const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');
const now = new Date('2026-10-19T00:00:00Z');

describe('seek', () => {
  it('parses the job detail payload', () => {
    const d = parseSeekDetail(fx('seek-job.html'));
    expect(d?.description).toContain('About the role');
    expect(d?.expiresAt).toMatch(/^2026-11-18/);
  });
  it('search payload has the fields the connector relies on', () => {
    const j = JSON.parse(fx('seek-search.json'));
    for (const d of j.data) {
      expect(d.id).toBeTruthy();
      expect(d.title).toBeTruthy();
      expect(d.locations[0].label).toBeTruthy();
      expect(d.listingDate).toMatch(/^\d{4}-/);
    }
  });
});

describe('trademe', () => {
  const list = JSON.parse(fx('trademe-search.json')).List;
  it('maps listings to RawJob with full description', () => {
    const r = trademeToRaw(list[0]);
    expect(r.url).toBe(`https://www.trademe.co.nz/a/jobs/listing/${list[0].ListingId}`);
    expect(r.description!.length).toBeGreaterThan(100);
    expect(r.hasDetail).toBe(true);
    const j = normalize('trademe', r, now)!;
    expect(j.location.regionId).toBeTruthy();
    expect(j.workType.length).toBeGreaterThan(0);
  });
  it('reads pay transparency when present', () => {
    const r = trademeToRaw(list[0]);
    expect(r.payText).toMatch(/\$/);
    expect(normalize('trademe', r, now)!.pay.hourlyMin).not.toBeNull();
  });
  it('parses /Date()/', () => {
    expect(tmDate('/Date(1792380111023)/')).toMatch(/^2026-10-/);
    expect(tmDate('/Date(0)/')).toBeNull();
  });
});

describe('jobsgovt', () => {
  it('parses every row of a results page, both link styles', () => {
    const { total, jobs } = parseGovResults(fx('jobsgovt-results.html'));
    expect(total).toBeGreaterThan(1000);
    expect(jobs).toHaveLength(20);
    expect(jobs.every((j) => j.url.startsWith('https://jobs.govt.nz/'))).toBe(true);
    expect(jobs.some((j) => /HNZ-/.test(j.sourceId))).toBe(true);
    expect(jobs[0].payText).toMatch(/\$60,000/);
  });
  it('dates', () => expect(govDate('19-Oct-2026')).toBe('2026-10-19'));
  it('JobPosting JSON-LD on detail pages', () => {
    const jp = findJobPostings(fx('jobsgovt-job.html'))[0];
    expect(jobPostingToRaw(jp).descriptionHtml).toContain('Assessor');
  });
});

describe('disabled-but-built connectors', () => {
  it('backpacker board list', () => {
    const { jobs, lastPage } = parseBackpackerList(fx('backpackerboard-list.html'));
    expect(jobs.length).toBeGreaterThan(3);
    expect(lastPage).toBe(15);
    expect(jobs[0].url).toMatch(/new-zealand-jobs\d+\.html$/);
  });
  it('picknz JSON-LD', () => {
    const r = jobPostingToRaw(findJobPostings(fx('picknz-job.html'))[0]);
    expect(r.title).toBe('Chef');
    expect(r.company).toBe('Monavale Blueberries');
    expect(r.expiresAt).toBe('2027-01-13');
  });
  it('sitemaps', () => {
    expect(parseSitemap('<urlset><url><loc>https://x/job/a/</loc><lastmod>2026-10-01</lastmod></url></urlset>')).toEqual([{ loc: 'https://x/job/a/', lastmod: '2026-10-01' }]);
  });
});

describe('ats', () => {
  it('keeps only NZ locations', () => {
    expect(isNZLocation('Auckland, NZ')).toBe(true);
    expect(isNZLocation('NZ: Auckland: Xero 4')).toBe(true);
    expect(isNZLocation('Remote - New Zealand')).toBe(true);
    expect(isNZLocation('Hamilton, Ontario')).toBe(false);
    expect(isNZLocation('Remote - APAC')).toBe(false);
    expect(isNZLocation('Sydney', 'NZ')).toBe(true);
  });
});
