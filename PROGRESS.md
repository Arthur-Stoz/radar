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

## Phase C — Search API + Home + Search + /job + /go (2026-10-19)

Done
- Search engine (`lib/search.ts`): query understanding into removable chips (place, pay, work type, tags; `lib/query.ts`),
  ~205 synonym groups incl. French/German/Spanish backpacker words (`lib/synonyms.ts`), FTS5 bm25 with column weights; the typed
  word matches anywhere, synonyms only in title/category (precision). Typo fallback: vocabulary spelling correction ("Showing results
  for …") then trigram index. Score = 0.50 relevance (bm25 + title hits) + 0.25 semantic + 0.10 freshness + 0.10 location + 0.05 completeness;
  duplicate collapse; max 3 in a row from one company. City with < 5 matches broadens to its region ("never a dead end").
- Facets with live counts (each ignores its own filter): region → town, work type, minimum hourly pay, posted within, perks, source.
  Typical pay line (p25–p75 + median of the results). Everything in the URL. 24 per page, infinite scroll + "Load more".
- `/api/search`, `/api/suggest` (titles, companies, places, "barista in Auckland" combos), `/api/job/[id]`, `/api/health`.
  `SEMANTIC_QUERY=on` embeds the query server-side (lazy, LRU, 1.5 s timeout); off by default.
- Home (faithful to `design/Radar.dc.html`): header, H1 with the 3 icon tiles, rotating placeholder, radar sweep on focus, real live line
  ("28,303 jobs from 7 sources · updated …"), quick chips that only show when they have results, "Fresh today" rail (real newest jobs;
  real place photos from the design when the town matches, otherwise the design's gradient + initial), "Browse by type" with real counts,
  dark footer with cropped wordmark. Honest subtitle built from the live sources (no Facebook/PickNZ claims).
- Search page in the same language (design boards "Dark Results", "Radar Mobile"): sticky compact bar, removable chips, count heading,
  filter pills with popovers (bottom panels on mobile), sort; desktop list + sticky 520 px preview (first result preselected);
  mobile bottom sheet (drag to close, browser Back closes it); seen jobs dimmed (sessionStorage); keyboard `/`, `J`/`K`, `Enter`, `Esc`, `O`.
- Preview / `/job/[id]`: title, company, place, normalized pay + original text, "Check pay rate" note under $23.95/h, type, posted, source,
  "Also on …", summary, highlights, tags, start of the ad, big "View on Seek ↗" (dynamic), copy link / Web Share; OG image (`next/og`);
  closed jobs say so and show similar live jobs; merged duplicates redirect to the canonical job; unknown ids → 404.
- `/go/[id]`: 302 to the untouched original URL, only for hosts known for that source (no open redirect); `?via=` for "Also on" links.
- Minimal `/about`, `/privacy`, `/status` (real per-source numbers), 404 (radar design), `robots.txt`, `sitemap.xml`.
- No third-party requests from the visitor's browser (no favicons/logos hotlinked; monograms instead).
- Performance on 28k jobs (local laptop): uncached p50 ≈ 30 ms, worst query ≈ 90 ms; cached 0 ms; autocomplete < 20 ms.

Relevance eval (`npm run eval`, real DB, top 10 per query): **30/30 passed (100 %)**

| Query | Results | Top-10 OK |
|---|---:|---:|
| barista auckland | 62 | 10/10 |
| fruit picking | 190 | 10/10 |
| kitchen hand no experience | 18 | 10/10 |
| software engineer remote | 147 | 9/10 |
| serveur queenstown (FR) | 31 | 10/10 |
| barrista auckand (typos → "barista") | 72 | 10/10 |
| chef wellington | 48 | 10/10 |
| nurse christchurch | 144 | 10/10 |
| truck driver | 1,432 | 10/10 |
| forklift | 735 | 10/10 |
| housekeeper queenstown | 51 | 10/10 |
| retail assistant part time | 582 | 10/10 |
| electrician / accountant auckland / teacher / caregiver | 753 / 784 / 751 / 1,177 | 10/10 each |
| labourer christchurch / data analyst / receptionist | 234 / 122 / 366 | 10/10 each |
| warehouse night shift / kellner (DE) / nanny / builder | 213 / 208 / 30 / 658 | 10/10 each |
| customer service / mechanic / dairy farm / $30 an hour | 2,962 / 1,817 / 531 / 6,821 | 10/10 each |
| plumber hamilton / policy advisor wellington / cleaner | 9 / 256 / 463 | 9/9, 10/10, 10/10 |

Left (next prompt, phases D–G)
- D: CV match (lens button, on-device reading + embedding worker, `/api/match`), optional Gemini rerank.
- E: polish (secondary pages are minimal), a11y audit, Lighthouse.
- F: GitHub Actions (ingest every 4 h + CI), release `data-latest`, runtime DB download/swap from `DATA_URL`, `DEPLOY_FR.md`, README.
- G: Playwright E2E at 1440/390, CV fixture case in the eval.

Known issues
- The app reads `DATA_DIR/radar.db` (copied to `DATA_DIR/serve/` before opening). Downloading from `DATA_URL` comes in phase F, so a fresh
  deploy currently shows "Loading jobs…" until a DB file is present.
- Seek listings without a fetched detail page show Seek's teaser + bullet points instead of the full description (filled over next runs).
