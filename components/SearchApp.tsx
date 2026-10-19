'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardJob, SearchResult } from '@/lib/search';
import { fold } from '@/lib/text';
import { FilterBar, SortSelect, type FilterState } from './Filters';
import { JobCard } from './JobCard';
import { JobPreview } from './JobPreview';
import { LiveLine } from './LiveLine';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';
import { OPEN_CV_EVENT, useCv } from './CvButton';
import { LazyCvDropZone } from './LazyIslands';
import { clearCv } from '@/lib/cvState';

const SEEN_KEY = 'radar-seen';
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function useIsDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
}

export function SearchApp({ initial, builtAt }: { initial: SearchResult; builtAt: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.toString();
  const isDesktop = useIsDesktop();

  const [data, setData] = useState<SearchResult>(initial);
  const [extra, setExtra] = useState<CardJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial.results[0]?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const cv = useCv();
  const cvOn = params.get('cv') === '1' && !!cv.profile;
  const cvSig = cvOn && cv.profile ? `${cv.profile.chips.map((c) => c.label).join(',')}|${cv.profile.vector.slice(0, 4).join(',')}` : '';
  const fetchKey = `${key}|${cvSig}`;
  const firstKey = useRef(`${key}|`);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSeen(readSeen()), 0);
    return () => clearTimeout(t);
  }, []);

  /** Text search (GET /api/search) or CV match (POST /api/match: only the vector and chips, never the CV text). */
  const query = useCallback(
    (qs: string, page = 1): Promise<SearchResult> => {
      const p = new URLSearchParams(qs);
      if (page > 1) p.set('page', String(page));
      if (!cvOn || !cv.profile) return fetch(`/api/search?${p}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
      const list = (k: string) => (p.get(k) || '').split(',').filter(Boolean);
      const body = {
        vector: cv.profile.vector,
        chips: cv.profile.chips,
        q: p.get('q') || '',
        loc: list('loc'),
        type: list('type'),
        tags: list('tags'),
        source: list('source'),
        pay: Number(p.get('pay')) || null,
        posted: p.get('posted'),
        sort: p.get('sort') || 'best',
        page,
      };
      return fetch('/api/match', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) =>
        r.ok ? r.json() : Promise.reject(r.status),
      );
    },
    [cvOn, cv.profile],
  );

  // Fetch when the URL (filters, query, sort) or the CV changes.
  useEffect(() => {
    if (fetchKey === firstKey.current) return;
    firstKey.current = fetchKey;
    const id = ++reqId.current;
    const slow = setTimeout(() => setLoading(true), 150);
    setError(false);
    query(key)
      .then((res) => {
        if (id !== reqId.current) return;
        setData(res);
        setExtra([]);
        setSelectedId(res.results[0]?.id ?? null);
      })
      .catch(() => id === reqId.current && setError(true))
      .finally(() => {
        clearTimeout(slow);
        if (id === reqId.current) setLoading(false);
      });
    return () => clearTimeout(slow);
  }, [fetchKey, key, query]);

  const results = useMemo(() => [...data.results, ...extra], [data.results, extra]);
  const hasMore = results.length < data.total;
  const selected = results.find((r) => r.id === selectedId) || null;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = Math.floor(results.length / data.pageSize) + 1;
    query(key, nextPage)
      .then((res: SearchResult) => {
        const have = new Set(results.map((r) => r.id));
        setExtra((e) => [...e, ...res.results.filter((r) => !have.has(r.id))]);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, key, results, data.pageSize, query]);

  // Infinite scroll with a "Load more" fallback button.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const update = useCallback(
    (patch: Record<string, string | string[] | number | null>) => {
      const p = new URLSearchParams(key);
      for (const [k, v] of Object.entries(patch)) {
        const s = Array.isArray(v) ? v.join(',') : v == null ? '' : String(v);
        if (s) p.set(k, s);
        else p.delete(k);
      }
      p.delete('page');
      const qs = p.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [key, pathname, router],
  );

  const markSeen = (id: string) => {
    setSeen((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      try {
        sessionStorage.setItem(SEEN_KEY, JSON.stringify([...n].slice(-500)));
      } catch {}
      return n;
    });
  };

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    history.pushState({ radarSheet: true }, '');
  }, []);
  const closeSheet = useCallback(() => {
    if (history.state?.radarSheet) history.back();
    else setSheetOpen(false);
  }, []);
  useEffect(() => {
    const onPop = () => setSheetOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const select = useCallback(
    (id: string, open: boolean) => {
      setSelectedId(id);
      if (open && !isDesktop) openSheet();
    },
    [isDesktop, openSheet],
  );

  // Mark the visible preview as seen after a moment.
  useEffect(() => {
    if (!selectedId || (!isDesktop && !sheetOpen)) return;
    const t = setTimeout(() => markSeen(selectedId), 800);
    return () => clearTimeout(t);
  }, [selectedId, isDesktop, sheetOpen]);

  // Keyboard: J/K move, Enter open, Esc close, O open original.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = results.findIndex((r) => r.id === selectedId);
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const next = results[Math.max(0, Math.min(results.length - 1, idx + (e.key === 'j' ? 1 : -1)))];
        if (next) {
          setSelectedId(next.id);
          const node = document.querySelector<HTMLAnchorElement>(`[data-job-id="${next.id}"]`);
          node?.focus({ preventScroll: true });
          node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'Enter' && selected && el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        if (isDesktop) router.push(`/job/${selected.id}`);
        else openSheet();
      } else if (e.key === 'Escape' && sheetOpen) {
        closeSheet();
      } else if ((e.key === 'o' || e.key === 'O') && selected) {
        window.open(`/go/${selected.id}`, '_blank', 'noopener');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, selectedId, selected, isDesktop, sheetOpen, openSheet, closeSheet, router]);

  const q = params.get('q') || '';
  const state: FilterState = {
    loc: list(params.get('loc')),
    type: list(params.get('type')),
    pay: Number(params.get('pay')) || null,
    posted: params.get('posted'),
    tags: list(params.get('tags')),
    source: list(params.get('source')),
    sort: params.get('sort'),
  };
  const sortValue = state.sort || (q || data.keywords ? 'best' : 'new');

  const removeChip = (match: string) => {
    const nq = fold(q)
      .replace(new RegExp(`(\\b(in|near|around)\\s+)?${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), ' ')
      .replace(/\s+/g, ' ')
      .trim();
    update({ q: nq });
  };

  const heading = cvOn ? (
    <>
      {data.total.toLocaleString('en-NZ')} jobs matched to your CV{q ? <> for “{q}”</> : null}
    </>
  ) : q ? (
    <>
      {data.total.toLocaleString('en-NZ')} {data.total === 1 ? 'job' : 'jobs'} for “{q}”
    </>
  ) : data.total ? (
    <>{data.total.toLocaleString('en-NZ')} jobs, newest first</>
  ) : (
    <>No jobs found</>
  );

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-line bg-bg">
        <header className="flex h-16 items-center gap-3 px-5 sm:h-[72px] sm:gap-6 sm:px-10">
          <div className="hidden sm:block">
            <Logo />
          </div>
          <Link href="/" aria-label="Radar home" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface sm:hidden">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          </Link>
          <div className="min-w-0 flex-1 lg:max-w-[640px]">
            <SearchBar variant="compact" initial={q} onSearch={(nq) => update({ q: nq })} />
          </div>
          <div className="ml-auto flex flex-none items-center gap-2 text-[13px] text-muted">
            <span className="hidden lg:inline">Free · No account</span>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main id="main" className="px-5 pb-24 sm:px-10">
        <div className="flex flex-col gap-3 pb-4 pt-5 sm:pt-7">
          {data.chips.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Understood from your search">
              {data.chips.map((c) => (
                <li key={`${c.kind}-${c.match}`}>
                  <button type="button" onClick={() => removeChip(c.match)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] hover:border-line-strong" aria-label={`Remove ${c.label}`}>
                    {c.label}
                    <span aria-hidden="true" className="text-muted">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cvOn && cv.profile && (
            <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-surface px-4 py-3 text-[14px]">
              <span className="font-medium">Matching your CV</span>
              <span className="min-w-0 truncate text-muted">{cv.profile.chips.slice(0, 5).map((c) => c.label).join(' · ')}</span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CV_EVENT))} className="rounded-full px-3 py-1.5 hover:bg-surface-2">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearCv();
                    update({ cv: null });
                  }}
                  className="rounded-full px-3 py-1.5 hover:bg-surface-2"
                >
                  Clear CV
                </button>
              </span>
            </div>
          )}
          {params.get('cv') === '1' && !cv.profile && (
            <p className="m-0 rounded-[16px] bg-surface px-4 py-3 text-[14px] text-muted">
              Your CV is not on this device any more, so these are regular results.{' '}
              <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CV_EVENT))} className="text-ink underline underline-offset-2">
                Match with your CV
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h1 className="m-0 text-[26px] font-[650] leading-[1.15] tracking-[-0.035em] sm:text-[34px]" aria-live="polite">
                {heading}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {builtAt && <LiveLine builtAt={builtAt} />}
                {data.corrected && (
                  <span className="text-[14px] text-muted">
                    Showing results for <em className="font-medium not-italic text-ink">{data.corrected}</em>
                  </span>
                )}
                {data.broadened && <span className="text-[14px] text-muted">Few matches there — showing all of {data.broadened}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-16 z-20 -mx-5 flex items-center justify-between gap-3 border-b border-transparent bg-bg px-5 py-2.5 sm:top-[72px] sm:mx-0 sm:px-0">
          <FilterBar facets={data.facets} state={state} onChange={(patch) => update(patch as Record<string, string[] | number | null>)} />
          <div className="hidden flex-none sm:block">
            <SortSelect value={sortValue} hasQuery={!!q} onChange={(v) => update({ sort: v === (q ? 'best' : 'new') ? null : v })} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pb-3 pt-1">
          {data.typicalPay ? (
            <p className="m-0 text-[13px] text-muted">
              Typical pay:{' '}
              <span className="font-mono text-ink">
                ${data.typicalPay.p25}–${data.typicalPay.p75}/h
              </span>{' '}
              · median <span className="font-mono text-ink">${data.typicalPay.median}/h</span>
            </p>
          ) : (
            <span />
          )}
          <div className="sm:hidden">
            <SortSelect value={sortValue} hasQuery={!!q} onChange={(v) => update({ sort: v === (q ? 'best' : 'new') ? null : v })} />
          </div>
        </div>

        {!data.ready ? (
          <div className="py-24 text-center text-muted" role="status">
            <span className="pulse-dot mr-2 align-middle" aria-hidden="true" />
            Loading jobs… the database is being downloaded. This page refreshes on its own.
          </div>
        ) : error ? (
          <div className="py-24 text-center" role="alert">
            <p className="text-[17px]">Something went wrong loading results.</p>
            <button type="button" onClick={() => router.refresh()} className="mt-3 rounded-full bg-surface px-5 py-2.5 text-[14px] hover:bg-surface-2">
              Try again
            </button>
          </div>
        ) : results.length === 0 && !loading ? (
          <EmptyState q={q} state={state} data={data} update={update} />
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-8">
            <section aria-label="Results" className={`flex flex-col gap-1 transition-opacity duration-150 ${loading ? 'opacity-50' : ''}`}>
              {loading && results.length === 0
                ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[112px] rounded-[20px]" />)
                : results.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      selected={isDesktop && j.id === selectedId}
                      seen={seen.has(j.id)}
                      onSelect={() => select(j.id, true)}
                      matchPill={cvOn ? (j.match ?? null) : null}
                    />
                  ))}
              <div ref={sentinel} />
              {hasMore && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className="mx-auto mt-4 rounded-full bg-surface px-6 py-3 text-[15px] hover:bg-surface-2 disabled:opacity-60">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
              {!hasMore && results.length > 8 && <p className="mt-6 text-center text-[13px] text-muted">That’s everything for this search.</p>}
            </section>

            <aside aria-label="Job preview" className="hidden lg:block">
              <div className="no-scrollbar sticky top-[136px] max-h-[calc(100dvh-152px)] overflow-y-auto rounded-[20px] border border-line p-7">
                {selected ? <JobPreview key={selected.id} job={selected} /> : <p className="text-muted">Select a job to see it here.</p>}
              </div>
            </aside>
          </div>
        )}
      </main>

      {!isDesktop && sheetOpen && selected && <BottomSheet job={selected} onClose={closeSheet} />}
      <LazyCvDropZone />
    </>
  );
}

