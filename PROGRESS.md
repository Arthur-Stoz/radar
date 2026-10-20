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

## Phase D — CV match (2026-10-19)

Done
- Lens button (document + sparkle, "Match with your CV") at the right of every search bar; popover with drop zone
  ("Drop your CV (PDF, DOCX or TXT)"), "or paste it", and "Read on your device. Never uploaded."; dropping a file anywhere on Home or
  Search also works (full-page drop overlay).
- On-device reading: pdf.js (text layer; scanned PDFs → clear message + paste box), mammoth (DOCX), plain text; 5 MB max.
- Module Web Worker (`public/cv-worker.js`) runs the same MiniLM model in the browser with a progress bar
  ("Getting the matcher ready… 12 MB / 23 MB · only the first time"), then cached by the browser. **Everything is self-hosted**
  (`scripts/prepare-assets.mjs` copies transformers.js + ONNX wasm, the model, pdf.js and mammoth into `public/` before dev/build) —
  no CDN, no third-party request.
- Rule-based profile (`lib/profile.ts`): job titles (built-in list + real top titles from `/api/vocab`), ~45 skill groups, languages,
  licences/certificates (driver licence classes, forklift, WTR, first aid, Site Safe, LCQ, barista, food safety…), visa hints.
  Chips are editable (remove/add) + "Where do you want to work?" region picker.
- `POST /api/match { vector, chips, q, filters }` — the CV text is never sent. Two-stage scoring: cosine over every candidate, then chip
  overlap on the best 400: `0.60·cosine + 0.25·chip overlap + 0.15·bm25 (if q) + 0.05·freshness`, calibrated to a 0–100 "92% match" pill,
  plus "why" chips ("Matches your: Barista · French"). Works alone or combined with a typed query and all filters.
  Vector + chips live in `sessionStorage` only; "Clear CV" removes them.
- Optional AI rerank (`lib/rerank.ts`) when `GEMINI_API_KEY` is set: only chips + top-30 titles/summaries are sent to
  `gemini-3.5-flash-lite` (free tier, checked on ai.google.dev 2026-10-19; override with `GEMINI_MODEL`), 2.5 s timeout, cached by hash,
  silent fallback to the local ranking on any error.
- New sources enabled at the owner's request (written permission): PickNZ (97 live), jobs.co.nz (274), SeasonalJobs NZ (173) — real
  run on 2026-10-19. Backpacker Board is enabled but blocked by its Cloudflare bot challenge (403); Radar reports it on /status and never
  bypasses it.

Known issues
- First CV match on a device downloads ~23 MB of model + ~20 MB of runtime (compressed much smaller by the server); later uses are instant.

## Phase E — Polish, a11y, performance (2026-10-19)

Done
- Global error page, search loading skeleton, "Skip to content" link, `id="main"` landmarks on every page, `?` keyboard-shortcuts dialog
  (design board "Shortcuts"), card titles as `h2` (heading order), accessible names = visible text, decorative footer wordmark as SVG.
- Performance: CV panel + CV reader load only when the lens is opened (−44 KB on first load), "Fresh today" rail rendered on the server,
  keyboard help and drop overlay loaded after hydration, modern `browserslist` (fewer polyfills), search result cache (LRU) and
  bit-mask facets (p95 ≈ 90 ms uncached on 28k jobs).
- `/search` with no filters is indexable; filtered permutations are not.
- Lighthouse script (`node scripts/lighthouse.mjs <url>`, median of 3, mobile): **Accessibility 100, Best Practices 100, SEO 100** on
  `/`, `/search?q=barista`, `/search`, `/about`. Performance on this laptop: 77–96 depending on load — the host is slow
  (Lighthouse benchmarkIndex 802, below its reference device), and ~650 ms of the simulated blocking time is React/Next itself.
  Performance is re-measured on the GitHub runner in CI (phase F/G).

## Phase F — CI, release pipeline, runtime sync, deploy docs (2026-10-19)

Done
- Runtime data sync (`lib/dataSync.ts`, started by `instrumentation.ts`): on boot and every 10 min, downloads `radar.db.gz` from `DATA_URL`
  (ETag; GitHub API + `DATA_TOKEN` for a private repo), verifies it, swaps it atomically; caches are warmed. An empty data dir shows
  "Loading jobs…" and refreshes itself. `/api/health` → `{ ok, dbBuiltAt, jobs }`.
