# Radar

Every job in New Zealand. One search. Free, no account, no tracking.

Radar collects the live job listings of Seek, Trade Me, NZ Government Jobs, jobs.co.nz, SeasonalJobs NZ, PickNZ, Backpacker Board and
company career pages (Greenhouse, Lever, SmartRecruiters, Workable, Ashby), puts them in one fast search, and sends people to the
original ad to apply. A CV can be matched against every job **on the visitor's device** — the CV is never uploaded.

- Product spec: [`BUILD.md`](BUILD.md) · progress log: [`PROGRESS.md`](PROGRESS.md) · sources: [`ingest/SOURCES.md`](ingest/SOURCES.md)
- Deploying (French, step by step): [`DEPLOY_FR.md`](DEPLOY_FR.md) · product guide (French): [`GUIDE_FR.md`](GUIDE_FR.md)

## How it works

```
GitHub Actions (every 4 h)                       Hostinger Node.js app (Next.js)
  npm run ingest                                   on boot + every 10 min: download radar.db.gz (ETag),
   fetch sources → normalize → dedup → expire       verify, swap atomically
   → embeddings (local model) → radar.db           serves /, /search, /job/[id], /go/[id], /api/*
   → gzip → release "data-latest"                  SQLite FTS5 + vectors in-process
```

No database server, no search service, no AI service: only GitHub and the Node host.

## Develop

```bash
npm install
npm run ingest          # real data into ./.data/radar.db (first run: ~1 h; later runs reuse details and embeddings)
npm run dev             # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (prepares self-hosted model + pdf.js assets first) |
| `npm run ingest` | Build the database. Env: `DATA_DIR`, `DETAIL_BUDGET`, `ONLY_SOURCES`, `DISABLED_SOURCES`, `ENABLED_SOURCES`, `OFFLINE=1` (rebuild without requests), `INGEST_DEADLINE_MIN`, `SKIP_EMBEDDINGS=1` |
| `npm test` | Vitest: parsers (pay, places, tags, query, synonyms), dedup, CV profile, connectors on saved fixtures |
| `npm run e2e` | Playwright at 1440 px and 390 px against `E2E_BASE_URL` (or a local `next start`) |
| `npm run eval` | Relevance eval on the real DB (31 cases incl. CV matching); fails under 90 % |
| `node scripts/lighthouse.mjs <url>` | Lighthouse mobile, median of 3 |
| `npm run typecheck` / `lint` | TypeScript, ESLint |

## Runtime configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATA_URL` | host (required) | `https://github.com/<owner>/radar/releases/download/data-latest/radar.db.gz` |
| `DATA_TOKEN` | host | Only if the repo is private: fine-grained token, read-only *Contents* |
| `SITE_URL` | host + Actions variable | Public base URL (sitemap, OG, bot User-Agent) |
| `CONTACT_EMAIL` | host + Actions variable | Shown on /about and in the bot User-Agent |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | host | Optional AI rerank of CV matches (default model `gemini-3.5-flash-lite`) |
| `SEMANTIC_QUERY` | host | `on` embeds text queries on the server (more memory); default `off` |
| `DISABLED_SOURCES`, `ENABLED_SOURCES`, `DETAIL_BUDGET` | Actions variables | Turn sources off/on, detail pages per source per run |
| `TRADEME_CONSUMER_KEY`, `TRADEME_CONSUMER_SECRET` | Actions secrets | Optional official Trade Me API mode |
| `PORT`, `DATA_DIR` | host | Port (set by the host) and data folder (default `./.data`) |

## Layout

```
app/              Next.js routes (/, /search, /job/[id], /go/[id], /status, /about, /privacy, /api/*)
components/       UI (search bar, CV button/panel, filters, cards, preview, sheet)
lib/              search engine, query parser, synonyms, gazetteer, pay/tags parsers, CV profile, data sync
ingest/           connectors (ingest/sources), normalization, dedup, embeddings, SQLite build
public/cv-worker.js  on-device embedding worker; public/vendor + public/models are generated
scripts/          eval, lighthouse, asset preparation, helpers
tests/            unit + connector tests (fixtures/), e2e/
.github/workflows ingest.yml (every 4 h), ci.yml (checks + e2e + Lighthouse + eval)
```
