// Ingest entry point: `npm run ingest`.
// Fetches every active source, normalizes, dedups, expires, embeds, builds radar.db (SQLite),
// then gzips it with a manifest. Safe to run locally (writes ./.data/radar.db) and in CI.
//
// Env: DATA_DIR (default ./.data), PREV_DB (previous DB to reuse; default DATA_DIR/radar.db),
//      DETAIL_BUDGET (detail pages per source per run, default 1500), ONLY_SOURCES (comma list),
//      SKIP_EMBEDDINGS=1, DISABLED_SOURCES, ENABLED_SOURCES.

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { EMBED_MODEL } from '../lib/embedding';
import { dedup } from './dedup';
import { SCHEMA_VERSION, writeDb, type ExpiredRow, type SourceStatusRow } from './db';
import { embedAll } from './embed';
import { Http } from './http';
import { parseLocation } from '../lib/geo';
import { extractSummary } from '../lib/summary';
import { detectTags } from '../lib/tags';
import { htmlToText } from '../lib/text';
import { embeddingText, normalize, type Job } from './normalize';
import { ALL_SOURCES, activeSources } from './sources';
import type { PrevJob, RawJob, Source, SourceContext } from './types';

const DAY = 864e5;
const MAX_AGE_DAYS = 60;
const MAX_DROP = 0.4;

const dataDir = resolve(process.env.DATA_DIR || './.data');
const cacheDir = resolve(process.env.CACHE_DIR || './.cache');
mkdirSync(dataDir, { recursive: true });

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

interface PrevRow {
  id: string;
  source: string;
  source_id: string;
  first_seen: string;
  last_seen: string;
  missed: number;
  content_hash: string;
  has_detail: number;
  description: string;
  raw: string | null;
  posted_at: string | null;
  expires_at: string | null;
  v: Buffer | null;
  row: Record<string, unknown>;
}

function loadPrevious(file: string) {
  const jobs = new Map<string, PrevRow>();
  const statuses = new Map<string, SourceStatusRow>();
  const expired: ExpiredRow[] = [];
  let total = 0;
  if (!existsSync(file)) return { jobs, statuses, total, expired };
  try {
    const db = new Database(file, { readonly: true });
    const rows = db.prepare('SELECT j.*, v.v AS v FROM jobs j LEFT JOIN vectors v ON v.rowid = j.rowid').all() as (PrevRow & Record<string, unknown>)[];
    for (const r of rows) jobs.set(r.id, { ...r, row: r });
    for (const s of db.prepare('SELECT * FROM sources_status').all() as SourceStatusRow[]) statuses.set(s.id, s);
    total = Number((db.prepare("SELECT value FROM meta WHERE key='total'").get() as { value: string } | undefined)?.value || rows.length);
    try {
      expired.push(...(db.prepare('SELECT * FROM expired').all() as ExpiredRow[]));
    } catch {
      // older DB without the table
    }
    db.close();
    log(`previous DB: ${rows.length} jobs`);
  } catch (e) {
    log(`previous DB unreadable, starting fresh: ${(e as Error).message}`);
  }
  return { jobs, statuses, total, expired };
}

/** Rebuild a Job from a previous DB row (used to keep jobs of a failed source, or not-yet-expired ones). */
function jobFromRow(r: Record<string, unknown>): Job {
  const s = (k: string) => (r[k] as string | null) ?? null;
  const n = (k: string) => (r[k] as number | null) ?? null;
  return {
    id: s('id')!,
    source: s('source')!,
    sourceId: s('source_id')!,
    sourceUrl: s('source_url')!,
    title: s('title')!,
    company: s('company'),
    companyLogo: s('company_logo'),
    location: {
      raw: s('loc_raw') || '',
      suburb: s('suburb'),
      city: s('city'),
      region: s('region'),
      regionId: s('region_id'),
      isRemote: !!n('is_remote'),
      isHybrid: !!n('is_hybrid'),
    },
    workType: (s('work_types') || '').split(',').filter(Boolean) as Job['workType'],
    category: s('category'),
    pay: {
      text: s('pay_text'),
      min: n('pay_min'),
      max: n('pay_max'),
      period: s('pay_period') as Job['pay']['period'],
      hourlyMin: n('hourly_min'),
      hourlyMax: n('hourly_max'),
      belowMinWage: !!n('below_min_wage'),
    },
    postedAt: s('posted_at'),
    expiresAt: s('expires_at'),
    firstSeen: s('first_seen')!,
    lastSeen: s('last_seen')!,
    description: s('description') || '',
    summary: s('summary') || '',
    highlights: JSON.parse(s('highlights') || '[]'),
    tags: (s('tags') || '').split(',').filter(Boolean) as Job['tags'],
    alsoOn: [],
    aliases: [],
    contentHash: s('content_hash')!,
    hasDetail: !!n('has_detail'),
    missed: n('missed') || 0,
    raw: s('raw') ? JSON.parse(s('raw')!) : null,
  };
}

