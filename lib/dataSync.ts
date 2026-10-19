import Database from 'better-sqlite3';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { dataDir } from './config';

// Runtime data sync (BUILD.md §2): on boot and every 10 minutes, download the latest radar.db.gz
// from DATA_URL (a GitHub release asset), using ETag / asset id so unchanged data is not re-downloaded,
// verify it, then atomically swap DATA_DIR/radar.db. lib/db.ts reopens when the file changes.
//
// DATA_URL: https://github.com/<owner>/<repo>/releases/download/<tag>/radar.db.gz
// DATA_TOKEN (private repo only): a fine-grained token with read-only "Contents" access.

const INTERVAL_MS = 10 * 60_000;
const g = globalThis as unknown as { __radarSync?: boolean };

interface SyncState {
  etag?: string;
  assetId?: number;
  updatedAt?: string;
  checkedAt?: string;
}

const dir = () => resolve(dataDir());
const statePath = () => join(dir(), 'data-state.json');
const log = (m: string) => console.log(`[radar:data] ${m}`);

function readState(): SyncState {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

/** Resolve DATA_URL to a download request (private repos go through the GitHub API with DATA_TOKEN). */
async function resolveDownload(url: string, token: string | undefined, state: SyncState): Promise<{ req: Request; key: string } | null> {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/?#]+)$/.exec(url);
  if (token && m) {
    const [, owner, repo, tag, name] = m;
    const api = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`;
    const res = await fetch(api, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'RadarNZ' } });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${api}`);
    const rel = (await res.json()) as { assets: { id: number; name: string; url: string; updated_at: string }[] };
    const asset = rel.assets.find((a) => a.name === name);
    if (!asset) throw new Error(`asset ${name} not found in release ${tag}`);
    const key = `${asset.id}:${asset.updated_at}`;
    if (state.assetId === asset.id && state.updatedAt === asset.updated_at) return null;
    return { req: new Request(asset.url, { headers: { authorization: `Bearer ${token}`, accept: 'application/octet-stream', 'user-agent': 'RadarNZ' } }), key };
  }
  const headers: Record<string, string> = { 'user-agent': 'RadarNZ' };
  if (state.etag && existsSync(join(dir(), 'radar.db'))) headers['if-none-match'] = state.etag;
  return { req: new Request(url, { headers, redirect: 'follow' }), key: '' };
}

export async function syncOnce(): Promise<boolean> {
  const url = process.env.DATA_URL;
  if (!url) return false;
  const d = dir();
  mkdirSync(d, { recursive: true });
  const state = readState();
  const plan = await resolveDownload(url, process.env.DATA_TOKEN, state);
  if (!plan) return false;
  const res = await fetch(plan.req);
  if (res.status === 304) {
    writeFileSync(statePath(), JSON.stringify({ ...state, checkedAt: new Date().toISOString() }));
    return false;
  }
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const tmp = join(d, `radar.download.${process.pid}.db`);
  rmSync(tmp, { force: true });
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createGunzip(), createWriteStream(tmp));

  // Verify before swapping: it must open and contain jobs.
  try {
    const db = new Database(tmp, { readonly: true, fileMustExist: true });
    const total = Number((db.prepare("SELECT value FROM meta WHERE key='total'").get() as { value: string } | undefined)?.value || 0);
    const rows = (db.prepare('SELECT COUNT(*) AS n FROM jobs').get() as { n: number }).n;
    db.close();
    if (!rows || !total) throw new Error('empty database');
  } catch (e) {
    rmSync(tmp, { force: true });
    throw new Error(`downloaded database is invalid: ${(e as Error).message}`);
  }
  renameSync(tmp, join(d, 'radar.db'));
  const next: SyncState = { checkedAt: new Date().toISOString() };
  const etag = res.headers.get('etag');
  if (etag) next.etag = etag;
  if (plan.key) {
    const [id, updatedAt] = plan.key.split(/:(.+)/);
    next.assetId = Number(id);
    next.updatedAt = updatedAt;
  }
  writeFileSync(statePath(), JSON.stringify(next));
  log(`new database installed (${Math.round(statSync(join(d, 'radar.db')).size / 1e6)} MB)`);
  return true;
}

/** Start the background loop once per process. */
export function startDataSync() {
  if (g.__radarSync || !process.env.DATA_URL) return;
  g.__radarSync = true;
  const tick = async () => {
    try {
      await syncOnce();
    } catch (e) {
      log(`sync failed: ${(e as Error).message}`);
    }
    // Warm the caches so the first visitor gets a fast page.
    try {
      const { getHomeData } = await import('./home');
      getHomeData();
    } catch {}
  };
  void tick();
  setInterval(tick, INTERVAL_MS).unref();
}