- `ingest.yml`: cron every 4 h + manual run, concurrency group, 60-min timeout (ingest has its own 50-min budget: details stop 15 min
  before, embeddings 4 min before), Node 22, npm + model cache, downloads the previous DB, −40 % safety check, `gh release upload
  data-latest --clobber`, per-source summary table.
- `ci.yml`: typecheck, lint, unit tests, `npm ci && npm run build` on ubuntu-latest Node 22; then a second job starts the app **with only
  `DATA_URL`** and runs the relevance eval, Playwright (1440/390) and Lighthouse.
- Repo **https://github.com/Arthur-Stoz/radar** (public, commits authored with the GitHub no-reply address), `data-latest` release.
- Seek details now come from the site's GraphQL JSON endpoint (its HTML job pages are Cloudflare-challenged from GitHub's IPs);
  a source stops asking after 5 bot-protection answers in a row. Bot protection is never bypassed (Backpacker Board stays blocked).
- `README.md`, `DEPLOY_FR.md` (Hostinger, step by step), `GUIDE_FR.md` (complete product guide), `PITCH_FR.md`.

Runs on GitHub (2026-10-19): Ingest ×3 green (2 manual, 1 **scheduled**), CI green. Latest published data: **28,550 live jobs** —
Seek 16,431 · Trade Me 9,494 · NZ Government Jobs 1,706 · Ashby 199 · Greenhouse 113 · Lever 48 · SmartRecruiters 17 · jobs.co.nz 272 ·
SeasonalJobs NZ 173 · PickNZ 97 · Backpacker Board 0 (blocked) · Workable 0 · Facebook off. Expiry works (e.g. Trade Me −150 in one run).

## Phase G — Tests, eval, E2E (2026-10-19)

- Unit + connector tests: **110 passing** (pay ×35 real strings, places, query parser, synonyms, tags, dedup, CV profile, connectors on
  trimmed real fixtures incl. jobs.co.nz and SeasonalJobs).
- Relevance eval: **31/31 (100 %)** locally and on the CI runner, incl. the CV fixture case (hospitality roles dominate the top 10).
- Playwright: **21 passing** at 1440 px and 390 px (+1 mobile-only test skipped on desktop): home, autocomplete → results → preview →
  "View on …" href, `/go` 302 + no open redirect, filters/sort in URL, typo + chip removal, **CV PDF upload → match pills, and a check
  that no request ever contains CV text**, mobile sheet + Back, dark mode, `/job/[id]` + OG image, 404, `/status`, `/api/health`.
- Lighthouse on the GitHub runner (mobile, median of 3): `/` 97 · 100 · 100 · 100, `/search?q=barista` 97 · 100 · 100 · 100,
  `/search` 97 · 100 · 100 · 100 (Performance · Accessibility · Best practices · SEO).

### Definition of done
- [x] `npm ci && npm run build && npm start` on a clean Linux Node 22 machine with only `DATA_URL` set (CI job "e2e").
- [x] Real jobs from Seek, Trade Me and every allowed Tier B source; counts on `/status` (Backpacker Board: blocked by its bot protection).
- [x] Every job opens the correct original ad (`/go` tested; host allow-list).
- [x] Search, filters, sort, autocomplete, typo fallback, synonyms; URL state shareable.
- [x] CV match on the device (text never leaves it — asserted in E2E), alone or with a query.
- [x] Desktop + mobile in the design language; dark mode; AA; Lighthouse ≥ 90.
- [x] Ingest workflow green and publishing every 4 h; CI green.
- [x] Eval ≥ 90 %; unit and E2E tests green.
- [x] No fake data in production.

Left / ideas
- Ask Backpacker Board to allow `RadarNZ/1.0` (or GitHub Actions IPs). More ATS companies (`ingest/ats-companies.json`).
- Hostinger setup itself is a manual step for the owner (DEPLOY_FR.md); `SITE_URL` / `CONTACT_EMAIL` to fill once the domain is known.

## Phase H — Production fixes and UI pass (2026-10-20)

Done
- **CV upload failed on every file in production.** Real cause: the readers and the model were served from `public/vendor` and
  `public/models`, two git-ignored folders that only `npm run build`'s `prebuild` hook (`scripts/prepare-assets.mjs`) creates. A host that
  runs `next build --webpack` directly skips npm's `pre*` hooks, so `/vendor/pdfjs/pdf.min.mjs`, `/vendor/mammoth.browser.min.js`,
  `/vendor/transformers/*` and `/models/*` all answered 404 (reproduced locally with a Hostinger-like build), and the generic catch showed
  "Something went wrong". Fix: `app/cv-assets/[...path]` serves pdf.js, mammoth, transformers.js + ONNX wasm from `node_modules` at
  runtime (allow-listed paths, correct MIME types) and the MiniLM model from `public/models`, the ingest cache, or a one-time server-side
  download into `DATA_DIR/models`. `build` is now `next build --webpack`.
