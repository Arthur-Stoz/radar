import Database from 'better-sqlite3';
import { TAG_LABELS } from '../lib/tags';
import { normTitle } from './dedup';
import type { Job } from './normalize';

export const SCHEMA_VERSION = 3;

export const SCHEMA = `
CREATE TABLE jobs (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  company_logo TEXT,
  image_url TEXT,
  image_kind TEXT,
  loc_raw TEXT,
  suburb TEXT,
  city TEXT,
  region TEXT,
  region_id TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  is_hybrid INTEGER NOT NULL DEFAULT 0,
  work_types TEXT NOT NULL DEFAULT '',
  category TEXT,
  pay_text TEXT,
  pay_min REAL,
  pay_max REAL,
  pay_period TEXT,
  hourly_min REAL,
  hourly_max REAL,
  below_min_wage INTEGER NOT NULL DEFAULT 0,
  posted_at TEXT,
  posted_ts INTEGER NOT NULL,
  expires_at TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  highlights TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '',
  also_on TEXT NOT NULL DEFAULT '[]',
  content_hash TEXT NOT NULL,
  has_detail INTEGER NOT NULL DEFAULT 0,
  missed INTEGER NOT NULL DEFAULT 0,
  raw TEXT
);
CREATE INDEX jobs_posted ON jobs(posted_ts DESC);
CREATE INDEX jobs_region ON jobs(region_id);
CREATE INDEX jobs_city ON jobs(city);
CREATE INDEX jobs_source ON jobs(source);
CREATE INDEX jobs_pay ON jobs(hourly_max);

CREATE VIRTUAL TABLE jobs_fts USING fts5(
  title, company, location, tags, category, description,
  content='', contentless_delete=1,
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE VIRTUAL TABLE jobs_trgm USING fts5(title, company, content='', contentless_delete=1, tokenize='trigram remove_diacritics 1');
CREATE TABLE source_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, checked_at TEXT NOT NULL);

CREATE TABLE vectors (rowid INTEGER PRIMARY KEY, v BLOB NOT NULL);

CREATE TABLE sources_status (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  homepage TEXT,
  kind TEXT,
  enabled INTEGER NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  last_run_at TEXT,
  last_success_at TEXT,
  pages INTEGER, details INTEGER, found INTEGER, new INTEGER, updated INTEGER, removed INTEGER, errors INTEGER,
  duration_ms INTEGER,
  active_jobs INTEGER NOT NULL DEFAULT 0,
  hosts TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE vocab (kind TEXT NOT NULL, term TEXT NOT NULL, display TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (kind, term)) WITHOUT ROWID;
CREATE INDEX vocab_term ON vocab(term);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;

CREATE TABLE expired (id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT, city TEXT, region_id TEXT, source TEXT NOT NULL, removed_at TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE aliases (id TEXT PRIMARY KEY, canonical_id TEXT NOT NULL) WITHOUT ROWID;
`;

export interface SourceStatusRow {
  id: string;
  name: string;
  homepage: string;
  kind: string;
  enabled: number;
  status: 'ok' | 'failed' | 'disabled' | 'partial';
  message: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  pages: number;
  details: number;
  found: number;
  new: number;
  updated: number;
  removed: number;
  errors: number;
  duration_ms: number;
  active_jobs: number;
  hosts: string;
}

const tagText = (tags: string[]) => tags.map((t) => `${t} ${TAG_LABELS[t as keyof typeof TAG_LABELS] || ''}`).join(' ');

export interface ExpiredRow {
  id: string;
  title: string;
  company: string | null;
  city: string | null;
  region_id: string | null;
  source: string;
  removed_at: string;
}

