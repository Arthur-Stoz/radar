import { slugText } from '../lib/text';
import { similarity, trigrams } from '../lib/trigram';

export { similarity, trigrams };
import type { Job } from './normalize';

// Cross-source dedup (BUILD.md §4.2): same normalized title + company + city, or trigram
// similarity ≥ 0.85 on title+company in the same city within 30 days → one canonical job.

const COMPANY_NOISE = /\b(limited|ltd|nz|new zealand|the|group|co|company|inc|pty|holdings|services|aotearoa)\b/g;

export const normTitle = (t: string) => slugText(t).replace(/\b(urgent|immediate start|nz|new zealand|wanted|required|needed|hiring)\b/g, ' ').replace(/\s+/g, ' ').trim();
export const normCompany = (c: string | null) => slugText(c || '').replace(COMPANY_NOISE, ' ').replace(/\s+/g, ' ').trim();


function richness(j: Job): number {
  let s = 0;
  if (j.hasDetail) s += 3;
  if (j.pay.min != null) s += 2;
  s += Math.min(j.description.length, 4000) / 2000;
  if (j.highlights.length) s += 0.5;
  if (j.company) s += 0.5;
  if (j.location.city) s += 0.5;
  return s;
}

const DAY = 864e5;

export function dedup(jobs: Job[]): Job[] {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const company = normCompany(j.company);
    if (!company) continue; // without a company we cannot be confident
    const bucket = `${j.location.city || j.location.regionId || '-'}|${company.slice(0, 5)}`;
    const arr = groups.get(bucket) || [];
    arr.push(j);
    groups.set(bucket, arr);
  }

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let p = parent.get(id) ?? id;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const prepared = arr.map((j) => {
      const key = `${normTitle(j.title)}|${normCompany(j.company)}`;
      return { j, key, tri: trigrams(key), t: Date.parse(j.postedAt || j.firstSeen) };
    });
    for (let a = 0; a < prepared.length; a++) {
      for (let b = a + 1; b < prepared.length; b++) {
        const A = prepared[a];
        const B = prepared[b];
        if (A.j.source === B.j.source) continue; // same-source repeats are distinct ads
        if (Math.abs(A.t - B.t) > 30 * DAY) continue;
        if (A.key === B.key || similarity(A.tri, B.tri) >= 0.85) union(A.j.id, B.j.id);
      }
    }
  }

  const clusters = new Map<string, Job[]>();
  for (const j of jobs) {
    const r = find(j.id);
    const arr = clusters.get(r) || [];
    arr.push(j);
    clusters.set(r, arr);
  }

  const out: Job[] = [];
  for (const arr of clusters.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    arr.sort((x, y) => richness(y) - richness(x));
    const [canon, ...rest] = arr;
    // One alsoOn entry per other source.
    canon.aliases.push(...rest.map((o) => o.id));
    const seen = new Set([canon.source]);
    for (const o of rest) {
      if (seen.has(o.source)) continue;
      seen.add(o.source);
      canon.alsoOn.push({ source: o.source, url: o.sourceUrl });
    }
    if (canon.pay.min == null) {
      const withPay = rest.find((o) => o.pay.min != null);
      if (withPay) canon.pay = withPay.pay;
    }
    for (const o of rest) for (const t of o.tags) if (!canon.tags.includes(t)) canon.tags.push(t);
    out.push(canon);
  }
  return out;
}
