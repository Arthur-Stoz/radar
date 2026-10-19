// Lighthouse (mobile defaults) on the main pages: `node scripts/lighthouse.mjs [baseUrl]`.
// Chrome is started by Playwright, then Lighthouse attaches to its debugging port.
// Each page runs RUNS times (default 3); the median score is reported (local machines are noisy).
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3000';
const pages = ['/', '/search?q=barista', '/search', '/about'];
const RUNS = Number(process.env.RUNS || 3);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await chromium.launch({ args: ['--remote-debugging-port=9333'] });
let failed = false;
for (const p of pages) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await lighthouse(`${base}${p}`, { port: 9333, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    runs.push(r.lhr);
  }
  const ids = Object.keys(runs[0].categories);
  const scores = ids.map((id) => [id, median(runs.map((l) => Math.round(l.categories[id].score * 100)))]);
  const tbt = median(runs.map((l) => l.audits['total-blocking-time'].numericValue));
  const lcp = median(runs.map((l) => l.audits['largest-contentful-paint'].numericValue));
  console.log(p.padEnd(22), scores.map(([k, v]) => `${k}=${v}`).join('  '), `| median LCP ${(lcp / 1000).toFixed(1)} s, TBT ${Math.round(tbt)} ms`);
  for (const [, v] of scores) if (v < 90 && (p === '/' || p.startsWith('/search'))) failed = true;
  const last = runs.at(-1);
  const bad = Object.values(last.audits).filter((a) => a.score !== null && a.score < 0.9 && !['informative', 'manual', 'notApplicable'].includes(a.scoreDisplayMode));
  if (bad.length) console.log('   ', bad.slice(0, 8).map((a) => `${a.id}(${Math.round(a.score * 100)})`).join(', '));
  for (const id of ['color-contrast', 'label-content-name-mismatch', 'heading-order', 'link-name', 'button-name']) {
    const items = last.audits[id]?.details?.items || [];
    for (const it of items.slice(0, 3)) {
      const why = it.node?.explanation ? ` — ${it.node.explanation.split('\n')[0].slice(0, 120)}` : '';
      console.log(`    ${id}: ${(it.node?.snippet || '').slice(0, 160)}${why}`);
    }
  }
}
await browser.close();
console.log(failed ? '\nSome scores are under 90.' : '\nAll scores ≥ 90 on / and /search.');
process.exit(failed ? 1 : 0);
