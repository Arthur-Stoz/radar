import { getStore, type LightJob, type Store } from './db';
import { trigrams, similarity } from './trigram';
import { PLACES, REGIONS } from './gazetteer';
import { parseQuery, type Chip } from './query';
import { MAX_PHRASE_WORDS, synonymsOf, isKnownTerm } from './synonyms';
import { TAG_SHORT, type Tag } from './tags';
import { fold } from './text';
import { cosineQ } from './embedding';

// Search and ranking (BUILD.md §5).

export type Sort = 'best' | 'new' | 'pay';
export type Posted = '24h' | '3d' | '7d' | '30d';

export interface SearchInput {
  q?: string;
  loc?: string[]; // region ids or city slugs
  type?: string[];
  pay?: number | null; // minimum hourly
  posted?: Posted | null;
  tags?: string[];
  source?: string[];
  sort?: Sort;
  page?: number;
  pageSize?: number;
  /** Optional query vector (normalized) for semantic blending. */
  vector?: number[] | null;
}

export interface CardJob {
  id: string;
  title: string;
  company: string | null;
  location: string;
  suburb: string | null;
  city: string | null;
  region: string | null;
  isRemote: boolean;
  workTypes: string[];
  payText: string | null;
  payMin: number | null;
  payMax: number | null;
  payPeriod: string | null;
  hourlyMin: number | null;
  hourlyMax: number | null;
  belowMinWage: boolean;
  postedAt: string;
  source: string;
  sourceName: string;
  summary: string;
  highlights: string[];
  tags: Tag[];
  alsoOn: { source: string; sourceName: string; url: string }[];
  descriptionStart: string;
  category: string | null;
  expiresAt: string | null;
  score?: number;
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
  /** For cities: the region id. */
  parent?: string;
}

export interface SearchResult {
  total: number;
  page: number;
  pageSize: number;
  results: CardJob[];
  chips: Chip[];
  keywords: string;
  corrected: string | null;
  broadened: string | null;
  facets: {
    region: FacetCount[];
    city: FacetCount[];
    type: FacetCount[];
    pay: FacetCount[];
    posted: FacetCount[];
    tags: FacetCount[];
    source: FacetCount[];
  };
  typicalPay: { p25: number; p75: number; median: number } | null;
  tookMs: number;
  ready: boolean;
}

const W = { rel: 0.5, sem: 0.25, fresh: 0.1, loc: 0.1, complete: 0.05 };
const DAY = 86400;
const POSTED_SECS: Record<Posted, number> = { '24h': DAY, '3d': 3 * DAY, '7d': 7 * DAY, '30d': 30 * DAY };
const FACET_TAGS: Tag[] = ['whv-friendly', 'no-experience', 'accommodation', 'remote', 'visa-sponsorship', 'student-friendly', 'immediate-start', 'seasonal'];
const PAY_BUCKETS = [25, 30, 35, 40, 50];

const citySlug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const CITY_BY_SLUG = new Map<string, { city: string; regionId: string }>();
for (const p of PLACES) if (p.kind === 'town') CITY_BY_SLUG.set(citySlug(p.city), { city: p.city, regionId: p.regionId });
const REGION_IDS = new Set(REGIONS.map((r) => r.id));
const REGION_NAME = new Map(REGIONS.map((r) => [r.id, r.name]));

export function resolveLoc(v: string): { kind: 'region'; id: string } | { kind: 'city'; city: string; regionId: string } | null {
  const s = citySlug(v);
  // A slug that is both a region and a city ("auckland", "wellington", "nelson", "gisborne") means the region.
  if (REGION_IDS.has(s)) return { kind: 'region', id: s };
  const c = CITY_BY_SLUG.get(s);
  if (c) return { kind: 'city', ...c };
  return null;
}

// ---------- FTS query building ----------

interface Unit {
  text: string;
  alts: string[];
}

