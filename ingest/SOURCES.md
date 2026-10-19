# Sources

One line per source: allowed? method? notes. Checked 2026-10-19 (robots.txt + terms).
Turn a source off instantly with `DISABLED_SOURCES=id1,id2`; opt a disabled one in with `ENABLED_SOURCES=id`.

| id | Source | Allowed? | Status | Method | Notes |
|---|---|---|---|---|---|
| `seek` | Seek NZ (nz.seek.com) | **Yes — written permission held by the owner** (Tier A). robots.txt alone disallows `/api/jobsearch/` and `/job/`; we rely on the permission. | Enabled | JSON search API used by Seek's own frontend (`/api/jobsearch/v5/search`), partitioned region → classification → work type to stay under the pagination cap; detail page (`window.SEEK_REDUX_DATA`) for new listings only, within `DETAIL_BUDGET`. | Listing data (title, company, location, pay label, teaser, bullet points, work arrangement) is complete without details; details add the full description. |
| `trademe` | Trade Me Jobs | **Yes — written permission held by the owner** (Tier A). robots.txt allows `/a/jobs/…` pages. | Enabled | JSON search endpoint used by trademe.co.nz's frontend (`api.trademe.co.nz/v1/search/jobs.json`, 500 rows/page). Includes the full description, so ~20 requests cover the whole catalogue. | Official API mode: set `TRADEME_CONSUMER_KEY` + `TRADEME_CONSUMER_SECRET` (OAuth PLAINTEXT) and the connector uses them. |
| `jobsgovt` | NZ Government Jobs (jobs.govt.nz) | Yes. robots.txt allows search and job pages; NZ government content. | Enabled | Search results (form POST paging, 20/page) + JobPosting JSON-LD on detail pages for new listings. | Covers public service agencies and Te Whatu Ora / Health NZ listings. |
| `greenhouse` | Greenhouse job boards | Yes. Public, documented job-board API for embedding. | Enabled | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | Companies in `ats-companies.json`; NZ jobs only. |
| `lever` | Lever job boards | Yes. Public postings API. | Enabled | `api.lever.co/v0/postings/{slug}?mode=json` | NZ jobs only. |
| `smartrecruiters` | SmartRecruiters | Yes. Public postings API. | Enabled | `api.smartrecruiters.com/v1/companies/{id}/postings?country=nz` + posting detail | NZ jobs only. |
| `workable` | Workable | Yes. Public widget API. | Enabled (no NZ company found yet) | `apply.workable.com/api/v1/widget/accounts/{slug}?details=true` | Add slugs to `ats-companies.json`. |
| `ashby` | Ashby | Yes. Public job-board API. | Enabled | `api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | NZ jobs only. |
| `backpackerboard` | Backpacker Board | **No (needs permission).** robots.txt allows, but the terms say information "cannot be copied, republished or distributed without written permission". | Disabled (connector built) | Listing pages + JobPosting JSON-LD | Ask Square Kiwi Ltd for written permission, then `ENABLED_SOURCES=backpackerboard`. |
| `picknz` | PickNZ jobs (jobs.picknz.co.nz) | **No (needs permission).** robots.txt allows, but the terms forbid using/copying/storing content without prior written permission. | Disabled (connector built) | `job-sitemap.xml` + JobPosting JSON-LD | Ask Horticulture NZ, then `ENABLED_SOURCES=picknz`. |
| `facebook` | Facebook groups / Marketplace | No feed exists. | Disabled (empty connector) | — | Meta removed the Groups API (2024) and closed Facebook Jobs; posts sit behind a login. We will not automate a personal account. |
| — | LinkedIn | Excluded by the owner. | — | — | — |
| — | Indeed | Excluded (terms forbid collection). | — | — | — |
| — | Work the Seasons (worktheseasons.co.nz) | n/a | Not built | — | The domain now serves an unrelated casino site; the government seasonal-work board no longer lives there. |
| — | jobs.co.nz | **No.** Terms: "Scrape the site, or use automated means to collect listings" is prohibited. | Not built | — | — |
| — | seasonaljobs.co.nz | **No.** Terms reserve all content rights (Create a Moment Ltd). | Not built | — | — |
| — | Student Job Search (sjs.co.nz) | n/a | Not built | — | Jobs are on student.sjs.co.nz behind a student login. |
| — | Adzuna, Jooble | Excluded by the brief (accounts needed, duplicates). | — | — | — |

## Etiquette
User-Agent `RadarNZ/1.0 (+${SITE_URL}/about; ${CONTACT_EMAIL})`, ≤ 1 request/second and ≤ 2 in flight per host, exponential backoff on 429/5xx,
`Retry-After` honoured, ETag/Last-Modified for sitemaps, detail pages only for new listings (`DETAIL_BUDGET` per source per run, default 1500).
