// Search latency on the real DB: `npx tsx scripts/bench.ts`
import { search } from '../lib/search';
import { suggest } from '../lib/suggest';

const qs = ['', 'barista auckland', 'fruit picking', 'kitchen hand no experience', 'software engineer remote', 'serveur queenstown', 'barrista auckand', 'truck driver', 'customer service', 'nurse', '$30 an hour', 'part time retail wellington', 'manager', 'admin'];
search({ q: 'warmup' });
const times: number[] = [];
for (let r = 0; r < 5; r++)
  for (const q of qs) {
    const t = performance.now();
    search({ q, page: 1 + (r % 2) });
    times.push(performance.now() - t);
  }
const st: number[] = [];
for (const q of ['b', 'ba', 'bar', 'barista a', 'kitc', 'queen', 'xero']) {
  const t = performance.now();
  suggest(q);
  st.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const p = (x: number) => times[Math.floor((times.length - 1) * x)].toFixed(1);
console.log(`search n=${times.length} p50=${p(0.5)}ms p95=${p(0.95)}ms max=${times.at(-1)!.toFixed(1)}ms`);
console.log(`suggest max=${Math.max(...st).toFixed(1)}ms`);
console.log(`rss=${(process.memoryUsage().rss / 1e6).toFixed(0)}MB`);
