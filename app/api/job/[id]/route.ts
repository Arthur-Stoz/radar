import { NextResponse } from 'next/server';
import { getJob } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { sourceUrl: _omit, ...pub } = job;
  void _omit;
  return NextResponse.json(pub);
}