export function buildUnits(keywords: string): Unit[] {
  const words = fold(keywords)
    .replace(/[^a-z0-9&+#' ]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  const units: Unit[] = [];
  for (let i = 0; i < words.length; ) {
    let matched = 0;
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 2; n--) {
      const phrase = words.slice(i, i + n).join(' ');
      if (isKnownTerm(phrase)) {
        units.push({ text: phrase, alts: expand(phrase) });
        matched = n;
        break;
      }
    }
    if (matched) {
      i += matched;
      continue;
    }
    const w = words[i];
    i++;
    if (w.length < 2 && !/\d/.test(w)) continue;
    units.push({ text: w, alts: expand(w) });
  }
  return units;
}

function expand(term: string): string[] {
  // Tiny abbreviations (kp, pa, rn…) trigger a group but are never added as expansions.
  return synonymsOf(term).filter((t) => t === term || t.length > 2);
}

const ftsPhrase = (t: string) => `"${t.replace(/"/g, '')}"`;

// The typed term may match anywhere; synonyms only in title / category, to keep precision
// ("hospitality" should not pull every ad that mentions a cafe).
export function ftsQuery(units: Unit[]): string {
  return units
    .map((u) => {
      const others = u.alts.filter((a) => a !== u.text);
      if (!others.length) return ftsPhrase(u.text);
      return `(${ftsPhrase(u.text)} OR {title category} : (${others.map(ftsPhrase).join(' OR ')}))`;
    })
    .join(' AND ');
}

function runFts(store: Store, q: string, limit = 5000): Map<number, number> {
  const out = new Map<number, number>();
  if (!q) return out;
  try {
    const rows = store.db.prepare('SELECT rowid, bm25(jobs_fts, 10.0, 3.0, 3.0, 2.0, 2.0, 1.0) AS r FROM jobs_fts WHERE jobs_fts MATCH ? ORDER BY r LIMIT ?').all(q, limit) as {
      rowid: number;
      r: number;
    }[];
    for (const row of rows) out.set(row.rowid, -row.r);
  } catch {
    // Malformed FTS syntax from odd input: treat as no match.
  }
  return out;
}

function runTrigram(store: Store, keywords: string, limit = 400): Map<number, number> {
  const grams = [...trigrams(fold(keywords).replace(/[^a-z0-9 ]+/g, ' '))].filter((g) => !/^\s|\s$/.test(g) && g.trim().length === 3);
  if (!grams.length) return new Map();
  const q = grams.map((g) => `"${g}"`).join(' OR ');
  const out = new Map<number, number>();
  try {
    const rows = store.db.prepare('SELECT rowid, bm25(jobs_trgm, 3.0, 1.0) AS r FROM jobs_trgm WHERE jobs_trgm MATCH ? ORDER BY r LIMIT ?').all(q, limit) as { rowid: number; r: number }[];
    for (const row of rows) out.set(row.rowid, -row.r);
  } catch {}
  return out;
}

/** Spelling correction against the vocabulary of title words. */
export function correctSpelling(store: Store, keywords: string): string | null {
  const words = fold(keywords).split(' ').filter(Boolean);
  let changed = false;
  const out = words.map((w) => {
    if (w.length < 4 || store.words.has(w) || isKnownTerm(w) || /\d/.test(w)) return w;
    const tw = trigrams(w);
    let best: string | null = null;
    let bestScore = 0;
    for (const [cand, count] of store.words) {
      if (Math.abs(cand.length - w.length) > 2) continue;
      const s = similarity(tw, trigrams(cand)) + Math.min(count, 500) / 5000 + (cand[0] === w[0] ? 0.05 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = cand;
      }
    }
    if (best && bestScore >= 0.42) {
      changed = true;
      return best;
    }
    return w;
  });
  return changed ? out.join(' ') : null;
}

// ---------- Filters & facets ----------

interface Filters {
  regions: Set<string>;
  cities: Set<string>;
  types: Set<string>;
  pay: number | null;
  postedSince: number | null;
  tags: Set<string>;
  sources: Set<string>;
}

// One bit per filter group a job fails. A job counts for facet X when it fails nothing but X.
const F_LOC = 1;
const F_TYPE = 2;
const F_PAY = 4;
const F_POSTED = 8;
const F_TAGS = 16;
const F_SOURCE = 32;

function failMask(j: LightJob, f: Filters): number {
  let m = 0;
  if ((f.regions.size || f.cities.size) && !((j.regionId != null && f.regions.has(j.regionId)) || (j.city != null && f.cities.has(j.city)))) m |= F_LOC;
  if (f.types.size) {
    let ok = false;
    for (const t of j.wt) if (f.types.has(t)) ok = true;
    if (!ok) m |= F_TYPE;
  }
  if (f.pay != null && !(j.hourlyMax != null && j.hourlyMax >= f.pay)) m |= F_PAY;
  if (f.postedSince != null && j.postedTs < f.postedSince) m |= F_POSTED;
  if (f.tags.size) for (const t of f.tags) if (!j.tg.includes(t)) m |= F_TAGS;
  if (f.sources.size && !f.sources.has(j.source)) m |= F_SOURCE;
  return m;
}

function passes(j: LightJob, f: Filters): boolean {
  return failMask(j, f) === 0;
}

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// ---------- Main ----------

export function emptyResult(input: SearchInput, ready: boolean): SearchResult {
  return {
    total: 0,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 24,
    results: [],
    chips: [],
    keywords: '',
    corrected: null,
    broadened: null,
    facets: { region: [], city: [], type: [], pay: [], posted: [], tags: [], source: [] },
    typicalPay: null,
    tookMs: 0,
    ready,
  };
}

let sourceNames: { version: number; map: Map<string, string> } | null = null;
export function sourceNameMap(store: Store): Map<string, string> {
  if (!sourceNames || sourceNames.version !== store.version) {
    const rows = store.db.prepare('SELECT id, name FROM sources_status').all() as { id: string; name: string }[];
    sourceNames = { version: store.version, map: new Map(rows.map((r) => [r.id, r.name])) };
  }
  return sourceNames.map;
}

const resultCache = new Map<string, SearchResult>();

export function search(input: SearchInput): SearchResult {
  const store0 = getStore();
  const cacheKey = store0 && !input.vector ? `${store0.version}|${JSON.stringify(input)}` : null;
  if (cacheKey) {
    const hit = resultCache.get(cacheKey);
    if (hit) {
      resultCache.delete(cacheKey);
      resultCache.set(cacheKey, hit);
      return { ...hit, tookMs: 0 };
    }
  }
  const res = searchUncached(input);
  if (cacheKey && res.ready) {
    resultCache.set(cacheKey, res);
    if (resultCache.size > 300) resultCache.delete(resultCache.keys().next().value!);
  }
  return res;
}

function searchUncached(input: SearchInput): SearchResult {
  const t0 = performance.now();
  const store = getStore();
  if (!store) return emptyResult(input, false);

  const page = Math.max(1, Math.min(input.page ?? 1, 200));
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 24, 60));
  const parsed = parseQuery(input.q || '');
  const chips = parsed.chips;

  // Filters = explicit params ∪ chips parsed from the text.
  const f: Filters = { regions: new Set(), cities: new Set(), types: new Set(input.type || []), pay: input.pay ?? null, postedSince: null, tags: new Set(input.tags || []), sources: new Set(input.source || []) };
  let queryCity: string | null = null;
  let queryRegion: string | null = null;
  for (const l of input.loc || []) {
    const r = resolveLoc(l);
    if (r?.kind === 'region') f.regions.add(r.id);
    else if (r?.kind === 'city') f.cities.add(r.city);
  }
  for (const c of chips) {
    if (c.kind === 'loc') {
      const [k, v] = c.value.split(':');
      if (k === 'city') {
        f.cities.add(v);
        queryCity = v;
        const p = PLACES.find((x) => x.city === v && x.kind === 'town');
        queryRegion = p?.regionId ?? null;
      } else {
        f.regions.add(v);
        queryRegion = v;
      }
    } else if (c.kind === 'type') f.types.add(c.value);
    else if (c.kind === 'tag') f.tags.add(c.value);
    else if (c.kind === 'pay') f.pay = Math.max(f.pay ?? 0, c.value);
  }
  if (input.posted && POSTED_SECS[input.posted]) f.postedSince = Math.floor(Date.now() / 1000) - POSTED_SECS[input.posted];

  // Candidate set from text.
  let keywords = parsed.keywords;
  let corrected: string | null = null;
  let units = buildUnits(keywords);
  let rel: Map<number, number> | null = null;
  if (units.length) {
    rel = runFts(store, ftsQuery(units));
    if (rel.size < 10) {
      const fix = correctSpelling(store, keywords);
      if (fix) {
        const u2 = buildUnits(fix);
        const r2 = runFts(store, ftsQuery(u2));
        if (r2.size > rel.size) {
          rel = r2;
          units = u2;
          corrected = fix;
          keywords = fix;
        }
      }
    }
    if (rel.size < 10) {
      const tri = runTrigram(store, keywords);
      for (const [k, v] of tri) if (!rel.has(k)) rel.set(k, v * 0.5);
    }
  }

  const candidates: LightJob[] = rel ? [...rel.keys()].map((r) => store.byRowid.get(r)!).filter(Boolean) : store.light;

  let filtered = candidates.filter((j) => passes(j, f));
  // Never a dead end: a city with few matches broadens to its region.
  let broadened: string | null = null;
  if (filtered.length < 5 && queryCity && queryRegion && f.cities.size === 1 && !f.regions.size) {
    const wider: Filters = { ...f, cities: new Set(), regions: new Set([queryRegion]) };
    const w = candidates.filter((j) => passes(j, wider));
    if (w.length > filtered.length) {
      filtered = w;
      broadened = REGION_NAME.get(queryRegion) ?? null;
    }
  }

  // ---- Scoring ----
  const sort: Sort = input.sort || (units.length || input.vector ? 'best' : 'new');
  const now = Date.now() / 1000;
  let maxRel = 0;
  if (rel) for (const j of filtered) maxRel = Math.max(maxRel, rel.get(j.rowid) || 0);
  const vectors = input.vector ? getVectors(store) : null;

  // Fast path: no text, newest first — the light index is already sorted by date.
  const fast = !rel && !vectors && sort === 'new';
  const scored = fast ? filtered.map((j) => ({ j, score: 0 })) : filtered.map((j) => {
    let r = 0;
    if (rel && maxRel > 0) {
      const bm = (rel.get(j.rowid) || 0) / maxRel;
      // Title hits: share of query units found in the title (strong relevance signal).
      let hits = 0;
      for (const u of units) if (u.alts.some((a) => titleHas(j.titleKey, a))) hits++;
      r = 0.55 * bm + 0.45 * (units.length ? hits / units.length : 0);
    }
    const ageDays = Math.max(0, (now - j.postedTs) / DAY);
    const fresh = Math.exp(-ageDays / 10);
    const loc = queryCity ? (j.city === queryCity ? 1 : j.regionId === queryRegion ? 0.5 : 0) : queryRegion ? (j.regionId === queryRegion ? 1 : 0) : 0;
    const complete = (j.hasPay ? 0.5 : 0) + (j.hasSummary ? 0.5 : 0);
    let sem = 0;
    if (vectors && input.vector) {
      const v = vectors.get(j.rowid);
      if (v) sem = Math.max(0, cosineQ(input.vector, v));
    }
    const score = W.rel * r + W.sem * sem + W.fresh * fresh + W.loc * loc + W.complete * complete;
    return { j, score };
  });

  if (fast) {
    // already ordered
  } else if (sort === 'new') scored.sort((a, b) => b.j.postedTs - a.j.postedTs || b.score - a.score);
  else if (sort === 'pay') scored.sort((a, b) => (b.j.hourlyMax ?? -1) - (a.j.hourlyMax ?? -1) || b.score - a.score);
  else scored.sort((a, b) => b.score - a.score || b.j.postedTs - a.j.postedTs);

  // Collapse duplicates (same title + company + city) and keep light diversity.
  const seen = new Set<string>();
  const unique = scored.filter(({ j }) => {
    const k = j.dupKey;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const ordered = sort === 'best' ? diversify(unique, 3, Math.max(300, page * pageSize + 100)) : unique;

  const total = ordered.length;
  const slice = ordered.slice((page - 1) * pageSize, page * pageSize);
  const results = loadCards(store, slice.map((s) => s.j.rowid));
  slice.forEach((s, i) => (results[i].score = Math.round(s.score * 1000) / 1000));

  // ---- Facets (each ignores its own filter) ----
  const facets = computeFacets(candidates, f, sourceNameMap(store));

  const pays = filtered
    .map((j) => (j.hourlyMin != null && j.hourlyMax != null ? (j.hourlyMin + j.hourlyMax) / 2 : null))
    .filter((x): x is number => x != null && x >= 15 && x <= 300)
    .sort((a, b) => a - b);
  const typicalPay = pays.length >= 5 ? { p25: Math.round(percentile(pays, 0.25)), p75: Math.round(percentile(pays, 0.75)), median: Math.round(percentile(pays, 0.5)) } : null;

  return {
    total,
    page,
    pageSize,
    results,
    chips,
    keywords: parsed.keywords,
    corrected,
    broadened,
    facets,
    typicalPay,
    tookMs: Math.round(performance.now() - t0),
    ready: true,
  };
}

function titleHas(title: string, term: string): boolean {
  const i = title.indexOf(term);
  if (i < 0) return false;
  const before = i === 0 || !/[a-z0-9]/.test(title[i - 1]);
  const afterCh = title[i + term.length];
  return before && (!afterCh || !/[a-z0-9]/.test(afterCh) || afterCh === 's');
}

/** Max `maxRun` consecutive results from one company. Only the head of the list needs it. */
function diversify<T extends { j: LightJob }>(list: T[], maxRun: number, head = 1500): T[] {
  const out: T[] = [];
  const rest = list.slice(0, head);
  const tail = list.slice(head);
  while (rest.length) {
    const lastCompanies = out.slice(-maxRun).map((x) => (x.j.company || '').toLowerCase());
    const runFull = lastCompanies.length === maxRun && lastCompanies.every((c) => c && c === lastCompanies[0]);
    let idx = 0;
    if (runFull) {
      const found = rest.findIndex((x) => (x.j.company || '').toLowerCase() !== lastCompanies[0]);
      idx = found >= 0 && found <= 50 ? found : 0;
    }
    out.push(rest.splice(idx, 1)[0]);
  }
  return tail.length ? out.concat(tail) : out;
}

function computeFacets(candidates: LightJob[], f: Filters, names: Map<string, string>): SearchResult['facets'] {
  const regionCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const cityRegion = new Map<string, string>();
  const typeCounts = new Map<string, number>();
  const payCounts = new Map<number, number>();
  const postedCounts = new Map<Posted, number>();
  const tagCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const now = Math.floor(Date.now() / 1000);

  const postedCuts = (Object.entries(POSTED_SECS) as [Posted, number][]).map(([k, s]) => [k, now - s] as const);
  const inc = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) || 0) + 1);

  for (const j of candidates) {
    const m = failMask(j, f);
    if (m & ~(F_LOC | F_TYPE | F_PAY | F_POSTED | F_TAGS | F_SOURCE)) continue;
    if ((m & ~F_LOC) === 0) {
      if (j.regionId) inc(regionCounts, j.regionId);
      if (j.city) {
        inc(cityCounts, j.city);
        if (j.regionId) cityRegion.set(j.city, j.regionId);
      }
    }
    if ((m & ~F_TYPE) === 0) for (const t of j.wt) inc(typeCounts, t);
    if ((m & ~F_PAY) === 0 && j.hourlyMax != null) for (const b of PAY_BUCKETS) if (j.hourlyMax >= b) inc(payCounts, b);
    if ((m & ~F_POSTED) === 0) for (const [k, cut] of postedCuts) if (j.postedTs >= cut) inc(postedCounts, k);
    if ((m & ~F_TAGS) === 0) for (const t of j.tg) inc(tagCounts, t);
    if ((m & ~F_SOURCE) === 0) inc(sourceCounts, j.source);
  }
  const byCount = (a: FacetCount, b: FacetCount) => b.count - a.count;
  return {
    region: REGIONS.map((r) => ({ value: r.id, label: r.name, count: regionCounts.get(r.id) || 0 })),
    city: [...cityCounts.entries()].map(([c, n]) => ({ value: citySlug(c), label: c, count: n, parent: cityRegion.get(c) })).sort(byCount).slice(0, 80),
    type: ['full-time', 'part-time', 'casual', 'contract', 'temp', 'seasonal', 'internship'].map((t) => ({
      value: t,
      label: { 'full-time': 'Full time', 'part-time': 'Part time', casual: 'Casual', contract: 'Contract', temp: 'Temporary', seasonal: 'Seasonal', internship: 'Internship' }[t]!,
      count: typeCounts.get(t) || 0,
    })),
    pay: PAY_BUCKETS.map((b) => ({ value: String(b), label: `$${b}+/h`, count: payCounts.get(b) || 0 })),
    posted: (['24h', '3d', '7d', '30d'] as Posted[]).map((p) => ({
      value: p,
      label: { '24h': 'Last 24 hours', '3d': 'Last 3 days', '7d': 'Last 7 days', '30d': 'Last 30 days' }[p],
      count: postedCounts.get(p) || 0,
    })),
    tags: FACET_TAGS.map((t) => ({ value: t, label: TAG_SHORT[t], count: tagCounts.get(t) || 0 })),
    source: [...sourceCounts.entries()].map(([s, n]) => ({ value: s, label: names.get(s) || s, count: n })).sort(byCount),
  };
}

