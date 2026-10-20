'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Dropdown } from './Dropdown';
import { Portal, useAnchoredStyle, useDismiss, useIsPhone } from './Floating';
import type { FacetCount, SearchResult } from '@/lib/search';

export interface FilterState {
  loc: string[];
  type: string[];
  pay: number | null;
  posted: string | null;
  tags: string[];
  source: string[];
  sort: string | null;
}

function Popover({ label, active, children, wide = false }: { label: string; active: boolean; children: (close: () => void) => React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const phone = useIsPhone();
  const close = useCallback(() => setOpen(false), []);
  const pos = useAnchoredStyle(anchor, open && !phone, { width: wide ? 420 : 300, maxHeight: 560 });
  useDismiss([anchor, panel], open, close);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[14px] text-[14px] transition-colors ${
          active ? 'bg-ink text-on-ink' : 'bg-surface text-ink-2 hover:bg-surface-2'
        }`}
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <Portal>
          {phone && <div className="fixed inset-0 z-(--z-backdrop) bg-black/30" aria-hidden="true" />}
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            className={`overflow-y-auto overscroll-contain border border-line bg-bg p-4 text-ink ${phone ? 'fixed inset-x-0 bottom-0 z-(--z-sheet) max-h-[80dvh] rounded-t-[20px]' : 'z-(--z-popover) rounded-[20px]'}`}
            style={{ ...(phone ? null : pos), boxShadow: 'var(--shadow-pop)', animation: 'rdFade .15s ease' }}
          >
            {phone && (
              <div className="sticky -top-4 z-(--z-raised) -mx-4 -mt-4 mb-2 flex items-center justify-between border-b border-line bg-bg px-4 py-3">
                <span className="text-[15px] font-[650]">{label}</span>
                <button type="button" onClick={close} className="h-8 rounded-full bg-surface px-4 text-[14px] font-medium">
                  Done
                </button>
              </div>
            )}
            {children(close)}
          </div>
        </Portal>
      )}
    </>
  );
}

function CheckRow({ checked, onChange, label, count, indent = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; count: number; indent?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 text-[14px] hover:bg-surface ${indent ? 'ml-6' : ''} ${count === 0 && !checked ? 'opacity-50' : ''}`}>
      <span className="flex items-center gap-2.5">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        {label}
      </span>
      <span className="font-mono text-[12px] text-muted">{count.toLocaleString('en-NZ')}</span>
    </label>
  );
}

function RadioRow({ checked, onChange, label, count, name }: { checked: boolean; onChange: () => void; label: string; count?: number; name: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 text-[14px] hover:bg-surface">
      <span className="flex items-center gap-2.5">
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--accent)]" />
        {label}
      </span>
      {count != null && <span className="font-mono text-[12px] text-muted">{count.toLocaleString('en-NZ')}</span>}
    </label>
  );
}

const toggle = (arr: string[], v: string, on: boolean) => (on ? [...new Set([...arr, v])] : arr.filter((x) => x !== v));

