// Trade Me Jobs (Tier A — the owner holds written permission to collect listings).
// Method: the JSON search endpoint that trademe.co.nz's own frontend calls. It returns the full
// description (ExtendedBody), so no detail pages are needed: ~20 requests for the whole catalogue.
// If official API keys are provided later (TRADEME_CONSUMER_KEY / TRADEME_CONSUMER_SECRET),
// the same endpoint is called with OAuth 1.0a PLAINTEXT credentials instead of the frontend headers.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RawJob, Source } from '../types';

const API = 'https://api.trademe.co.nz/v1/search/jobs.json';
const ROWS = 500;

function headers(): Record<string, string> {
  const key = process.env.TRADEME_CONSUMER_KEY;
  const secret = process.env.TRADEME_CONSUMER_SECRET;
  if (key && secret) {
    return { authorization: `OAuth oauth_consumer_key="${key}", oauth_signature_method="PLAINTEXT", oauth_signature="${secret}&"` };
  }
  return { referer: 'https://www.trademe.co.nz/', origin: 'https://www.trademe.co.nz', 'x-trademe-uniqueclientid': 'radarnz' };
}

/** "/Date(1792380111023)/" → ISO */
export function tmDate(v: string | null | undefined): string | null {
  const m = /\/Date\((-?\d+)/.exec(v || '');
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? new Date(n).toISOString() : null;
}

const JOB_TYPE: Record<string, string> = { FT: 'Full time', PT: 'Part time', CA: 'Casual', CT: 'Contract', TP: 'Temporary' };
const CONTRACT: Record<string, string> = { CT: 'Contract', TEMP: 'Temporary', PER: '' };

function categoryFromPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const parts = p.split('/').filter(Boolean).slice(1).map((s) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));
  return parts.join(' › ') || null;
}

export function trademeToRaw(l: any): RawJob {
  const pay = l.JobsSalaryTransparency?.ApproximatePayRangeDisplay || null;
  const benefits: string | null = l.PayBenefits || null;
  const payText = pay || (benefits && /\$\s?\d/.test(benefits) ? benefits : null);
  const bullets: string[] = (l.AdditionalData?.BulletPoints || []).map((b: string) => b.trim()).filter(Boolean);
  if (benefits && !payText && !bullets.includes(benefits) && benefits.length < 120) bullets.push(benefits);
  return {
    sourceId: String(l.ListingId),
    url: `https://www.trademe.co.nz/a/jobs/listing/${l.ListingId}`,
    title: String(l.Title || '').trim(),
    company: l.Company || l.Agency?.Name || null,
    companyLogo: l.Branding?.LargeSquareLogo || l.Agency?.Logo || null,
    location: [l.Suburb && l.Suburb !== l.District ? l.Suburb : null, l.District, l.Region].filter(Boolean).join(', ') || l.JobLocation || null,
    region: l.Region || null,
    city: l.District || null,
    workTypes: [JOB_TYPE[l.JobType] ?? l.JobType, CONTRACT[l.ContractLength] ?? null],
    category: categoryFromPath(l.CategoryPath),
    payText,
    payPeriod: !payText ? null : /hour/i.test(String(l.PayType)) && !/annual|year|k\b/i.test(payText) ? 'hour' : null,
    postedAt: tmDate(l.StartDate),
    expiresAt: tmDate(l.EndDate),
    teaser: l.Body || null,
    description: [l.Body, l.ExtendedBody].filter(Boolean).join('\n\n') || null,
    bullets,
    hasDetail: true,
  };
}

export const trademe: Source = {
  id: 'trademe',
  name: 'Trade Me',
  homepage: 'https://www.trademe.co.nz/a/jobs',
  enabled: true,
  kind: 'site',
  hosts: ['www.trademe.co.nz', 'trademe.co.nz'],
  async *fetchListings(ctx) {
    let page = 1;
    let total = Infinity;
    let got = 0;
    while (got < total) {
      const j = await ctx.http.json<any>(`${API}?page=${page}&rows=${ROWS}&sort_order=ExpiryDesc`, { headers: headers() });
      ctx.counters.pages++;
      total = j.TotalCount ?? 0;
      const list: any[] = j.List || [];
      if (!list.length) break;
      for (const l of list) yield trademeToRaw(l);
      got += list.length;
      page++;
      if (page > 100) break;
    }
    ctx.log(`trademe: ${got}/${total} listings`);
  },
};