function EmptyState({ q, state, data, update }: { q: string; state: FilterState; data: SearchResult; update: (p: Record<string, string | string[] | number | null>) => void }) {
  const tips: { label: string; patch: Record<string, string | string[] | number | null> }[] = [];
  if (state.pay) tips.push({ label: `Remove the $${state.pay}+/h pay filter`, patch: { pay: null } });
  if (state.posted) tips.push({ label: 'Show jobs from any date', patch: { posted: null } });
  if (state.tags.length) tips.push({ label: 'Remove the perks filter', patch: { tags: [] } });
  if (state.type.length) tips.push({ label: 'Any job type', patch: { type: [] } });
  if (state.loc.length || data.chips.some((c) => c.kind === 'loc')) tips.push({ label: 'Search all of New Zealand', patch: { loc: [], q: fold(q).replace(new RegExp(data.chips.find((c) => c.kind === 'loc')?.match || '^$'), '').trim() } });
  if (state.source.length) tips.push({ label: 'Search every source', patch: { source: [] } });
  if (q && !tips.length) tips.push({ label: 'See the newest jobs instead', patch: { q: null } });
  return (
    <div className="mx-auto max-w-[520px] py-20 text-center">
      <p className="m-0 text-[22px] font-[650] tracking-[-0.03em]">Nothing matches all of that.</p>
      <p className="mt-2 text-[15px] text-muted">Try one of these:</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {tips.map((t) => (
          <button key={t.label} type="button" onClick={() => update(t.patch)} className="rounded-full bg-surface px-4 py-2.5 text-[14px] hover:bg-surface-2">
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomSheet({ job, onClose }: { job: CardJob; onClose: () => void }) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={job.title}>
      <div className="absolute inset-0 bg-black/40" style={{ animation: 'rdFade .2s ease' }} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[24px] bg-bg outline-none"
        style={{ transform: `translateY(${dy}px)`, transition: dragging ? 'none' : 'transform .2s ease', animation: 'rdSheet .25s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div
          className="flex flex-none cursor-grab touch-none items-center justify-between px-5 pb-2 pt-3"
          onPointerDown={(e) => {
            start.current = e.clientY;
            setDragging(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current != null && setDy(Math.max(0, e.clientY - start.current))}
          onPointerUp={() => {
            const d = dy;
            start.current = null;
            setDragging(false);
            if (d > 110) onClose();
            else setDy(0);
          }}
        >
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 pt-2">
          <JobPreview job={job} />
        </div>
      </div>
    </div>
  );
}
