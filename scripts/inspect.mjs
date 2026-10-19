import Database from 'better-sqlite3';
const db = new Database(process.argv[2] || '.data/radar.db', { readonly: true });
const q = (s) => db.prepare(s).all();
try { console.table(q("SELECT name, SUM(pgsize)/1e6 AS mb FROM dbstat GROUP BY name ORDER BY 2 DESC LIMIT 8")); } catch { console.log('no dbstat'); }
console.table(q("SELECT source, COUNT(*) n, SUM(city IS NULL) no_city, SUM(region_id IS NULL) no_region, SUM(hourly_min IS NOT NULL) pay, SUM(pay_text IS NOT NULL) paytext, SUM(has_detail) detail, ROUND(AVG(LENGTH(description))) desc_len FROM jobs GROUP BY source"));
console.table(q("SELECT loc_raw, city, region FROM jobs WHERE city IS NULL GROUP BY loc_raw ORDER BY COUNT(*) DESC LIMIT 15"));
console.table(q("SELECT pay_text, pay_min, pay_max, pay_period, hourly_min FROM jobs WHERE pay_text IS NOT NULL ORDER BY RANDOM() LIMIT 12"));
console.table(q("SELECT pay_text FROM jobs WHERE pay_text IS NOT NULL AND hourly_min IS NULL GROUP BY pay_text ORDER BY COUNT(*) DESC LIMIT 12"));
const tags = {}; for (const r of q("SELECT tags FROM jobs")) for (const t of r.tags.split(',').filter(Boolean)) tags[t]=(tags[t]||0)+1; console.log(tags);
const wt = {}; for (const r of q("SELECT work_types FROM jobs")) for (const t of r.work_types.split(',').filter(Boolean)) wt[t]=(wt[t]||0)+1; console.log(wt);
console.table(q("SELECT source, title, company, loc_raw, city FROM jobs WHERE source IN ('ashby','greenhouse') ORDER BY RANDOM() LIMIT 10"));
console.table(q("SELECT title, substr(summary,1,140) s FROM jobs ORDER BY RANDOM() LIMIT 6"));
