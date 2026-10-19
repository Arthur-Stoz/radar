import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Top real job titles (lowercase) for on-device CV skill/title detection. */
export function GET() {
  const store = getStore();
  const titles = store ? store.vocab.filter((v) => v.kind === 'title').slice(0, 1500).map((v) => v.display.toLowerCase()) : [];
  return NextResponse.json({ titles }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
