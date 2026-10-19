import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dataDir } from './config';

// Read-only access to radar.db. The app always serves a private copy (DATA_DIR/serve/…), so the
// ingest (or the runtime downloader) can replace radar.db at any time; we reopen when it changes.

export interface LightJob {
  rowid: number;
  id: string;
  source: string;
  regionId: string | null;
  city: string | null;
  workTypes: string; // ",full-time,part-time,"
  tags: string; // ",remote,seasonal,"
  hourlyMax: number | null;
  hourlyMin: number | null;
  postedTs: number;
  isRemote: number;
  company: string | null;
  titleKey: string;
  /** title|company|place — collapses repeated ads of the same job. */
  dupKey: string;
  /** work types / tags as arrays (split once at load). */
  wt: string[];
  tg: string[];
  hasPay: number;
  hasSummary: number;
}

export interface VocabEntry {
  kind: 'title' | 'company' | 'place' | 'word';
  term: string;
  display: string;
  count: number;
}

export interface Store {
  db: Database.Database;
  file: string;
  builtAt: string;
  total: number;
  light: LightJob[];
  byRowid: Map<number, LightJob>;
  vocab: VocabEntry[];
  words: Map<string, number>;
  version: number;
}

let store: Store | null = null;
let lastCheck = 0;
let sourceMtime = 0;

const g = globalThis as unknown as { __radarStore?: Store | null; __radarMtime?: number };

function servePath(src: string, mtime: number): string {
  const dir = join(resolve(dataDir()), 'serve');
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, `radar-${Math.round(mtime)}.db`);
  if (!existsSync(dest)) {
    const tmp = `${dest}.${process.pid}.tmp`;
    copyFileSync(src, tmp);
    try {
      // rename is atomic; another worker may have won the race.
      renameSync(tmp, dest);
    } catch {
      rmSync(tmp, { force: true });
    }
  }
  return dest;
}

function cleanupServeDir(keep: string) {
  const dir = join(resolve(dataDir()), 'serve');
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (p !== keep && /^radar-\d+\.db$/.test(f) && Date.now() - statSync(p).mtimeMs > 10 * 60_000) rmSync(p, { force: true });
    }
  } catch {}
}

function open(src: string, mtime: number): Store {
  const file = servePath(src, mtime);
  const db = new Database(file, { readonly: true, fileMustExist: true });
  db.pragma('cache_size = -32000');
  db.pragma('mmap_size = 268435456');
  const meta = Object.fromEntries((db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const rows = db
    .prepare(
      `SELECT rowid, id, source, region_id AS regionId, city, work_types AS workTypes, tags, hourly_max AS hourlyMax, hourly_min AS hourlyMin,
        posted_ts AS postedTs, is_remote AS isRemote, company, lower(title) AS titleKey,
        (hourly_min IS NOT NULL) AS hasPay, (length(summary) > 0) AS hasSummary
       FROM jobs ORDER BY posted_ts DESC`,
    )
    .all() as LightJob[];
  for (const r of rows) {
    r.wt = r.workTypes.split(',').filter(Boolean);
    r.tg = r.tags.split(',').filter(Boolean);
  }
  for (const r of rows) r.dupKey = `${r.titleKey}|${(r.company || '').toLowerCase()}|${r.city || r.regionId || ''}`;
  const vocab = db.prepare('SELECT kind, term, display, count FROM vocab ORDER BY count DESC').all() as VocabEntry[];
  const words = new Map<string, number>();
  for (const v of vocab) if (v.kind === 'word') words.set(v.term, v.count);
  cleanupServeDir(file);
  return {
    db,
    file,
    builtAt: meta.built_at || '',
    total: Number(meta.total || rows.length),
    light: rows,
    byRowid: new Map(rows.map((r) => [r.rowid, r])),
    vocab,
    words,
    version: Date.now(),
  };
}

/** The current store, or null while no database is available yet. */
export function getStore(): Store | null {
  store = store ?? g.__radarStore ?? null;
  sourceMtime = sourceMtime || g.__radarMtime || 0;
  const now = Date.now();
  if (store && now - lastCheck < 5000) return store;
  lastCheck = now;
  const src = join(resolve(dataDir()), 'radar.db');
  if (!existsSync(src)) return store;
  try {
    const m = statSync(src).mtimeMs;
    if (!store || m !== sourceMtime) {
      const next = open(src, m);
      const old = store;
      store = next;
      sourceMtime = m;
      g.__radarStore = store;
      g.__radarMtime = m;
      if (old) setTimeout(() => old.db.close(), 30_000);
    }
  } catch (e) {
    console.error('[radar] failed to open database', e);
  }
  return store;
}