export function writeDb(
  file: string,
  jobs: Job[],
  vectors: Map<string, Int8Array>,
  statuses: SourceStatusRow[],
  meta: Record<string, string>,
  expired: ExpiredRow[] = [],
  cache: Map<string, { value: string; checkedAt: string }> = new Map(),
): void {
  const db = new Database(file);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.exec(SCHEMA);

  const ins = db.prepare(`INSERT INTO jobs (rowid,id,source,source_id,source_url,title,company,company_logo,image_url,image_kind,loc_raw,suburb,city,region,region_id,is_remote,is_hybrid,work_types,category,pay_text,pay_min,pay_max,pay_period,hourly_min,hourly_max,below_min_wage,posted_at,posted_ts,expires_at,first_seen,last_seen,description,summary,highlights,tags,also_on,content_hash,has_detail,missed,raw)
    VALUES (@rowid,@id,@source,@source_id,@source_url,@title,@company,@company_logo,@image_url,@image_kind,@loc_raw,@suburb,@city,@region,@region_id,@is_remote,@is_hybrid,@work_types,@category,@pay_text,@pay_min,@pay_max,@pay_period,@hourly_min,@hourly_max,@below_min_wage,@posted_at,@posted_ts,@expires_at,@first_seen,@last_seen,@description,@summary,@highlights,@tags,@also_on,@content_hash,@has_detail,@missed,@raw)`);
  const insFts = db.prepare('INSERT INTO jobs_fts (rowid,title,company,location,tags,category,description) VALUES (?,?,?,?,?,?,?)');
  const insTrgm = db.prepare('INSERT INTO jobs_trgm (rowid,title,company) VALUES (?,?,?)');
  const insVec = db.prepare('INSERT INTO vectors (rowid,v) VALUES (?,?)');

  db.transaction(() => {
    jobs.forEach((j, i) => {
      const rowid = i + 1;
      const posted = Date.parse(j.postedAt || j.firstSeen);
      ins.run({
        rowid,
        id: j.id,
        source: j.source,
        source_id: j.sourceId,
        source_url: j.sourceUrl,
        title: j.title,
        company: j.company,
        company_logo: j.companyLogo,
        image_url: j.imageUrl,
        image_kind: j.imageKind,
        loc_raw: j.location.raw,
        suburb: j.location.suburb,
        city: j.location.city,
        region: j.location.region,
        region_id: j.location.regionId,
        is_remote: j.location.isRemote ? 1 : 0,
        is_hybrid: j.location.isHybrid ? 1 : 0,
        work_types: j.workType.length ? `,${j.workType.join(',')},` : '',
        category: j.category,
        pay_text: j.pay.text,
        pay_min: j.pay.min,
        pay_max: j.pay.max,
        pay_period: j.pay.period,
        hourly_min: j.pay.hourlyMin,
        hourly_max: j.pay.hourlyMax,
        below_min_wage: j.pay.belowMinWage ? 1 : 0,
        posted_at: j.postedAt,
        posted_ts: Math.floor((Number.isFinite(posted) ? posted : Date.now()) / 1000),
        expires_at: j.expiresAt,
        first_seen: j.firstSeen,
        last_seen: j.lastSeen,
        description: j.description,
        summary: j.summary,
        highlights: JSON.stringify(j.highlights),
        tags: j.tags.length ? `,${j.tags.join(',')},` : '',
        also_on: JSON.stringify(j.alsoOn),
        content_hash: j.contentHash,
        has_detail: j.hasDetail ? 1 : 0,
        missed: j.missed,
        raw: JSON.stringify(j.raw),
      });
      const loc = [j.location.suburb, j.location.city, j.location.region, j.location.isRemote ? 'remote' : ''].filter(Boolean).join(' ');
      insFts.run(rowid, j.title, j.company || '', loc, `${tagText(j.tags)} ${j.workType.join(' ')}`, j.category || '', j.description || j.summary);
      insTrgm.run(rowid, j.title, j.company || '');
      const v = vectors.get(j.id);
      if (v) insVec.run(rowid, Buffer.from(v.buffer, v.byteOffset, v.byteLength));
    });

    const insS = db.prepare(`INSERT INTO sources_status VALUES (@id,@name,@homepage,@kind,@enabled,@status,@message,@last_run_at,@last_success_at,@pages,@details,@found,@new,@updated,@removed,@errors,@duration_ms,@active_jobs,@hosts)`);
    for (const s of statuses) insS.run(s);

    buildVocab(db, jobs);

    const insE = db.prepare('INSERT OR IGNORE INTO expired VALUES (@id,@title,@company,@city,@region_id,@source,@removed_at)');
    for (const e of expired) insE.run(e);
    const insA = db.prepare('INSERT OR IGNORE INTO aliases VALUES (?,?)');
    for (const j of jobs) for (const a of j.aliases) insA.run(a, j.id);

    const insC = db.prepare('INSERT INTO source_cache (key,value,checked_at) VALUES (?,?,?)');
    for (const [k, v] of cache) insC.run(k, v.value, v.checkedAt);

    const insM = db.prepare('INSERT INTO meta (key,value) VALUES (?,?)');
    for (const [k, v] of Object.entries(meta)) insM.run(k, v);
  })();

  db.exec("INSERT INTO jobs_fts(jobs_fts) VALUES('optimize'); INSERT INTO jobs_trgm(jobs_trgm) VALUES('optimize');");
  db.exec('ANALYZE');
  db.close();
}

/** Top titles, companies, places and title words with counts (autocomplete + spelling + CV skills). */
function buildVocab(db: Database.Database, jobs: Job[]): void {
  const count = (m: Map<string, { display: string; n: number }>, key: string, display: string) => {
    if (!key) return;
    const e = m.get(key);
    if (e) e.n++;
    else m.set(key, { display, n: 1 });
  };
  const titles = new Map<string, { display: string; n: number }>();
  const companies = new Map<string, { display: string; n: number }>();
  const places = new Map<string, { display: string; n: number }>();
  const words = new Map<string, { display: string; n: number }>();
  for (const j of jobs) {
    const t = normTitle(j.title);
    // Collapse decorations ("Barista - Ponsonby (Part time)") to the core title for suggestions.
    const core = j.title.split(/\s[-–|:(]\s?|\s\(/)[0].trim();
    if (core.length >= 3 && core.length <= 50) count(titles, normTitle(core), core);
    if (j.company) count(companies, j.company.toLowerCase(), j.company);
    if (j.location.city) count(places, j.location.city.toLowerCase(), j.location.city);
    if (j.location.region) count(places, `region:${j.location.regionId}`, j.location.region);
    for (const w of t.split(' ')) if (w.length >= 3 && !/^\d+$/.test(w)) count(words, w, w);
  }
  const ins = db.prepare('INSERT INTO vocab (kind,term,display,count) VALUES (?,?,?,?)');
  const top = (m: Map<string, { display: string; n: number }>, kind: string, min: number, limit: number) =>
    [...m.entries()]
      .filter(([, v]) => v.n >= min)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, limit)
      .forEach(([k, v]) => ins.run(kind, k, v.display, v.n));
  top(titles, 'title', 2, 6000);
  top(companies, 'company', 2, 4000);
  top(places, 'place', 1, 2000);
  top(words, 'word', 2, 20000);
}
