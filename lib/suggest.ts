import { getStore, type Store, type VocabEntry } from './db';
import { fold } from './text';

// Autocomplete from the vocab table (BUILD.md §5.5).

export interface Suggestion {
  kind: 'title' | 'company' | 'place' | 'combo';
  label: string;
  q: string;
  count: number;
}

interface Prepared {
  version: number;
  titles: (VocabEntry & { f: string })[];
  companies: (VocabEntry & { f: string })[];
  places: (VocabEntry & { f: string })[];
}

let prepared: Prepared | null = null;

function prep(store: Store): Prepared {
  if (prepared?.version === store.version) return prepared;
  const add = (v: VocabEntry) => ({ ...v, f: fold(v.display) });
  prepared = {
    version: store.version,
    titles: store.vocab.filter((v) => v.kind === 'title').map(add),
    companies: store.vocab.filter((v) => v.kind === 'company').map(add),
    places: store.vocab.filter((v) => v.kind === 'place' && !v.term.startsWith('region:')).map(add),
  };
  return prepared;
}

const wordStart = (hay: string, needle: string) => hay.startsWith(needle) || hay.includes(` ${needle}`);

export function suggest(qRaw: string, limit = 8): Suggestion[] {
  const store = getStore();
  const q = fold(qRaw || '').replace(/\s+/g, ' ').trimStart();
  if (!store || q.length < 1) return [];
  const p = prep(store);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion) => {
    const k = s.q.toLowerCase();
    if (seen.has(k) || out.length >= limit) return;
    seen.add(k);
    out.push(s);
  };

  // "barista in auck" / "barista auck" → "barista in Auckland"
  const m = /^(.+?)\s+(?:in\s+)?(\S+)$/.exec(q);
  if (m && m[2].length >= 1) {
    const head = m[1].replace(/\s+in$/, '');
    const headIsTitle = p.titles.some((t) => t.f === head || t.f.startsWith(head));
    if (headIsTitle) {
      for (const pl of p.places) {
        if (pl.f.startsWith(m[2])) push({ kind: 'combo', label: `${head} in ${pl.display}`, q: `${head} in ${pl.display}`, count: 0 });
        if (out.length >= 3) break;
      }
    }
  }

  const titleHits = p.titles.filter((t) => wordStart(t.f, q)).slice(0, 12);
  titleHits.sort((a, b) => Number(b.f.startsWith(q)) - Number(a.f.startsWith(q)) || b.count - a.count);
  for (const t of titleHits.slice(0, 5)) push({ kind: 'title', label: t.display, q: t.display, count: t.count });
  for (const pl of p.places.filter((x) => x.f.startsWith(q)).slice(0, 2)) push({ kind: 'place', label: `Jobs in ${pl.display}`, q: pl.display, count: pl.count });
  for (const c of p.companies.filter((x) => wordStart(x.f, q)).slice(0, 2)) push({ kind: 'company', label: c.display, q: c.display, count: c.count });
  return out;
}
