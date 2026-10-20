'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { CvButton } from './CvButton';
import { RadarSweep } from './RadarSweep';
import { Portal, useAnchoredStyle } from './Floating';

interface Suggestion {
  kind: 'title' | 'company' | 'place' | 'combo';
  label: string;
  q: string;
  count: number;
}

const PLACEHOLDERS = ['barista in Auckland', 'live-in jobs, South Island', '$30+ an hour, no experience', 'fruit picking with accommodation'];

export function SearchBar({
  variant,
  initial = '',
  onSearch,
  autoFocus = false,
  extraParams,
}: {
  variant: 'hero' | 'compact';
  initial?: string;
  /** Called instead of navigating (search page keeps its own state). */
  onSearch?: (q: string) => void;
  autoFocus?: boolean;
  /** Params to keep when navigating (e.g. filters on the search page). */
  extraParams?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [ph, setPh] = useState(0);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const listId = useId();
  const reqId = useRef(0);
  const hero = variant === 'hero';

  // Keep in sync when the URL changes (back/forward).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }

  useEffect(() => {
    if (!hero) return;
    const t = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, [hero]);

  // "/" focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const fetchSuggest = (q: string) => {
    const id = ++reqId.current;
    if (!q.trim()) {
      setItems([]);
      return;
    }
    fetch(`/api/suggest?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Suggestion[]) => {
        if (id !== reqId.current) return;
        setItems(data);
        setActive(-1);
      })
      .catch(() => {});
  };

  const go = (q: string) => {
    setOpen(false);
    input.current?.blur();
    if (onSearch) return onSearch(q.trim());
    const params = new URLSearchParams(extraParams || '');
    if (q.trim()) params.set('q', q.trim());
    else params.delete('q');
    params.delete('page');
    router.push(`/search${params.size ? `?${params}` : ''}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) {
      setValue(items[active].q);
      return go(items[active].q);
    }
    go(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && focused && items.length > 0;
  const listPos = useAnchoredStyle(form, showList, { align: 'stretch', offset: 8, maxHeight: 440 });
  const barHeight = hero ? 'h-(--hero-bar-h)' : 'h-11';

  return (
    <div className={`relative ${hero ? 'w-full max-w-(--hero-bar-max)' : 'w-full'}`}>
      {hero && <RadarSweep on={focused} />}
      <form
        ref={form}
        role="search"
        onSubmit={submit}
        className={`relative flex items-center gap-1.5 rounded-full border bg-bg transition-[border-color,box-shadow] duration-200 ${barHeight} ${hero ? 'pl-5 pr-[7px] sm:pl-7 sm:pr-2' : 'pl-4 pr-1.5'}`}
        style={{
          borderColor: focused ? 'var(--accent)' : hero ? 'var(--line)' : 'var(--line)',
          boxShadow: focused ? '0 0 0 4px var(--accent-soft), 0 12px 32px rgba(0,0,0,.06)' : hero ? 'var(--shadow-bar)' : 'none',
          background: hero ? 'var(--bg)' : 'var(--surface)',
        }}
      >
        <svg width={hero ? 22 : 17} height={hero ? 22 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-none text-ink" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <div className="relative h-full min-w-0 flex-1">
          <input
            ref={input}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              fetchSuggest(e.target.value);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
              if (value) fetchSuggest(value);
            }}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            aria-label="Search every job in New Zealand"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={hero ? '' : 'Search jobs, places, companies'}
            className={`absolute inset-0 h-full w-full border-0 bg-transparent px-3 tracking-[-0.01em] text-ink outline-none placeholder:text-muted ${hero ? 'text-(length:--hero-bar-font)' : 'text-[15px]'}`}
            style={{ outline: 'none' }}
          />
          {hero && !value && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 right-2 flex items-center overflow-hidden text-(length:--hero-bar-font) tracking-[-0.01em] text-muted">
              <span key={ph} className="block truncate" style={{ animation: 'rdPh .55s cubic-bezier(.2,.8,.2,1)' }}>
                {PLACEHOLDERS[ph]}
              </span>
            </div>
          )}
        </div>
        <CvButton compact={!hero} getQuery={() => value} />
        {hero ? (
          <button
            type="submit"
            className="h-(--hero-btn-h) flex-none rounded-full bg-ink px-5 text-[16px] font-[550] tracking-[-0.01em] text-on-ink transition-[background,transform] duration-150 hover:opacity-90 active:scale-[.97] sm:px-[30px] sm:text-[17px]"
          >
            Search
          </button>
        ) : (
          <button type="submit" aria-label="Search" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-on-ink transition-transform active:scale-95">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </form>

      <Portal>
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        className={`z-(--z-popover) m-0 list-none overflow-y-auto rounded-[20px] border border-line bg-bg p-1.5 text-left text-ink ${showList ? '' : 'hidden'}`}
        style={{ ...listPos, boxShadow: 'var(--shadow-pop)' }}
      >
        {items.map((s, i) => (
          <li
            key={`${s.kind}-${s.q}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              setValue(s.q);
              go(s.q);
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-[15px] ${i === active ? 'bg-surface' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <SuggestIcon kind={s.kind} />
              <span className="truncate">{s.label}</span>
            </span>
            {s.count > 0 && <span className="flex-none font-mono text-[12px] text-muted">{s.count.toLocaleString('en-NZ')}</span>}
          </li>
        ))}
      </ul>
      </Portal>
    </div>
  );
}

function SuggestIcon({ kind }: { kind: Suggestion['kind'] }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'flex-none text-muted', 'aria-hidden': true };
  if (kind === 'place' || kind === 'combo')
    return (
      <svg {...common}>
        <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  if (kind === 'company')
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}
