// Polite HTTP client (BUILD.md §3.3): ≤1 request/second per host, ≤2 in flight per host,
// exponential backoff on 429/5xx, honours Retry-After, conditional requests with a small disk cache.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { userAgent } from '../lib/config';

export interface FetchOpts {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** Use ETag / Last-Modified and the disk cache. */
  conditional?: boolean;
  /** Override the default bot UA (e.g. a site that needs browser-like headers). */
  userAgent?: string;
  retries?: number;
  timeoutMs?: number;
}

export interface HttpStats {
  requests: number;
  errors: number;
  notModified: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The site answered with a bot-protection challenge. Not retried, never bypassed. */
export class BlockedError extends Error {}

class HostGate {
  private next = 0;
  private inFlight = 0;
  private waiters: (() => void)[] = [];
  constructor(
    private minIntervalMs: number,
    private maxConcurrent: number,
  ) {}

  async acquire(): Promise<void> {
    while (this.inFlight >= this.maxConcurrent) await new Promise<void>((r) => this.waiters.push(r));
    this.inFlight++;
    const now = Date.now();
    const wait = Math.max(0, this.next - now);
    this.next = Math.max(now, this.next) + this.minIntervalMs;
    if (wait) await sleep(wait);
  }

  release(): void {
    this.inFlight--;
    this.waiters.shift()?.();
  }

  /** Push the next allowed start time (Retry-After / backoff). */
  delay(ms: number): void {
    this.next = Math.max(this.next, Date.now() + ms);
  }
}

export class Http {
  private gates = new Map<string, HostGate>();
  readonly stats: HttpStats = { requests: 0, errors: 0, notModified: 0 };
  private cacheDir: string;

  constructor(opts: { cacheDir: string; minIntervalMs?: number; maxConcurrent?: number }) {
    this.cacheDir = opts.cacheDir;
    if (!existsSync(this.cacheDir)) mkdirSync(this.cacheDir, { recursive: true });
    this.minIntervalMs = opts.minIntervalMs ?? 1000;
    this.maxConcurrent = opts.maxConcurrent ?? 2;
  }
  private minIntervalMs: number;
  private maxConcurrent: number;

  private gate(host: string): HostGate {
    let g = this.gates.get(host);
    if (!g) {
      g = new HostGate(this.minIntervalMs, this.maxConcurrent);
      this.gates.set(host, g);
    }
    return g;
  }

  private cachePaths(url: string, body?: string) {
    const key = createHash('sha1').update(url + (body || '')).digest('hex');
    return { meta: join(this.cacheDir, key + '.json'), body: join(this.cacheDir, key + '.body') };
  }

  async text(url: string, opts: FetchOpts = {}): Promise<{ status: number; text: string; fromCache: boolean; url: string }> {
    const u = new URL(url);
    const gate = this.gate(u.host);
    const retries = opts.retries ?? 4;
    const headers: Record<string, string> = {
      'user-agent': opts.userAgent || userAgent(),
      accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-NZ,en;q=0.9',
      ...opts.headers,
    };
    if (opts.body && !headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded';

    const paths = opts.conditional ? this.cachePaths(url, opts.body) : null;
    let cachedMeta: { etag?: string; lastModified?: string } | null = null;
    if (paths && existsSync(paths.meta) && existsSync(paths.body)) {
      try {
        cachedMeta = JSON.parse(readFileSync(paths.meta, 'utf8'));
        if (cachedMeta?.etag) headers['if-none-match'] = cachedMeta.etag;
        if (cachedMeta?.lastModified) headers['if-modified-since'] = cachedMeta.lastModified;
      } catch {
        cachedMeta = null;
      }
    }

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await gate.acquire();
      let res: Response | null = null;
      try {
        this.stats.requests++;
        res = await fetch(url, {
          method: opts.method || (opts.body ? 'POST' : 'GET'),
          headers,
          body: opts.body,
          redirect: 'follow',
          signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
        });
      } catch (e) {
        lastErr = e;
      } finally {
        gate.release();
      }

      if (res) {
        if (res.status === 304 && paths) {
          this.stats.notModified++;
          return { status: 200, text: readFileSync(paths.body, 'utf8'), fromCache: true, url: res.url || url };
        }
        if (res.status === 429 || res.status >= 500) {
          const ra = res.headers.get('retry-after');
          const raMs = ra ? (/^\d+$/.test(ra) ? parseInt(ra, 10) * 1000 : Math.max(0, Date.parse(ra) - Date.now())) : 0;
          const backoff = Math.max(raMs, 1000 * 2 ** attempt + Math.random() * 500);
          gate.delay(Math.min(backoff, 120_000));
          lastErr = new Error(`HTTP ${res.status} for ${url}`);
          await res.body?.cancel().catch(() => {});
          continue;
        }
        const text = await res.text();
        // Bot-protection challenges are never worked around: report them so the site can allow us.
        if ((res.status === 403 || res.status === 503) && (res.headers.get('cf-mitigated') === 'challenge' || text.includes('_cf_chl_opt'))) {
          this.stats.errors++;
          throw new BlockedError(`Blocked by ${u.host} bot protection (Cloudflare challenge). Ask the site to allow the RadarNZ user agent.`);
        }
        if (paths && res.ok) {
          const etag = res.headers.get('etag') || undefined;
          const lastModified = res.headers.get('last-modified') || undefined;
          if (etag || lastModified) {
            writeFileSync(paths.meta, JSON.stringify({ etag, lastModified }));
            writeFileSync(paths.body, text);
          }
        }
        if (!res.ok) this.stats.errors++;
        return { status: res.status, text, fromCache: false, url: res.url || url };
      }
      gate.delay(1000 * 2 ** attempt);
    }
    this.stats.errors++;
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async json<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
    const r = await this.text(url, { ...opts, headers: { accept: 'application/json', ...opts.headers } });
    if (r.status >= 400) throw new Error(`HTTP ${r.status} for ${url}`);
    try {
      return JSON.parse(r.text) as T;
    } catch {
      throw new Error(`Invalid JSON from ${url}: ${r.text.slice(0, 120)}`);
    }
  }
}

/** Run async work over items with a concurrency limit (host gates still apply). */
export async function pool<T>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}
