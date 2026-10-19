# RADAR — Build brief (v2, from scratch)

You are building **Radar**: a free, no-account search engine for every job in New Zealand. Read this whole file before writing code. It is the single source of truth. The owner (Arthur) is not a developer and speaks French: work autonomously, and write your final report to him in French.

---

## 0. How you work

- Work autonomously. No approval stops, no subagents, no review loops. Only stop to ask if something is truly blocking (e.g. `gh` not authenticated).
- Follow the phases in §10. After each phase: run tests, commit, and append a short entry to `PROGRESS.md` (what's done, what's left, known issues). If the session ends early, the next session resumes from `PROGRESS.md`.
- Never invent data. No fake jobs, counts, logos, testimonials or stats in production. A dev-only seed is allowed only if the network is unavailable, and it must be impossible to ship.
- If a source fails, log it, skip it, keep going. One broken source must never break ingest or the site.
- Keep dependencies few and boring. Prefer the platform.
- UI copy is English. Code comments English.

---

## 1. The product

One job: help anyone find the right NZ job, fast. Type what you want (or drop your CV), get the most relevant real listings from every source, click one to see a clean summary, click "View on Seek ↗" (or Trade Me, etc.) to apply on the original site.

What Radar is NOT: no accounts, no login, no employer posting, no applying on Radar, no admin panel, no ads, no newsletter, no tracking cookies.

Principles:
1. **Relevance above everything.** Every result on page 1 must deserve to be there.
2. **Instant.** Results feel immediate. No spinners longer than a blink.
3. **Minimal and beautiful.** Mobbin-level restraint. Lots of white, one accent, perfect type.
4. **Honest.** Real data, real counts, clear source on every job, freshness shown.
5. **Private.** The CV is read on the user's device and never uploaded.

---

## 2. Architecture (zero third-party accounts)

Only GitHub + Hostinger, which the owner already has.

```
GitHub Actions (cron every 4h)            Hostinger Node.js Web App (Next.js)
  ingest/ (Node TS)                          on boot + every 10 min:
   ├─ fetch all enabled sources               download latest radar.db.gz (ETag)
   ├─ normalize, parse pay/location           atomic swap, reopen read-only
   ├─ dedup, expire                         serves / , /search, /job/[id], /go/[id], /api/*
   ├─ embeddings (local model, no API)      SQLite FTS5 + vector scoring in-process
   └─ build radar.db (SQLite) → gzip
        └─ upload to GitHub Release "data-latest" (radar.db.gz + manifest.json)
```

Why this shape:
- No database service, no search service, no AI service → no accounts to create.
- Hostinger redeploys on every push to `main`, so **data is never committed to `main`**; it lives in a GitHub Release asset that the app pulls at runtime.
- Ingest can also run locally: `npm run ingest` writes `./.data/radar.db` directly (used in development and as a fallback).

Stack:
- Next.js (App Router) + TypeScript + Tailwind CSS. **npm** (Hostinger detects it). Node 22 (`.nvmrc`, `engines`).
- SQLite via `better-sqlite3` (prebuilt linux-x64). If it fails to install on a clean Ubuntu Node 22 runner, switch to built-in `node:sqlite` (verify FTS5 is available).
- Embeddings: `@huggingface/transformers` (ONNX, runs in Node and in the browser). One small English sentence-embedding model, ≤ ~35 MB quantized (e.g. `Xenova/bge-small-en-v1.5` or `Xenova/all-MiniLM-L6-v2`; pick one, document why, use the same one everywhere).
- PDF/DOCX reading in the browser: `pdfjs-dist`, `mammoth`.
- Fonts: Geist / Geist Mono via the `geist` package.
- Tests: Vitest, Playwright.
- The app must listen on `process.env.PORT`. Data dir `process.env.DATA_DIR` (default `./.data`).

