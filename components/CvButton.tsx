'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { getCvServerState, getCvState, OPEN_CV_EVENT, subscribeCv } from '@/lib/cvState';

export { OPEN_CV_EVENT };

const CvPanel = dynamic(() => import('./CvPanel'), { ssr: false });

export function useCv() {
  return useSyncExternalStore(subscribeCv, getCvState, getCvServerState);
}

export function LensIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h4M9 17h6" />
        <path d="M18.5 1.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none" />
      </svg>
      {active && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" aria-hidden="true" />}
    </span>
  );
}

/** The "lens" button at the right of the search bar. The panel (and the CV reader) load only when opened. */
export function CvButton({ getQuery, compact = false }: { getQuery?: () => string; compact?: boolean }) {
  const cv = useCv();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CV_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CV_EVENT, onOpen);
  }, []);

  return (
    <div ref={root} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={cv.profile ? 'Your CV match (on)' : 'Match with your CV'}
        title="Match with your CV"
        className={`flex flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-surface ${compact ? 'h-8 w-8' : 'h-11 w-11 sm:h-12 sm:w-12'}`}
      >
        <LensIcon active={!!cv.profile} />
      </button>
      {open && <CvPanel id={id} anchor={root} getQuery={getQuery} onClose={close} />}
    </div>
  );
}

/** Drop a CV anywhere on the page (Home and Search). */
export function CvDropZone() {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const overFn = (e: DragEvent) => hasFile(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      window.dispatchEvent(new Event(OPEN_CV_EVENT));
      void import('@/lib/cvClient').then((m) => m.processCv(f, getCvState().profile?.loc || ''));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, []);
  if (!over) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-drop) flex items-center justify-center bg-bg/80 backdrop-blur-sm" aria-hidden="true">
      <div className="rounded-[20px] border-2 border-dashed border-accent bg-bg px-10 py-8 text-center">
        <p className="m-0 text-[20px] font-[650] tracking-[-0.02em]">Drop your CV to match jobs</p>
        <p className="m-0 mt-1 text-[14px] text-muted">Read on your device. Never uploaded.</p>
      </div>
    </div>
  );
}