// ---------- Rows → cards ----------

interface JobRow {
  rowid: number;
  id: string;
  title: string;
  company: string | null;
  suburb: string | null;
  city: string | null;
  region: string | null;
  loc_raw: string | null;
  is_remote: number;
  work_types: string;
  pay_text: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: string | null;
  hourly_min: number | null;
  hourly_max: number | null;
  below_min_wage: number;
  posted_ts: number;
  source: string;
  summary: string;
  highlights: string;
  tags: string;
  also_on: string;
  description: string;
  category: string | null;
  expires_at: string | null;
}

const ATS = new Set(['greenhouse', 'lever', 'smartrecruiters', 'workable', 'ashby']);

/** Display name of where the ad lives: the board, or "<Company> careers" for company career pages. */
export function displaySource(source: string, company: string | null, names: Map<string, string>): string {
  if (ATS.has(source)) return company ? `${company} careers` : 'Company careers page';
  return names.get(source) || source;
}

export function rowToCard(r: JobRow, names: Map<string, string>, descLen = 600): CardJob {
  const location = r.suburb && r.city ? `${r.suburb}, ${r.city}` : r.city || r.region || (r.is_remote ? 'Remote' : r.loc_raw || 'New Zealand');
  let desc = r.description || '';
  if (descLen && desc.length > descLen) {
    const cut = desc.slice(0, descLen);
    const sp = cut.lastIndexOf(' ');
    desc = (sp > descLen * 0.7 ? cut.slice(0, sp) : cut) + '…';
  }
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    location,
    suburb: r.suburb,
    city: r.city,
    region: r.region,
    isRemote: !!r.is_remote,
    workTypes: r.work_types.split(',').filter(Boolean),
    payText: r.pay_text,
    payMin: r.pay_min,
    payMax: r.pay_max,
    payPeriod: r.pay_period,
    hourlyMin: r.hourly_min,
    hourlyMax: r.hourly_max,
    belowMinWage: !!r.below_min_wage,
    postedAt: new Date(r.posted_ts * 1000).toISOString(),
    source: r.source,
    sourceName: displaySource(r.source, r.company, names),
    summary: r.summary,
    highlights: JSON.parse(r.highlights || '[]'),
    tags: r.tags.split(',').filter(Boolean) as Tag[],
    alsoOn: (JSON.parse(r.also_on || '[]') as { source: string; url: string }[]).map((a) => ({ ...a, sourceName: displaySource(a.source, r.company, names) })),
    descriptionStart: desc,
    category: r.category,
    expiresAt: r.expires_at,
  };
}

