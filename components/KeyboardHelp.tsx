'use client';

import { useEffect, useRef, useState } from 'react';

const KEYS: [string, string][] = [
  ['/', 'Focus the search bar'],
  ['J / K', 'Next / previous job'],
  ['Enter', 'Open the job'],
  ['O', 'Open the original ad'],
  ['Esc', 'Close'],
  ['?', 'Show these shortcuts'],
];

/** "?" opens a small list of keyboard shortcuts (design board "Shortcuts"). */
export function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative w-full max-w-[380px] rounded-[20px] bg-bg p-6" style={{ boxShadow: 'var(--shadow-pop)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-[18px] font-[650] tracking-[-0.02em]">Keyboard shortcuts</h2>
          <button ref={close} type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface">
            ×
          </button>
        </div>
        <dl className="m-0 flex flex-col gap-2.5">
          {KEYS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-ink-2">{d}</dt>
              <dd className="m-0">
                <kbd className="rounded-[8px] border border-line bg-surface px-2 py-1 font-mono text-[12px]">{k}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