export function FilterBar({ facets, state, onChange }: { facets: SearchResult['facets']; state: FilterState; onChange: (patch: Partial<FilterState>) => void }) {
  const regionsSel = facets.region.filter((r) => state.loc.includes(r.value));
  const citiesSel = facets.city.filter((c) => state.loc.includes(c.value));
  const locLabel = state.loc.length === 0 ? 'Location' : state.loc.length === 1 ? (regionsSel[0]?.label ?? citiesSel[0]?.label ?? 'Location') : `Location · ${state.loc.length}`;
  const typeLabel = state.type.length === 0 ? 'Job type' : state.type.length === 1 ? facets.type.find((t) => t.value === state.type[0])?.label || 'Job type' : `Job type · ${state.type.length}`;
  const tagsLabel = state.tags.length === 0 ? 'Perks' : state.tags.length === 1 ? facets.tags.find((t) => t.value === state.tags[0])?.label || 'Perks' : `Perks · ${state.tags.length}`;
  const srcLabel = state.source.length === 0 ? 'Source' : state.source.length === 1 ? facets.source.find((t) => t.value === state.source[0])?.label || 'Source' : `Source · ${state.source.length}`;
  const postedLabel = state.posted ? facets.posted.find((p) => p.value === state.posted)?.label || 'Posted' : 'Posted';
  const anyActive = state.loc.length || state.type.length || state.pay || state.posted || state.tags.length || state.source.length;

  const citiesOf = (region: string): FacetCount[] => facets.city.filter((c) => c.parent === region).slice(0, 12);

  return (
    <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Popover label={locLabel} active={state.loc.length > 0} wide>
        {() => (
          <div className="flex flex-col">
            <p className="mb-1 mt-0 px-2.5 text-[13px] text-muted">Regions and towns</p>
            {facets.region.map((r) => {
              const on = state.loc.includes(r.value);
              const cities = citiesOf(r.value);
              const showCities = on || cities.some((c) => state.loc.includes(c.value));
              return (
                <div key={r.value}>
                  <CheckRow checked={on} label={r.label} count={r.count} onChange={(v) => onChange({ loc: toggle(state.loc, r.value, v).filter((x) => v ? !cities.some((c) => c.value === x) : true) })} />
                  {showCities &&
                    cities.map((c) => (
                      <CheckRow key={c.value} indent checked={state.loc.includes(c.value)} label={c.label} count={c.count} onChange={(v) => onChange({ loc: toggle(state.loc.filter((x) => x !== r.value), c.value, v) })} />
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </Popover>

      <Popover label={typeLabel} active={state.type.length > 0}>
        {() => (
          <div className="flex flex-col">
            {facets.type.map((t) => (
              <CheckRow key={t.value} checked={state.type.includes(t.value)} label={t.label} count={t.count} onChange={(v) => onChange({ type: toggle(state.type, t.value, v) })} />
            ))}
          </div>
        )}
      </Popover>

      <Popover label={state.pay ? `Pay: $${state.pay}+/h` : 'Pay'} active={!!state.pay}>
        {(close) => (
          <div className="flex flex-col">
            <p className="mb-1 mt-0 px-2.5 text-[13px] text-muted">Minimum hourly pay (only jobs that show pay)</p>
            <RadioRow name="pay" checked={!state.pay} label="Any pay" onChange={() => (onChange({ pay: null }), close())} />
            {facets.pay.map((p) => (
              <RadioRow key={p.value} name="pay" checked={state.pay === Number(p.value)} label={p.label} count={p.count} onChange={() => (onChange({ pay: Number(p.value) }), close())} />
            ))}
          </div>
        )}
      </Popover>

      <Popover label={postedLabel} active={!!state.posted}>
        {(close) => (
          <div className="flex flex-col">
            <RadioRow name="posted" checked={!state.posted} label="Any time" onChange={() => (onChange({ posted: null }), close())} />
            {facets.posted.map((p) => (
              <RadioRow key={p.value} name="posted" checked={state.posted === p.value} label={p.label} count={p.count} onChange={() => (onChange({ posted: p.value }), close())} />
            ))}
          </div>
        )}
      </Popover>

      <Popover label={tagsLabel} active={state.tags.length > 0}>
        {() => (
          <div className="flex flex-col">
            {facets.tags.map((t) => (
              <CheckRow key={t.value} checked={state.tags.includes(t.value)} label={t.label} count={t.count} onChange={(v) => onChange({ tags: toggle(state.tags, t.value, v) })} />
            ))}
          </div>
        )}
      </Popover>

      <Popover label={srcLabel} active={state.source.length > 0}>
        {() => (
          <div className="flex flex-col">
            {facets.source.map((t) => (
              <CheckRow key={t.value} checked={state.source.includes(t.value)} label={t.label} count={t.count} onChange={(v) => onChange({ source: toggle(state.source, t.value, v) })} />
            ))}
          </div>
        )}
      </Popover>

      {anyActive ? (
        <button type="button" onClick={() => onChange({ loc: [], type: [], pay: null, posted: null, tags: [], source: [] })} className="h-9 flex-none whitespace-nowrap px-2 text-[14px] text-muted hover:text-ink">
          Clear all
        </button>
      ) : null}
    </div>
  );
}

const SORTS = [
  { value: 'best', label: 'Best match' },
  { value: 'new', label: 'Newest' },
  { value: 'pay', label: 'Highest pay' },
];

export function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void; hasQuery?: boolean }) {
  return <Dropdown options={SORTS} value={value} onChange={onChange} prefix="Sort:" ariaLabel="Sort results" align="end" />;
}

const prettySlug = (v: string) => v.replace(/-city$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The active filters as removable chips (under the filter bar). */
export function ActiveFilters({ facets, state, onChange }: { facets: SearchResult['facets']; state: FilterState; onChange: (patch: Partial<FilterState>) => void }) {
  const label = (list: FacetCount[], v: string) => list.find((x) => x.value === v)?.label ?? prettySlug(v);
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...state.loc.map((v) => ({ key: `loc-${v}`, label: label([...facets.region, ...facets.city], v), remove: () => onChange({ loc: state.loc.filter((x) => x !== v) }) })),
    ...state.type.map((v) => ({ key: `type-${v}`, label: label(facets.type, v), remove: () => onChange({ type: state.type.filter((x) => x !== v) }) })),
    ...(state.pay ? [{ key: 'pay', label: `$${state.pay}+/h`, remove: () => onChange({ pay: null }) }] : []),
    ...(state.posted ? [{ key: 'posted', label: label(facets.posted, state.posted), remove: () => onChange({ posted: null }) }] : []),
    ...state.tags.map((v) => ({ key: `tag-${v}`, label: label(facets.tags, v), remove: () => onChange({ tags: state.tags.filter((x) => x !== v) }) })),
    ...state.source.map((v) => ({ key: `src-${v}`, label: label(facets.source, v), remove: () => onChange({ source: state.source.filter((x) => x !== v) }) })),
  ];
  if (!chips.length) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button type="button" onClick={c.remove} aria-label={`Remove filter ${c.label}`} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] text-ink hover:bg-surface-2">
            {c.label}
            <span aria-hidden="true" className="text-muted">
              ×
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