const CARD_COLS =
  'rowid, id, title, company, suburb, city, region, loc_raw, is_remote, work_types, pay_text, pay_min, pay_max, pay_period, hourly_min, hourly_max, below_min_wage, posted_ts, source, summary, highlights, tags, also_on, description, category, expires_at';

export function loadCards(store: Store, rowids: number[]): CardJob[] {
  if (!rowids.length) return [];
  const rows = store.db.prepare(`SELECT ${CARD_COLS} FROM jobs WHERE rowid IN (${rowids.map(() => '?').join(',')})`).all(...rowids) as JobRow[];
  const byId = new Map(rows.map((r) => [r.rowid, r]));
  const names = sourceNameMap(store);
  return rowids.map((id) => byId.get(id)).filter((r): r is JobRow => !!r).map((r) => rowToCard(r, names));
}

export function getJob(id: string): (CardJob & { description: string; sourceUrl: string }) | null {
  const store = getStore();
  if (!store) return null;
  const r = store.db.prepare(`SELECT ${CARD_COLS}, source_url FROM jobs WHERE id = ?`).get(id) as (JobRow & { source_url: string }) | undefined;
  if (!r) return null;
  return { ...rowToCard(r, sourceNameMap(store), 0), description: r.description, sourceUrl: r.source_url };
}

// ---------- Vectors (lazy) ----------

let vecCache: { version: number; map: Map<number, Int8Array> } | null = null;
export function getVectors(store: Store): Map<number, Int8Array> {
  if (vecCache?.version === store.version) return vecCache.map;
  const map = new Map<number, Int8Array>();
  for (const r of store.db.prepare('SELECT rowid, v FROM vectors').iterate() as Iterable<{ rowid: number; v: Buffer }>) {
    map.set(r.rowid, new Int8Array(r.v.buffer, r.v.byteOffset, r.v.byteLength).slice());
  }
  vecCache = { version: store.version, map };
  return map;
}
