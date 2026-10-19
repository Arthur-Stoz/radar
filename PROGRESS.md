# Radar — progress log

Each phase appends an entry: what's done, what's left, known issues.

## Phase A — Scaffold (2026-10-19)

Done
- Next.js 16 (App Router) + TypeScript + Tailwind v4, npm, Node 22 (`.nvmrc`, `engines`).
- Design tokens from BUILD.md §7.1 as CSS variables (`app/globals.css`), light + derived dark theme.
  Theme follows the system, with a manual toggle (system → light → dark) stored in `localStorage`, applied before paint.
- Geist / Geist Mono via the `geist` package. Layout, logo, footer (cropped wordmark as in the design export).
- Design export unzipped in `design/` (the zip held 18 boards: Home, Results, Job page, Status, 404, Mobile, Dark…).
  Photos/icons converted to small WebP in `public/assets/` (4.7 MB → 0.7 MB).
- Scripts: dev, build, start (`$PORT`), ingest, test, e2e, eval, typecheck, lint. ESLint flat config, Vitest.
- `git init`.

Left
- Everything from phase B on.

Known issues
- None.

## Phase B — Ingest (2026-10-19)

Done
- `ingest/` (Node TS, run with `npm run ingest`): polite HTTP client (≤1 req/s and ≤2 in flight per host, backoff on 429/5xx,
  Retry-After, ETag cache), source registry with `enabled` / `DISABLED_SOURCES` / `ENABLED_SOURCES`.
- Connectors: Seek (frontend JSON search API, partitioned region → classification → work type; detail pages for new listings only,
  `DETAIL_BUDGET` per run), Trade Me (frontend JSON search, full descriptions, optional official API keys), jobs.govt.nz (incl. Te Whatu Ora),
  Greenhouse / Lever / SmartRecruiters / Workable / Ashby (`ingest/ats-companies.json`, NZ jobs only).
  Built but disabled (terms require written permission): Backpacker Board, PickNZ. Facebook: empty, disabled (no feed exists).
  Decisions per source in `ingest/SOURCES.md`.
- Normalization (`lib/`): gazetteer (16 regions, ~230 towns/districts, ~330 suburbs, macron-insensitive), pay parser (hourly/annual/daily,
  below-minimum-wage flag at $23.95), 12 rule-based tags with negation guards, work types, extractive summary, highlights from source bullets.
- Cross-source dedup (exact key or trigram ≥ 0.85, same city, 30 days) with `alsoOn` + `aliases` table; expiry (2 missed successful runs,
  60-day cap, closing date), `expired` table (60 days) so old links can say "closed".
- Embeddings: `Xenova/all-MiniLM-L6-v2` q8 (23 MB, 384-d), Int8 vectors, reused when `contentHash` is unchanged.
- SQLite build: `jobs`, `jobs_fts` (porter, diacritics removed, weighted columns), `jobs_trgm` (trigram), `vectors`, `sources_status`,
  `vocab`, `meta`, `expired`, `aliases`; atomic swap; `radar.db.gz` + `manifest.json`; safety check (−40 %).
- `OFFLINE=1 npm run ingest` rebuilds the DB from the previous one without any request (for parser/schema changes).
- Tests: pay (35 real strings), locations, tags, dedup, connectors on saved trimmed fixtures (99 tests).

**Real full ingest, run locally on 2026-10-19 (80 min, 4,490 requests):**

| Source | Listings found | Live after dedup | Detail pages fetched |
|---|---:|---:|---:|
| Seek | 17,580 (of ~17,900 announced) | 16,395 | 2,000 (rest deferred to next runs; teaser + bullets meanwhile) |
| Trade Me | 9,749 | 9,678 | n/a (full text in listing) |
| NZ Government Jobs | 1,959 | 1,839 | 1,959 |
| Greenhouse (Rocket Lab, Pushpay, Dawn Aerospace…) | 121 | 117 | n/a |
| Ashby (Xero, Halter, ZURU…) | 205 | 204 | n/a |
| Lever (Foodstuffs, KPMG NZ) | 49 | 48 | n/a |
| SmartRecruiters (Air New Zealand) | 24 | 22 | 24 |
| Workable | 0 (no NZ company found yet) | 0 | — |
| **Total** | **29,687** | **28,303** (1,384 duplicates merged) | |

DB 121 MB, gzip 52 MB.

Left
- Seek descriptions: only 2,000 of ~16k have the full text after one run; each 4-hour run adds `DETAIL_BUDGET` more (≈ 1.5 days to full coverage).
- More ATS companies; councils/universities (they use other ATS); Backpacker Board / PickNZ need written permission.

Known issues
- Embedding all jobs from scratch takes ~35 min on a laptop CPU (12–14/s); later runs only embed new/changed jobs.
  Tokenizer now capped at 256 word pieces (MiniLM's training length) to speed this up.
