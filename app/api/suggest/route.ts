import { NextRequest, NextResponse } from 'next/server';
import { suggest } from '@/lib/suggest';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  return NextResponse.json(suggest(q.slice(0, 80)), { headers: { 'cache-control': 'public, max-age=300' } });
}
