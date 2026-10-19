'use client';

import { useSyncExternalStore } from 'react';

type Pref = 'system' | 'light' | 'dark';
const KEY = 'radar-theme';
const listeners = new Set<() => void>();

function readPref(): Pref {
  try {
    return (localStorage.getItem(KEY) as Pref) || 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const m = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => {
    if (readPref() === 'system') apply('system');
  };
  m.addEventListener('change', onSystem);
  return () => {
    listeners.delete(cb);
    m.removeEventListener('change', onSystem);
  };
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => 'system' as Pref);
  const next: Record<Pref, Pref> = { system: 'light', light: 'dark', dark: 'system' };
  const label = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }[pref];

  return (
    <button
      type="button"
      aria-label={`${label}. Change theme`}
      title={label}
      onClick={() => {
        const n = next[pref];
        try {
          localStorage.setItem(KEY, n);
        } catch {}
        apply(n);
        listeners.forEach((l) => l());
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface ${className}`}
    >
      {pref === 'dark' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : pref === 'light' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></svg>
      )}
    </button>
  );
}
