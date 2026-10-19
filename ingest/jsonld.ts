import { decodeEntities } from '../lib/text';
import type { RawJob } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Extract every JSON-LD object of @type JobPosting from an HTML page. */
export function findJobPostings(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: any;
    const body = m[1].trim();
    try {
      data = JSON.parse(body);
    } catch {
      try {
        // Some sites put raw control characters inside strings.
        data = JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' '));
      } catch {
        continue;
      }
    }
    const stack = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const d = stack.pop();
      if (!d || typeof d !== 'object') continue;
      if (Array.isArray(d['@graph'])) stack.push(...d['@graph']);
      const t = d['@type'];
      if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) out.push(d);
    }
  }
  return out;
}

const str = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return decodeEntities(v).trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && v.name) return str(v.name);
  return null;
};

/** Map a schema.org JobPosting to RawJob fields (caller adds sourceId/url). */
export function jobPostingToRaw(jp: any): Omit<RawJob, 'sourceId' | 'url'> {
  const locs = Array.isArray(jp.jobLocation) ? jp.jobLocation : jp.jobLocation ? [jp.jobLocation] : [];
  const addr = locs[0]?.address || {};
  const locParts = [str(addr.addressLocality), str(addr.addressRegion)].filter(Boolean);
  let payText: string | null = null;
  let payMin: number | null = null;
  let payMax: number | null = null;
  let payPeriod: RawJob['payPeriod'] = null;
  const bs = jp.baseSalary;
  if (bs && typeof bs === 'object') {
    const v = bs.value || {};
    const unit = String(v.unitText || bs.unitText || '').toUpperCase();
    payPeriod = ({ HOUR: 'hour', DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' } as const)[unit as 'HOUR'] ?? null;
    const n = (x: any) => (x == null || x === '' ? null : Number(String(x).replace(/[^0-9.]/g, '')) || null);
    payMin = n(v.minValue ?? v.value);
    payMax = n(v.maxValue ?? v.value);
  } else if (typeof bs === 'string') payText = bs;
  if (!payText && typeof jp.jobBenefits === 'string' && /\$\s?\d/.test(jp.jobBenefits)) payText = jp.jobBenefits;
  if (!payText && typeof jp.salaryCurrency === 'string' && jp.estimatedSalary) payText = str(jp.estimatedSalary);
  const types = Array.isArray(jp.employmentType) ? jp.employmentType : jp.employmentType ? [jp.employmentType] : [];
  return {
    title: str(jp.title) || '',
    company: str(jp.hiringOrganization),
    companyLogo: typeof jp.hiringOrganization === 'object' ? str(jp.hiringOrganization.logo) : null,
    location: locParts.join(', ') || str(jp.jobLocation?.name) || null,
    remote: jp.jobLocationType === 'TELECOMMUTE',
    workTypes: types.map((t: any) => String(t).replace(/_/g, ' ')),
    category: str(jp.industry) || str(jp.occupationalCategory),
    payText,
    payMin,
    payMax,
    payPeriod,
    postedAt: str(jp.datePosted),
    expiresAt: str(jp.validThrough),
    descriptionHtml: typeof jp.description === 'string' ? decodeEntities(jp.description) : null,
    hasDetail: true,
  };
}
