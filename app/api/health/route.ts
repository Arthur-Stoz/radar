import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET() {
  const s = getStore();
  return NextResponse.json({ ok: !!s, dbBuiltAt: s?.builtAt ?? null, jobs: s?.total ?? 0 }, { status: s ? 200 : 503 });
}
