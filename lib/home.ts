import { getStore } from './db';
import { loadCards, search, type CardJob, type SearchInput } from './search';

export interface HomeData {
  total: number;
  builtAt: string;
  sources: { id: string; name: string; active: number }[];
  quick: { label: string; href: string; count: number }[];
  fresh: CardJob[];
  cats: { label: string; href: string; count: number; icon: string; span: 1 | 2; eg: string; rot: number }[];
}

let cache: { version: number; at: number; data: HomeData } | null = null;

const href = (i: SearchInput) => {
  const p = new URLSearchParams();
  if (i.q) p.set('q', i.q);
  if (i.tags?.length) p.set('tags', i.tags.join(','));
  if (i.type?.length) p.set('type', i.type.join(','));
  if (i.pay) p.set('pay', String(i.pay));
  if (i.posted) p.set('posted', i.posted);
  return `/search?${p}`;
};

// Quick chips from the design; each is a real search and is shown only when it has results.
const QUICK: [string, SearchInput][] = [
  ['Live-in', { tags: ['accommodation'] }],
  ['Hospitality', { q: 'hospitality' }],
  ['Fruit picking', { q: 'fruit picking' }],
  ['No experience', { tags: ['no-experience'] }],
  ['Starts this week', { tags: ['immediate-start'] }],
  ['$30+/h', { pay: 30 }],
  ['Remote', { tags: ['remote'] }],
  ['Barista', { q: 'barista' }],
  ['Kitchen hand', { q: 'kitchen hand' }],
];

const CATS: [string, SearchInput, string, 1 | 2, string, number][] = [
  ['Hospitality', { q: 'hospitality' }, 'coffee', 2, 'Baristas, chefs, bartenders, kitchen hands', -8],
  ['Farm & fruit', { q: 'farm' }, 'kiwi', 1, 'Picking, packing, orchards and dairy', 8],
  ['Live-in', { tags: ['accommodation'] }, 'bed', 1, 'Accommodation included or arranged', -6],
  ['Tourism', { q: 'tourism' }, 'van', 1, 'Guides, front desk, cruises', 6],
  ['Events', { q: 'events' }, 'party', 1, 'Festivals, venues and event crews', -10],
  ['Seasonal', { tags: ['seasonal'] }, 'mountain', 2, 'Harvests, ski fields and summer work', 5],
];

export function getHomeData(): HomeData | null {
  const store = getStore();
  if (!store) return null;
  if (cache && cache.version === store.version && Date.now() - cache.at < 5 * 60_000) return cache.data;

  const sources = (store.db.prepare('SELECT id, name, active_jobs AS active FROM sources_status WHERE active_jobs > 0 ORDER BY active_jobs DESC').all() as HomeData['sources']) || [];
  const count = (i: SearchInput) => search({ ...i, pageSize: 1 }).total;

  const quick = QUICK.map(([label, i]) => ({ label, href: href(i), count: count(i) }))
    .filter((c) => c.count > 0)
    .slice(0, 6);

  // Fresh: newest jobs, one per company, spread across sources.
  const fresh: number[] = [];
  const companies = new Set<string>();
  const perSource = new Map<string, number>();
  for (const j of store.light) {
    if (fresh.length >= 12) break;
    const c = (j.company || '').toLowerCase();
    if (!c || companies.has(c)) continue;
    if ((perSource.get(j.source) || 0) >= 5) continue;
    companies.add(c);
    perSource.set(j.source, (perSource.get(j.source) || 0) + 1);
    fresh.push(j.rowid);
  }

  const data: HomeData = {
    total: store.total,
    builtAt: store.builtAt,
    sources,
    quick,
    fresh: loadCards(store, fresh),
    cats: CATS.map(([label, i, icon, span, eg, rot]) => ({ label, href: href(i), count: count(i), icon, span, eg, rot })),
  };
  cache = { version: store.version, at: Date.now(), data };
  return data;
}

/** "Seek, Trade Me, NZ Government Jobs and company career pages" from real active sources. */
export function sourcesSentence(sources: HomeData['sources']): string {
  const ats = new Set(['greenhouse', 'lever', 'smartrecruiters', 'workable', 'ashby']);
  const named = sources.filter((s) => !ats.has(s.id)).map((s) => s.name);
  const hasAts = sources.some((s) => ats.has(s.id));
  const parts = hasAts ? [...named, 'company career pages'] : named;
  const s = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
