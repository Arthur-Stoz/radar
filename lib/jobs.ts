import { getStore } from './db';
import { REGION_BY_ID } from './geo';
import { getJob, search, sourceNameMap, type CardJob } from './search';
import { fold } from './text';

export { getJob };

export interface ExpiredJob {
  id: string;
  title: string;
  company: string | null;
  city: string | null;
  regionId: string | null;
  source: string;
  sourceName: string;
  removedAt: string;
}

/** Jobs removed in the last 60 days (kept so old links can say "closed" and suggest similar ones). */
export function getExpired(id: string): ExpiredJob | null {
  const store = getStore();
  if (!store) return null;
  try {
    const r = store.db.prepare('SELECT id, title, company, city, region_id AS regionId, source, removed_at AS removedAt FROM expired WHERE id = ?').get(id) as Omit<ExpiredJob, 'sourceName'> | undefined;
    return r ? { ...r, sourceName: sourceNameMap(store).get(r.source) || r.source } : null;
  } catch {
    return null;
  }
}

const STOP = new Set(['and', 'the', 'for', 'with', 'full', 'part', 'time', 'senior', 'junior', 'urgent', 'immediate', 'start', 'role', 'position', 'job', 'nz']);

export function similarJobs(o: { title: string; city: string | null; regionId: string | null; excludeId: string; limit?: number }): CardJob[] {
  const limit = o.limit ?? 6;
  const words = fold(o.title.split(/\s[-–|(]/)[0])
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
  const loc = o.regionId && REGION_BY_ID.has(o.regionId) ? [o.regionId] : [];
  const tries = [words.slice(0, 3).join(' '), words.slice(0, 2).join(' '), words[0] || ''].filter(Boolean);
  const out: CardJob[] = [];
  const seen = new Set([o.excludeId]);
  for (const q of tries) {
    for (const l of loc.length ? [loc, []] : [[]]) {
      const res = search({ q: o.city ? `${q} ${o.city}` : q, loc: l, pageSize: limit + 2, sort: 'best' });
      for (const j of res.results) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        out.push(j);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** A merged duplicate's canonical job id. */
export function aliasOf(id: string): string | null {
  const store = getStore();
  if (!store) return null;
  try {
    const r = store.db.prepare('SELECT canonical_id AS c FROM aliases WHERE id = ?').get(id) as { c: string } | undefined;
    return r?.c ?? null;
  } catch {
    return null;
  }
}
