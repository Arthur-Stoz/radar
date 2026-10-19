// Per-query uncached latency (page varies to bypass the result cache).
import { search } from '../lib/search';
search({ q: 'warmup' });
for (const q of ['', 'barista auckland', 'truck driver', 'customer service', 'nurse', '$30 an hour', 'manager', 'admin', 'barrista auckand']) {
  const ts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = performance.now();
    search({ q, page: i + 1 });
    ts.push(performance.now() - t);
  }
  console.log(q.padEnd(20), ts.map((x) => x.toFixed(0)).join(' '), 'ms');
}