- Precise CV errors (file size, unsupported type, scanned PDF, password-protected / damaged PDF, reader not loaded, old .doc); the real
  error is logged to the console (`[cv] …`). A module worker that fails to start is now detected (it used to hang). If the model cannot
  load, the CV still works: chips-only matching (`/api/match` accepts `vector: null`; FTS on the chip terms stands in for the cosine) with
  a note in the panel. E2E: PDF, DOCX, TXT, paste with the model blocked, error messages.
- **Floating layers**: every popover, menu, autocomplete list, CV panel and bottom sheet now renders in a portal on `<body>`
  (`components/Floating.tsx`: anchored positioning that flips above / clamps to the viewport and follows scroll; shared outside-click / Esc).
  Z-indexes come from one scale (`--z-*` in `globals.css`). Cause of the CV panel under the cards on Home: the hero is an `isolate z-0`
  stacking context and the "Fresh today" section (`z-[1]`) painted over anything inside it.
- Phones: the decorative radar sweep (1040 px) widened the layout viewport to 715 px on a 390 px phone (pages zoomed out, bottom panels
  off-screen). Clipped (`overflow-x: clip` on the hero and `html`).
- **Region filter did nothing**: region and town facets shared ids ("auckland", "wellington"…), so ticking a region removed it again.
  Towns that collide now use `<slug>-city`. Active filters show as removable chips. `/job/[id]` breadcrumb region links were built from the
  name ("hawke-s-bay", "manawat-whanganui") and did not filter: now region ids. E2E covers region, town, type, pay, posted, perks, source.
- **Sort** is a custom menu (`components/Dropdown.tsx`: listbox, arrows/Home/End/Enter/Esc, checked option, outside click, light + dark);
  the CV panel's region `<select>` uses it too. Mobile filter sheets have a sticky "Done" header.
- **Home**: "Free · No account" removed; hero tightened and the bar is ~15–20 % bigger (74 px, 22 px text, 840 px max). Spacing and hero
  sizes are tokens (`--space-*`, `--hero-*` in `globals.css`); the title scales with the window height. Search bar centre vs screen centre:
  1440×800 → 427/400, 1366×768 → 418/384, 390×844 → 380/422 (asserted in E2E: within 15 %).
- **Job pictures**: `image_url` + `image_kind` ('photo' | 'logo') in the DB, URL only. Order: the ad's own photo (Trade Me listing photo
  at "full" size or ad banner; Seek branded-ad cover; JSON-LD `image`), else the company logo (Seek/Trade Me branding, JSON-LD
  `hiringOrganization.logo`, PickNZ employer logo, ATS og:image per company), else nothing. Site-wide defaults (a picture shared by 3+
  companies of one source, e.g. a board's og:image) are dropped. Seek covers: brand id from the logo URL, checked on the branding gateway
  (`/jdpCover` redirect vs 404) at 1 req/s within `IMAGE_BUDGET` (default 1500/run) plus the GraphQL details; results cached in the new
  `source_cache` table for 30 days. Cards: 56–64 px thumbnail (photo cover / logo contained on white), rail: photo at the top, preview and
  `/job`: 16:7 photo banner or logo tile; lazy, `referrerPolicy="no-referrer"`, fixed boxes (CLS 0), monogram fallback on error.
  The app still reads older DBs without the columns. No image proxy.

Local ingest 2026-10-20 (29,822 live jobs, 59 min, 3,000 Seek brands checked of 6,212): jobs with a picture —
Seek 79 % (9,706 photos + 3,767 logos) · Trade Me 66 % (5,186 + 1,401) · Greenhouse 96 % · Lever 100 % · Ashby 99 % ·
SmartRecruiters 86 % · PickNZ 78 % · NZ Government Jobs, jobs.co.nz, SeasonalJobs NZ 0 % (their pages carry no per-ad picture or logo:
only site defaults / "no logo" placeholders). Overall 69 %.

Tests: unit 115 · E2E 37 passed at 1440/390 (+1 mobile-only skip) · eval 31/31 · typecheck, lint, `npm run build` (webpack) clean.

Left
- Seek covers fill in over the next runs (1,500 brands per run; 6,212 brands in all).
- jobs.co.nz employer logos are 32 px favicons (not used); NZ Government Jobs has no logos in its pages.
