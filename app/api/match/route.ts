import { NextRequest, NextResponse } from 'next/server';
import { EMBED_DIM } from '@/lib/embedding';
import { rerank } from '@/lib/rerank';
import { search, type Posted, type Sort } from '@/lib/search';

export const dynamic = 'force-dynamic';

const strList = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max).map((x: string) => x.slice(0, 60)) : []);

// POST /api/match { vector, chips, q, loc, type, pay, posted, tags, source, sort, page } (BUILD.md §6.3).
// The CV text is never sent: only its mean embedding (computed on the device) and the confirmed chips.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  // vector may be null: the on-device model did not load, so matching uses the chips only.
  const vector = body.vector ?? null;
  if (vector !== null && (!Array.isArray(vector) || vector.length !== EMBED_DIM || !vector.every((x) => typeof x === 'number' && Number.isFinite(x)))) {
    return NextResponse.json({ error: 'invalid_vector' }, { status: 400 });
  }
  const chips = (Array.isArray(body.chips) ? body.chips : [])
    .slice(0, 30)
    .filter((c): c is { kind: string; label: string; terms?: unknown } => !!c && typeof c === 'object' && typeof (c as { label?: unknown }).label === 'string')
    .map((c) => ({ kind: String(c.kind || 'skill').slice(0, 12), label: c.label.slice(0, 60), terms: strList(c.terms, 12).map((t) => t.toLowerCase()) }))
    .map((c) => ({ ...c, terms: c.terms.length ? c.terms : [c.label.toLowerCase()] }));
  if (!vector && !chips.length) return NextResponse.json({ error: 'empty_profile' }, { status: 400 });
  const pay = Number(body.pay);
  const page = Math.max(1, Math.min(50, Number(body.page) || 1));
  const res = search({
    q: typeof body.q === 'string' ? body.q.slice(0, 200) : '',
    loc: strList(body.loc),
    type: strList(body.type),
    tags: strList(body.tags),
    source: strList(body.source),
    pay: Number.isFinite(pay) && pay > 0 ? pay : null,
    posted: (['24h', '3d', '7d', '30d'].includes(String(body.posted)) ? body.posted : null) as Posted | null,
    sort: (['best', 'new', 'pay'].includes(String(body.sort)) ? body.sort : 'best') as Sort,
    page,
    cv: { vector: vector as number[] | null, chips },
  });
  if (page === 1 && res.results.length) res.results = await rerank(chips.map((c) => c.label), res.results);
  return NextResponse.json(res, { headers: { 'cache-control': 'no-store' } });
}