Env vars (all optional except DATA_URL in prod):
- `DATA_URL` — URL of `radar.db.gz` in the `data-latest` release.
- `DATA_TOKEN` — only if the repo is private (fine-grained token, read-only Contents).
- `CONTACT_EMAIL` — shown on /about and in the bot User-Agent.
- `SITE_URL` — public base URL (for sitemap, OG).
- `GEMINI_API_KEY`, `GEMINI_MODEL` — optional AI rerank (§6.4). Everything works without them.
- `SEMANTIC_QUERY` — `on|off` (§5.4).
- `DISABLED_SOURCES` — comma list of source ids to turn off instantly.

---

## 3. Sources

All connectors live in `ingest/sources/<id>.ts` and implement one interface:

```ts
interface Source {
  id: string; name: string; homepage: string;
  enabled: boolean;
  kind: 'site' | 'ats' | 'feed';
  fetchListings(ctx): AsyncIterable<RawJob>;   // paginated, rate-limited
}
```

Registry in `ingest/sources/index.ts`. Each source can be disabled with `enabled:false` or `DISABLED_SOURCES`.

### 3.1 Tier A — owner holds written permission
The owner states he has written permission from **Seek NZ** and **Trade Me Jobs** to collect their listings. Build full connectors for both:
- Investigate each site first (sitemaps, the JSON the site's own frontend calls, `JobPosting` JSON-LD on detail pages). Prefer structured data over HTML parsing. Use Playwright only if nothing else works, and avoid it in CI if possible.
- Goal: the full active NZ catalogue of each site (all categories, all regions), with detail pages for description and pay.
- Trade Me also has an official API; if the owner later provides API keys, add an API mode behind env vars.

**Facebook: create the connector file but keep it disabled.** Since Meta removed the Groups API (2024) and Facebook Jobs was shut down, job posts only exist inside groups and Marketplace behind a login. There is no feed to read without automating a personal account, which we will not do. Leave a comment explaining this; it can be enabled if Meta provides an official feed.

**LinkedIn: excluded** (owner's choice).

### 3.2 Tier B — public sources, no account needed
Before enabling each one, read its `robots.txt` and terms. Enable only if collection is allowed. Record the decision in `ingest/SOURCES.md` (one line per source: allowed? method? notes).
- Backpacker Board (NZ jobs), PickNZ, Work the Seasons (seasonal/horticulture — key for working-holiday users).
- NZ public sector: jobs.govt.nz and similar government listings, councils, universities, Te Whatu Ora / health careers if they expose public listings.
- Any other NZ job board you find that allows it.
- **Public ATS job boards** (company career pages, public JSON, no key):
  - Greenhouse `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
  - Lever `https://api.lever.co/v0/postings/{slug}?mode=json`
  - SmartRecruiters `https://api.smartrecruiters.com/v1/companies/{id}/postings`
  - Workable `https://apply.workable.com/api/v1/widget/accounts/{slug}`
  - Ashby `https://api.ashbyhq.com/posting-api/job-board/{name}`
  Build `ingest/ats-companies.json`: research companies hiring in NZ that use these ATS, verify each slug returns jobs, keep only jobs located in NZ (or NZ-remote).
- Do not include Indeed, LinkedIn, or any site whose terms forbid collection without permission.
- Do not use Adzuna/Jooble: they need accounts and mostly duplicate Seek/Trade Me.

### 3.3 Etiquette (all sources)
- User-Agent: `RadarNZ/1.0 (+${SITE_URL}/about; ${CONTACT_EMAIL})`.
- Max 1 request/second per domain, concurrency 2, exponential backoff on 429/5xx, honour `Retry-After`, conditional requests (ETag/Last-Modified) where possible.
- Only fetch detail pages for new or changed listings.
- Log per source: pages fetched, jobs found, new, updated, removed, errors, duration → stored in `sources_status`.

---

## 4. Normalization and data

### 4.1 Job record
`id` (stable hash of source+sourceId), `source`, `sourceUrl` (the original ad = apply link), `title`, `company`, `companyLogo?`, `location {raw, suburb, city, region, isRemote, isHybrid}`, `workType[]` (full-time, part-time, casual, contract, temp, seasonal, internship), `category`, `pay {text, min, max, period, hourlyMin, hourlyMax}`, `postedAt`, `expiresAt?`, `firstSeen`, `lastSeen`, `description` (clean text, max 8k chars), `summary` (≤ 280 chars), `highlights[]` (≤ 3), `tags[]`, `alsoOn[] {source, url}`, `contentHash`.

### 4.2 Parsing
- **Location**: gazetteer of the 16 NZ regions, all towns > 1,000 people, and Auckland/Wellington/Christchurch suburbs → city + region. Macron-insensitive (Whangārei = Whangarei, Ōtautahi = Christchurch, Tāmaki Makaurau = Auckland).
- **Pay**: parse "$25–$30 per hour", "$28/hr", "$60k–$70k", "$65,000 + super", "Competitive" (→ null). Annual → hourly ÷ 2080. Daily → ÷ 8. Store raw text too. If hourlyMax < 23.95 (NZ adult minimum wage since 1 April 2026), add internal flag `belowMinWage` (show a discreet "Check pay rate" note, never accuse).
- **Summary**: extractive, no AI: the 1–2 most informative sentences of the description (skip boilerplate like "About us", EEO statements), cleaned, ≤ 280 chars. Use listing bullet points as `highlights` when the source has them.
- **Tags** (rule-based, multi-word patterns, unit-tested): `whv-friendly` (working holiday / backpackers welcome / all visas), `no-experience`, `student-friendly`, `accommodation`, `transport-provided`, `visa-sponsorship`, `remote`, `weekend`, `night`, `immediate-start`, `seasonal`, `driver-licence`.
- **Dedup across sources**: same normalized title + company + city, or trigram similarity ≥ 0.85 on title+company within the same city and 30 days → one canonical job (richest data wins), others go to `alsoOn`.
- **Expiry**: a job not seen in 2 consecutive successful runs of its source is removed. Hard cap: 60 days after `firstSeen`.

### 4.3 Embeddings
- Text = title + company + city + summary + first 1,500 chars of description.
- Computed at ingest with the chosen model, L2-normalized, stored as Float32 (or Int8 quantized) BLOB. Reuse from the previous DB when `contentHash` is unchanged (download the previous release DB at the start of each run). Cache the model in Actions.

### 4.4 SQLite
Tables: `jobs`, `jobs_fts` (FTS5, porter + unicode61 remove_diacritics; columns weighted title 10, company 3, location 3, tags 2, description 1), `jobs_trgm` (FTS5 trigram tokenizer on title + company, for typos), `vectors`, `sources_status`, `vocab` (top titles, companies, places with counts — powers autocomplete and CV skill detection), `meta` (built_at, version, total).

### 4.5 Safety on publish
If total active jobs drop more than 40% versus the previous release, do not publish; fail the run loudly. Publish even if some sources failed.

---

## 5. Search and ranking

### 5.1 Query understanding
Parse free text into removable chips: location ("auckland", "queenstown", "near ponsonby"), pay ("$30", "30/h", "60k+"), work type ("part time", "casual", "seasonal"), tags ("no experience", "backpacker", "whv", "remote", "accommodation"). The rest is keywords.

Synonyms (`lib/synonyms.ts`, ~200 groups, unit-tested), e.g. barista↔coffee; chef↔cook; kitchen hand↔KP↔dishwasher; waiter↔waitress↔wait staff↔server; hospo↔hospitality; fruit picking↔picker↔harvest↔orchard; labourer↔labour; dev↔developer↔software engineer; retail assistant↔shop assistant↔sales assistant; nanny↔au pair; housekeeper↔room attendant. Include common French/German/Spanish words used by backpackers (serveur→waiter, cueillette→fruit picking, vendeur→retail, Kellner→waiter, camarero→waiter).

Typos: if FTS returns < 10 results, fall back to the trigram index and show "Showing results for *barista*".

### 5.2 Ranking (starting weights, then tune with §9.3)
`score = 0.50·bm25(norm) + 0.25·semantic + 0.10·freshness + 0.10·location match + 0.05·completeness (has pay, has summary)`; collapse duplicates; light diversity (max 3 consecutive from same company).

Sorts: Best match (default), Newest, Highest pay.

### 5.3 Filters (with live counts)
Location (region → city, multi-select), work type, minimum hourly pay, posted within (24h / 3 days / 7 days / 30 days), tags (Working holiday friendly, No experience, Accommodation, Remote), source.

Everything in the URL (`/search?q=barista&loc=auckland&type=part-time&pay=25&posted=7d&sort=new`) so any search is shareable. 24 results per page, infinite scroll with a "Load more" fallback.

### 5.4 Semantic text queries
If `SEMANTIC_QUERY=on`, the server embeds the query with the same model (lazy-loaded, LRU cache) and blends it into the score. Measure memory: if the process exceeds ~600 MB RSS on Hostinger, default to off. When off, semantic is used only for CV matching.

### 5.5 Autocomplete
From `vocab`: titles, companies, places, plus "in Auckland"-style completions. Under 50 ms. Keyboard navigable.

### 5.6 Empty and edge states
Never a dead end: suggest removing the most restrictive filter, broadening the location, or related searches. Zero-query `/search` shows the newest jobs nationwide.

Performance target: p95 API < 150 ms with 50k jobs.

---

## 6. CV match (the "lens" button)

### 6.1 Entry point
A button at the right end of the search bar (document + sparkle icon, tooltip "Match with your CV"), like Google Lens in the Google search bar. Click → small popover: drop zone "Drop your CV (PDF, DOCX or TXT)" + "or paste it". Dropping a file anywhere on Home or Search also works. Under it, one line: *"Read on your device. Never uploaded."*

### 6.2 On the device
- Read text in the browser (`pdfjs-dist`, `mammoth`, plain text). Max 5 MB. If a PDF has no text layer (scanned), say so and offer the paste box. No OCR in v1.
- A Web Worker loads the embedding model (first time: progress bar "Getting the matcher ready… 12 MB / 30 MB"; then cached), splits the CV into chunks, embeds them, keeps a normalized mean vector.
- Rule-based profile extraction (no AI): job titles and skills matched against `vocab` + a skills dictionary, languages, licences/certificates (driver licence, forklift, barista, first aid, Site Safe, LCQ/RSA), visa hints (working holiday, resident, citizen). Show detected chips, editable: *Barista · Customer service · French · Full driver licence*. Plus a location picker "Where do you want to work?" (default: from query, else All NZ).

### 6.3 Request
`POST /api/match { vector, chips, q, filters }`. **The CV text is never sent.** Server: candidate set (FTS on q + chips if any, else filtered active jobs) → `score = 0.60·cosine + 0.25·chip overlap + 0.15·bm25 (if q) + freshness`. Return a match score 0–100 (calibrated mapping of the blended score, shown as a small "92% match" pill) and "why" chips (which of the user's chips matched this job). Store vector + chips in `sessionStorage` only; "Clear CV" removes them. The CV can be combined with a typed query ("barista" + CV) or used alone.

### 6.4 Optional AI rerank (only if `GEMINI_API_KEY` is set)
Send only the profile chips and the top 30 jobs' titles + summaries (no CV text, no personal data) to a free-tier Gemini Flash-Lite model. Get a reordered list + one short reason per job. Check ai.google.dev for the current free-tier Flash-Lite model id and put it in `GEMINI_MODEL`. Timeout 2.5 s, cache by hash, on 429/timeout/error silently keep the local ranking. The site must be fully functional without this.

---

## 7. UI and UX

### 7.1 Design source
`design/` contains the Claude Design export of the desktop Home (`Radar.dc.html` + assets). Reproduce it faithfully, then design every other screen in exactly the same language. Tokens:
- Fonts Geist / Geist Mono. Colors: ink `#0B0B0A`, bg `#FFFFFF`, surface `#F5F5F4`, surface-2 `#ECECEA`, line `#E8E8E6`, muted `#6B6B6B`, accent `#00C97A`. Radius 12 / 20 / 999.
- Home H1: "Every [icon] job in [icon] New Zealand. [icon] One search."
Dark mode: derive tokens (bg near `#0B0B0A`, same accent), follow system + manual toggle.

### 7.2 Screens
- **Home `/`**: design as exported. Giant search bar with autocomplete and the CV button. Under it, real live line: "12,431 jobs from 9 sources · updated 14 min ago". 4–6 quick chips from real top searches/titles (e.g. Barista, Fruit picking, Kitchen hand, Remote). Minimal footer (About, Privacy, Status).
- **Search `/search`**: sticky compact search bar + filter row (chips that open popovers) + sort. Desktop ≥ 1024 px: result list on the left, preview panel 520 px sticky on the right (first result preselected). Mobile: list; tap opens a bottom sheet (drag to close; browser back closes it).
- **Result card**: title, company, location, pay (or nothing — never "N/A"), work type, posted ("2d"), source name, up to 2 tags, match pill if CV. Seen jobs slightly dimmed (sessionStorage).
- **Preview** (panel/sheet): title, company, location, pay (normalized + original text), work type, posted, source + "Also on Trade Me", summary, highlights, tags, first ~600 chars of the description, then a large primary button **"View on Seek ↗"** (source name dynamic) → `/go/[id]` in a new tab. Secondary: copy link, share (Web Share API on mobile).
- **`/job/[id]`**: the same content as a standalone, shareable page with proper title/description and an OG image (`next/og`). If the job expired: say so and show 6 similar live jobs.
- **`/go/[id]`**: 302 to `sourceUrl`. Only redirect to hosts of known sources (no open redirect). Do not modify the original URL.
- **`/about`**: what Radar is, how it works (3 steps), the source list with attribution, privacy summary, contact (`CONTACT_EMAIL`).
- **`/privacy`**: short, true: no accounts, no cookies, CV processed on device, what the server logs.
- **`/status`**: each source: status, last successful run, active jobs; total; DB built at.
- **404**, `sitemap.xml`, `robots.txt`.

### 7.3 Feel
- Keyboard: `/` focus search, `J/K` move, `Enter` open, `Esc` close, `O` open original.
- Skeletons, 150–200 ms transitions, zero layout shift, respects reduced motion.
- WCAG AA contrast, visible focus rings, labelled controls, works with screen readers.
- Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO) on `/` and `/search`.
- Copy: short, warm, human. No marketing fluff, no fake numbers.

---

## 8. Repo, CI, deploy

Scripts: `dev`, `build`, `start`, `ingest`, `test`, `e2e`, `eval`, `typecheck`, `lint`.

GitHub Actions:
- `ingest.yml`: cron `0 */4 * * *` + manual trigger. Concurrency group, 60 min timeout. Node 22, cache npm + model. Download previous `radar.db.gz` → run ingest → apply §4.5 safety check → `gh release upload data-latest radar.db.gz manifest.json --clobber` (create the release if missing).
- `ci.yml` on push/PR: typecheck, lint, unit tests, `npm ci && npm run build` on ubuntu-latest Node 22 (proves Hostinger's build will work).

Repo visibility: public is recommended (unlimited free Actions minutes, `DATA_URL` downloadable without a token). If private, document `DATA_TOKEN`, and lower the cron to every 6 h to stay within the free monthly Actions minutes.

Hostinger (Node.js Web App from GitHub, plan Business Web Hosting or Cloud): framework Next.js, Node 22, build `npm run build`, start `npm start`. Pushes to `main` redeploy automatically. The app must start correctly with an empty data dir (it downloads the DB on boot and shows a friendly "Loading jobs…" state for the first seconds). `/api/health` returns `{ ok, dbBuiltAt, jobs }`.

Write `DEPLOY_FR.md`: a beginner step-by-step in French for Arthur (create repo, first ingest run, connect Hostinger, env vars, check `/status`, temporary domain, later custom domain).

---

## 9. Quality

### 9.1 Unit tests (Vitest)
Pay parser (≥ 30 real-world strings), location parser, query parser, tags, synonyms, dedup, ranking sanity.

### 9.2 Connector tests
Saved fixtures (real HTML/JSON snapshots trimmed) per source, so CI never hits live sites.

### 9.3 Relevance eval — `npm run eval`
25+ realistic queries with assertions against the real DB, e.g.:
- "barista auckland" → top 10 all barista/café roles in Auckland region.
- "fruit picking" → seasonal horticulture, regions like Hawke's Bay, Bay of Plenty, Central Otago.
- "kitchen hand no experience" → kitchen roles tagged no-experience first.
- "software engineer remote" → engineering roles, remote first.
- "serveur queenstown" → waiter roles in Queenstown (synonym from French).
- "barrista auckand" → typo corrected.
- CV fixture (a fake hospitality CV in `tests/fixtures/`) + no query → hospitality roles dominate the top 10.
Print a pass/fail table. Tune synonyms, tags and weights until ≥ 90% pass. Commit the final table to `PROGRESS.md`.

### 9.4 E2E (Playwright, 1440 px and 390 px)
Home → type → autocomplete → results → preview → "View on …" has the right href; filters update URL and results; CV upload fixture → match pills appear; mobile bottom sheet + back button; dark mode; 404; `/job/[id]`; `/status`.

---

## 10. Phases

**Prompt 1 — Phases A to C**
- A. Scaffold (Next.js, Tailwind tokens, fonts, layout, dark mode), `PROGRESS.md`, git init.
- B. Ingest: all Tier A connectors, Tier B sources that are allowed, ATS list, normalization, tags, dedup, expiry, embeddings, SQLite build. **Run a real full ingest locally** and report counts per source.
- C. Search API + Home + Search (list + preview panel + mobile sheet) + `/job/[id]` + `/go/[id]` on the real data.

**Prompt 2 — Phases D to G**
- D. CV match (§6), optional Gemini rerank.
- E. Polish: all secondary pages, empty/error states, keyboard, a11y, performance, Lighthouse.
- F. GitHub Actions (ingest + CI), release pipeline, runtime DB download/swap, `DEPLOY_FR.md`, README. Create the GitHub repo with `gh` and push. Trigger the first ingest workflow and confirm the release asset exists.
- G. Unit + connector tests, relevance eval to ≥ 90%, Playwright at 1440 and 390. Fix everything that fails.

### Definition of done
- [ ] `npm ci && npm run build && npm start` works on a clean Linux Node 22 machine with only `DATA_URL` set.
- [ ] Real jobs from Seek, Trade Me and every allowed Tier B source; counts shown on `/status`.
- [ ] Every job opens the correct original ad.
- [ ] Search, filters, sort, autocomplete, typo fallback, synonyms all work; URL state shareable.
- [ ] CV match works offline-from-server (text never leaves device), alone or combined with a query.
- [ ] Desktop and mobile match the design language; dark mode; AA; Lighthouse ≥ 90.
- [ ] Ingest workflow green and publishing every 4 h; CI green.
- [ ] Eval ≥ 90%; unit and E2E tests green.
- [ ] No fake data anywhere in production.

### Final report (in French, to Arthur)
What works, live sources with job counts, disabled sources and why, eval score, known limits, and the exact next steps to put it online on Hostinger (point to `DEPLOY_FR.md`).
