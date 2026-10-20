'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Portal, useAnchoredStyle, useDismiss } from './Floating';

export interface DropdownOption {
  value: string;
  label: string;
}

/** Custom select: a button + listbox (keyboard: arrows, Home/End, Enter/Space, Esc), rendered in a portal. */
export function Dropdown({
  options,
  value,
  onChange,
  prefix,
  ariaLabel,
  align = 'start',
  block = false,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  ariaLabel: string;
  align?: 'start' | 'end';
  /** Full-width field (forms) instead of a pill. */
  block?: boolean;
}) {
    const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchor = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];
  const close = useCallback(() => {
    setOpen(false);
    anchor.current?.focus();
  }, []);
  const pos = useAnchoredStyle(anchor, open, { align: block ? 'stretch' : align, offset: 6, width: 220, maxHeight: 320 });
  useDismiss([anchor, list], open, close, true);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  const show = (i: number) => {
    setActive(i);
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  };
  const pick = (i: number) => {
    const o = options[i];
    close();
    if (o.value !== value) onChange(o.value);
  };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => (a + 1) % options.length);
    else if (e.key === 'ArrowUp') setActive((a) => (a + options.length - 1) % options.length);
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Tab') setOpen(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${ariaLabel}: ${current.label}`}
        onClick={() => (open ? close() : show(options.indexOf(current)))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show(options.indexOf(current));
          }
        }}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-bg text-[14px] text-ink transition-colors hover:border-line-strong ${block ? 'h-10 w-full px-4' : 'h-9 flex-none px-3.5'}`}
      >
        {prefix && <span className="text-muted">{prefix}</span>}
        <span className={`font-medium ${block ? 'flex-1 truncate text-left' : ''}`}>{current.label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <Portal>
          <ul
            ref={list}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            data-floating-child
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onListKey}
            className="z-(--z-popover) m-0 list-none overflow-y-auto rounded-[16px] border border-line bg-bg p-1.5 text-ink outline-none"
            style={{ ...pos, boxShadow: 'var(--shadow-pop)', animation: 'rdFade .12s ease' }}
          >
            {options.map((o, i) => {
              const selected = o.value === current.value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-[14px] ${i === active ? 'bg-surface' : ''} ${selected ? 'font-medium' : ''}`}
                >
                  {o.label}
                  {selected && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </Portal>
      )}
    </>
  );
}

