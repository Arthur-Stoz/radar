import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
import { aliasOf } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

// 302 to the original ad (BUILD.md §7.2). The URL comes from our database, is never modified,
// and is only followed when its host belongs to that source (no open redirect).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const via = new URL(req.url).searchParams.get('via');
  const store = getStore();
  const fallback = () => NextResponse.redirect(new URL(`/job/${encodeURIComponent(rawId)}`, req.url), 302);
  if (!store) return fallback();

  const id = aliasOf(rawId) || rawId;
  const job = store.db.prepare('SELECT source, source_url AS url, also_on AS alsoOn FROM jobs WHERE id = ?').get(id) as { source: string; url: string; alsoOn: string } | undefined;
  if (!job) return fallback();

  let source = job.source;
  let target = job.url;
  if (via && via !== job.source) {
    const alt = (JSON.parse(job.alsoOn || '[]') as { source: string; url: string }[]).find((a) => a.source === via);
    if (!alt) return fallback();
    source = alt.source;
    target = alt.url;
  }

  const row = store.db.prepare('SELECT hosts FROM sources_status WHERE id = ?').get(source) as { hosts: string } | undefined;
  const allowed: string[] = JSON.parse(row?.hosts || '[]');
  try {
    const u = new URL(target);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !allowed.includes(u.host)) return fallback();
  } catch {
    return fallback();
  }
  return new NextResponse(null, { status: 302, headers: { location: target, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}
