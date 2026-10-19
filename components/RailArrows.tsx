'use client';

/** Prev/next buttons for a horizontal rail rendered on the server. */
export function RailArrows({ target }: { target: string }) {
  const scroll = (d: number) => document.getElementById(target)?.scrollBy({ left: d * 640, behavior: 'smooth' });
  return (
    <div className="hidden gap-2 sm:flex">
      <button type="button" onClick={() => scroll(-1)} aria-label="Scroll back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface transition-colors hover:bg-surface-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button type="button" onClick={() => scroll(1)} aria-label="Scroll forward" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface transition-colors hover:bg-surface-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