interface SourceResult {
  source: Source;
  ok: boolean;
  message: string | null;
  raws: RawJob[];
  counters: SourceContext['counters'];
  durationMs: number;
}

async function runSource(source: Source, http: Http, prevBySource: Map<string, PrevJob>, budget: number, now: Date): Promise<SourceResult> {
  const t0 = Date.now();
  let left = budget;
  const counters = { pages: 0, details: 0, errors: 0 };
  const ctx: SourceContext = {
    http,
    now,
    log: (m) => log(m),
    previous: (sid) => prevBySource.get(sid),
    takeDetail: () => (left-- > 0),
    counters,
  };
  const raws: RawJob[] = [];
  try {
    for await (const r of source.fetchListings(ctx)) raws.push(r);
    return { source, ok: true, message: counters.errors ? `${counters.errors} errors` : null, raws, counters, durationMs: Date.now() - t0 };
  } catch (e) {
    log(`✗ ${source.id} failed: ${(e as Error).stack || e}`);
    return { source, ok: false, message: (e as Error).message.slice(0, 300), raws, counters, durationMs: Date.now() - t0 };
  }
}

async function gzipFile(src: string, dest: string) {
  await pipeline(createReadStream(src), createGzip({ level: 9 }), createWriteStream(dest));
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function main() {
  const t0 = Date.now();
  const now = new Date();
  const dbFile = join(dataDir, 'radar.db');
  const prevFile = resolve(process.env.PREV_DB || dbFile);
  const budget = Number(process.env.DETAIL_BUDGET || 1500);
  const only = (process.env.ONLY_SOURCES || '').split(',').filter(Boolean);

  const prev = loadPrevious(prevFile);
  // OFFLINE=1: no fetching; rebuild the DB from the previous one (re-deriving locations and tags).
  const offline = process.env.OFFLINE === '1';
  let sources = offline ? [] : activeSources();
  if (only.length) sources = sources.filter((s) => only.includes(s.id));
  log(`sources: ${sources.map((s) => s.id).join(', ')}`);

  const http = new Http({ cacheDir: join(cacheDir, 'http') });

  const prevBySource = new Map<string, Map<string, PrevJob>>();
  for (const p of prev.jobs.values()) {
    let m = prevBySource.get(p.source);
    if (!m) prevBySource.set(p.source, (m = new Map()));
    m.set(p.source_id, {
      id: p.id,
      sourceId: p.source_id,
      description: p.description,
      hasDetail: !!p.has_detail,
      postedAt: p.posted_at,
      expiresAt: p.expires_at,
      raw: p.raw ? JSON.parse(p.raw) : null,
    });
  }

  const results = await Promise.all(sources.map((s) => runSource(s, http, prevBySource.get(s.id) || new Map(), budget, now)));

  // ---- Normalize + merge with previous ----
  const jobs = new Map<string, Job>();
  const stats = new Map<string, { found: number; new: number; updated: number; removed: number }>();
  const succeeded = new Set<string>();
  for (const r of results) {
    const st = { found: 0, new: 0, updated: 0, removed: 0 };
    stats.set(r.source.id, st);
    const prevCount = [...prev.jobs.values()].filter((p) => p.source === r.source.id).length;
    // A source that suddenly returns nothing is treated as failed (keeps its previous jobs).
    if (r.ok && r.raws.length === 0 && (prevCount > 20 || r.source.kind === 'site')) {
      r.ok = false;
      r.message = 'returned 0 listings';
    }
    if (r.ok) succeeded.add(r.source.id);
    for (const raw of r.raws) {
      let j: Job | null = null;
      try {
        j = normalize(r.source.id, raw, now);
      } catch (e) {
        r.counters.errors++;
        log(`${r.source.id}: normalize failed for ${raw.url}: ${(e as Error).message}`);
      }
      if (!j || jobs.has(j.id)) continue;
      st.found++;
      const p = prev.jobs.get(j.id);
      if (p) {
        j.firstSeen = p.first_seen;
        if (p.content_hash !== j.contentHash) st.updated++;
      } else st.new++;
      jobs.set(j.id, j);
    }
  }

  // ---- Expiry (BUILD.md §4.2) ----
  for (const p of prev.jobs.values()) {
    if (jobs.has(p.id)) continue;
    const inScope = sources.some((s) => s.id === p.source);
    const sourceStillExists = ALL_SOURCES.some((s) => s.id === p.source);
    if (!sourceStillExists) continue;
    if (!inScope && !only.length && !offline) continue; // disabled source: drop its jobs
    const j = jobFromRow(p.row);
    if (offline) rederive(j);
    if (succeeded.has(p.source)) {
      j.missed = (p.missed || 0) + 1;
      if (j.missed >= 2) {
        const st = stats.get(p.source);
        if (st) st.removed++;
        continue;
      }
    }
    jobs.set(j.id, j);
  }
  let expired = 0;
  for (const [id, j] of jobs) {
    const tooOld = now.getTime() - Date.parse(j.firstSeen) > MAX_AGE_DAYS * DAY;
    const closed = j.expiresAt && Date.parse(j.expiresAt) < now.getTime() - DAY;
    if (tooOld || closed) {
      jobs.delete(id);
      expired++;
      const st = stats.get(j.source);
      if (st) st.removed++;
    }
  }
  log(`expired/closed: ${expired}`);

  // ---- Dedup ----
  const before = jobs.size;
  const final = dedup([...jobs.values()]);
  log(`dedup: ${before} → ${final.length}`);

  // ---- Embeddings (reuse when contentHash unchanged) ----
  const vectors = new Map<string, Int8Array>();
  const toEmbed: Job[] = [];
  for (const j of final) {
    const p = prev.jobs.get(j.id);
    if (p?.v && p.content_hash === j.contentHash) vectors.set(j.id, new Int8Array(p.v.buffer, p.v.byteOffset, p.v.byteLength).slice());
    else toEmbed.push(j);
  }
  if (process.env.SKIP_EMBEDDINGS === '1') {
    log(`embeddings skipped (${toEmbed.length} missing)`);
  } else if (toEmbed.length) {
    log(`embeddings: computing ${toEmbed.length} (reused ${vectors.size})`);
    const vs = await embedAll(toEmbed.map(embeddingText), { cacheDir: join(cacheDir, 'models'), log });
    toEmbed.forEach((j, i) => vectors.set(j.id, vs[i]));
  }

  // ---- Sort newest first (stable rowids for "newest" queries) ----
  final.sort((a, b) => Date.parse(b.postedAt || b.firstSeen) - Date.parse(a.postedAt || a.firstSeen));

  // ---- Source status ----
  const activeBySource = new Map<string, number>();
  const hostsBySource = new Map<string, Set<string>>();
  for (const j of final) {
    activeBySource.set(j.source, (activeBySource.get(j.source) || 0) + 1);
    let h = hostsBySource.get(j.source);
    if (!h) hostsBySource.set(j.source, (h = new Set()));
    try {
      h.add(new URL(j.sourceUrl).host);
    } catch {}
    for (const a of j.alsoOn) {
      try {
        let ha = hostsBySource.get(a.source);
        if (!ha) hostsBySource.set(a.source, (ha = new Set()));
        ha.add(new URL(a.url).host);
      } catch {}
    }
  }
  const nowIso = now.toISOString();
  const statuses: SourceStatusRow[] = ALL_SOURCES.map((s) => {
    if (offline && prev.statuses.has(s.id)) {
      const p = prev.statuses.get(s.id)!;
      return { ...p, active_jobs: activeBySource.get(s.id) || 0, hosts: JSON.stringify([...new Set([...JSON.parse(p.hosts || '[]'), ...s.hosts, ...(hostsBySource.get(s.id) || [])])]) };
    }
    const r = results.find((x) => x.source.id === s.id);
    const p = prev.statuses.get(s.id);
    const st = stats.get(s.id);
    // With ONLY_SOURCES, sources not run this time keep their previous status.
    const isActive = sources.includes(s) || (only.length > 0 && activeSources().includes(s));
    const hosts = new Set([...s.hosts, ...(hostsBySource.get(s.id) || [])]);
    if (!r) {
      return {
        id: s.id,
        name: s.name,
        homepage: s.homepage,
        kind: s.kind,
        enabled: isActive ? 1 : 0,
        status: isActive ? (p?.status ?? 'ok') : 'disabled',
        message: isActive ? p?.message ?? null : disabledReason(s.id),
        last_run_at: p?.last_run_at ?? null,
        last_success_at: p?.last_success_at ?? null,
        pages: 0, details: 0, found: 0, new: 0, updated: 0, removed: 0, errors: 0, duration_ms: 0,
        active_jobs: activeBySource.get(s.id) || 0,
        hosts: JSON.stringify([...hosts]),
      };
    }
    return {
      id: s.id,
      name: s.name,
      homepage: s.homepage,
      kind: s.kind,
      enabled: 1,
      status: r.ok ? (r.counters.errors ? 'partial' : 'ok') : 'failed',
      message: r.message,
      last_run_at: nowIso,
      last_success_at: r.ok ? nowIso : p?.last_success_at ?? null,
      pages: r.counters.pages,
      details: r.counters.details,
      found: st?.found ?? 0,
      new: st?.new ?? 0,
      updated: st?.updated ?? 0,
      removed: st?.removed ?? 0,
      errors: r.counters.errors,
      duration_ms: r.durationMs,
      active_jobs: activeBySource.get(s.id) || 0,
      hosts: JSON.stringify([...hosts]),
    };
  });

  // ---- Safety check (BUILD.md §4.5) ----
  const total = final.length;
  const dropped = prev.total ? (prev.total - total) / prev.total : 0;
  if (prev.total && dropped > MAX_DROP && process.env.FORCE_PUBLISH !== '1') {
    log(`✗ SAFETY: total dropped ${(dropped * 100).toFixed(0)}% (${prev.total} → ${total}). Not publishing.`);
    printTable(statuses);
    process.exit(2);
  }

  // ---- Expired list: jobs that left the catalogue (not merged duplicates), kept 60 days ----
  const finalIds = new Set(final.map((j) => j.id));
  for (const j of final) for (const a of j.aliases) finalIds.add(a);
  const expiredRows = new Map<string, ExpiredRow>();
  for (const e of prev.expired) if (now.getTime() - Date.parse(e.removed_at) < MAX_AGE_DAYS * DAY && !finalIds.has(e.id)) expiredRows.set(e.id, e);
  for (const p of prev.jobs.values()) {
    if (finalIds.has(p.id)) continue;
    const r = p.row as Record<string, string | null>;
    expiredRows.set(p.id, { id: p.id, title: r.title as string, company: r.company, city: r.city, region_id: r.region_id, source: p.source, removed_at: nowIso });
  }

  // ---- Write DB atomically ----
  const tmp = join(dataDir, `radar.${process.pid}.tmp.db`);
  rmSync(tmp, { force: true });
  writeDb(tmp, final, vectors, statuses, {
    built_at: nowIso,
    version: String(SCHEMA_VERSION),
    total: String(total),
    model: EMBED_MODEL,
    sources_ok: String(succeeded.size),
    sources_total: String(sources.length),
  }, [...expiredRows.values()]);
  replaceFile(tmp, dbFile);

  const gz = join(dataDir, 'radar.db.gz');
  await gzipFile(dbFile, gz + '.tmp');
  replaceFile(gz + '.tmp', gz);
  const manifest = {
    built_at: nowIso,
    version: SCHEMA_VERSION,
    total,
    previous_total: prev.total,
    sha256: sha256(gz),
    bytes: statSync(gz).size,
    db_bytes: statSync(dbFile).size,
    sources: Object.fromEntries(statuses.map((s) => [s.id, { status: s.status, active: s.active_jobs, found: s.found, new: s.new, removed: s.removed, errors: s.errors }])),
  };
  writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  printTable(statuses);
  log(`done: ${total} jobs, db ${(manifest.db_bytes / 1e6).toFixed(1)} MB, gz ${(manifest.bytes / 1e6).toFixed(1)} MB, ${http.stats.requests} requests, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

/** Recompute derived fields from stored ones (used by OFFLINE rebuilds after parser changes). */
function rederive(j: Job) {
  const loc = parseLocation(j.location.raw);
  loc.isRemote = loc.isRemote || j.location.isRemote;
  if (loc.regionId || !j.location.regionId) j.location = loc;
  // Descriptions stored before the escaped-HTML fix still contain markup.
  if (/<\/?[a-z][^>]*>/i.test(j.description)) {
    j.description = htmlToText(j.description);
    if (/<\/?[a-z][^>]*>/i.test(j.summary)) j.summary = extractSummary(j.description, j.title);
  }
  const text = [j.title, j.summary, j.highlights.join('. '), j.description, j.pay.text, j.location.raw].filter(Boolean).join('\n');
  j.tags = detectTags(text, { isRemote: j.location.isRemote, workTypes: j.workType });
}

function replaceFile(src: string, dest: string) {
  for (let i = 0; i < 10; i++) {
    try {
      renameSync(src, dest);
      return;
    } catch (e) {
      // Windows: the dev server may hold the old file open briefly.
      if (i === 9) throw e;
      const until = Date.now() + 500;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }
}

function disabledReason(id: string): string {
  return (
    {
      facebook: 'No official feed since Meta removed the Groups API.',
    }[id] || 'Disabled'
  );
}

function printTable(statuses: SourceStatusRow[]) {
  const rows = statuses.map((s) => ({
    source: s.id,
    status: s.status,
    active: s.active_jobs,
    found: s.found,
    new: s.new,
    removed: s.removed,
    pages: s.pages,
    details: s.details,
    errors: s.errors,
    sec: Math.round(s.duration_ms / 1000),
  }));
  console.table(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
