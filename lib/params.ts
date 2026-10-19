import type { Posted, SearchInput, Sort } from './search';

type Getter = { get(name: string): string | null };

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20) : []);

/** URL query → SearchInput (BUILD.md §5.3: everything lives in the URL). */
export function inputFromParams(p: Getter): SearchInput {
  const sort = p.get('sort');
  const posted = p.get('posted');
  const pay = Number(p.get('pay'));
  return {
    q: (p.get('q') || '').slice(0, 200),
    loc: list(p.get('loc')),
    type: list(p.get('type')),
    tags: list(p.get('tags')),
    source: list(p.get('source')),
    pay: Number.isFinite(pay) && pay > 0 ? pay : null,
    posted: (['24h', '3d', '7d', '30d'].includes(posted || '') ? posted : null) as Posted | null,
    sort: (sort === 'new' ? 'new' : sort === 'pay' ? 'pay' : sort === 'best' ? 'best' : undefined) as Sort | undefined,
    page: Math.max(1, Number(p.get('page')) || 1),
  };
}

export function recordFromSearchParams(sp: Record<string, string | string[] | undefined>): Getter {
  return { get: (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? null };
}
