import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchApp } from '@/components/SearchApp';
import { getStore } from '@/lib/db';
import { inputFromParams, recordFromSearchParams } from '@/lib/params';
import { search } from '@/lib/search';
import { embedQuery } from '@/lib/embedQuery';
import { parseQuery } from '@/lib/query';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) || '';
  return {
    title: q ? `${q} jobs` : 'Search jobs',
    description: q ? `Every “${q}” job in New Zealand from Seek, Trade Me and more, in one search.` : 'Search every job in New Zealand in one place.',
    // Plain searches are indexable; filtered permutations are not.
    robots: { index: Object.keys(sp).length === 0 || (!!q && Object.keys(sp).length === 1), follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const input = inputFromParams(recordFromSearchParams(sp));
  const kw = parseQuery(input.q || '').keywords;
  const vector = kw ? await embedQuery(kw) : null;
  const initial = search({ ...input, page: 1, vector });
  const store = getStore();
  return (
    <Suspense>
      <SearchApp initial={initial} builtAt={store?.builtAt || ''} />
      {!initial.ready && <AutoRefresh seconds={5} />}
    </Suspense>
  );
}
