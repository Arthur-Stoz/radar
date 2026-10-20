'use client';

import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Shared plumbing for every floating layer (popovers, menus, autocomplete, bottom panels).
// Layers render in a portal on <body>, so no parent stacking context (isolate, z-index, transform) or overflow can
// cover or clip them; their z-index comes from the scale in globals.css (--z-*).

const noop = () => () => {};

/** Renders children into document.body (after hydration). */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}

/** True below Tailwind's `sm` breakpoint, where popovers become bottom panels. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia('(max-width: 639.98px)');
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia('(max-width: 639.98px)').matches,
    () => false,
  );
}

const GUTTER = 8;

/**
 * Fixed-position style that keeps a floating element attached to its anchor: below it (or above when there is more
 * room there), aligned to its start or end edge, clamped inside the viewport, and following scroll and resize.
 */
export function useAnchoredStyle(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  { align = 'start', offset = 8, width, maxHeight = 560 }: { align?: 'start' | 'end' | 'stretch'; offset?: number; width?: number; maxHeight?: number } = {},
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const w = Math.min(align === 'stretch' ? r.width : (width ?? r.width), vw - GUTTER * 2);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(GUTTER, Math.min(left, vw - GUTTER - w));
      const below = vh - r.bottom - offset - GUTTER;
      const above = r.top - offset - GUTTER;
      const flip = below < Math.min(maxHeight, 320) && above > below;
      const space = Math.max(160, flip ? above : below);
      setStyle({
        position: 'fixed',
        left,
        width: w,
        maxHeight: Math.min(maxHeight, space),
        ...(flip ? { bottom: vh - r.top + offset } : { top: r.bottom + offset }),
      });
    };
    let raf = requestAnimationFrame(place);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, anchor, align, offset, width, maxHeight]);

  return style;
}

const inChildLayer = (n: EventTarget | null) => n instanceof Element && !!n.closest('[data-floating-child]');

/**
 * Closes on a pointer press outside every given element, and on Escape. A menu opened from inside another layer
 * (`child`, marked data-floating-child) handles its own presses and Escape first, without closing its parent.
 */
export function useDismiss(refs: RefObject<HTMLElement | null>[], open: boolean, onClose: () => void, child = false) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!child && inChildLayer(t)) return;
      if (!refs.some((r) => r.current?.contains(t))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!child && inChildLayer(document.activeElement)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, child, refs]);
}
