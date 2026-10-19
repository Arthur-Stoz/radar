import { NextRequest, NextResponse } from 'next/server';
import { embedQuery } from '@/lib/embedQuery';
import { inputFromParams } from '@/lib/params';
import { parseQuery } from '@/lib/query';
import { search } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const input = inputFromParams(req.nextUrl.searchParams);
  const kw = parseQuery(input.q || '').keywords;
  const vector = kw ? await embedQuery(kw) : null;
  const res = search({ ...input, vector });
  return NextResponse.json(res, { headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' } });
}
