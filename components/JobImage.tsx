'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The ad's photo (object-fit: cover) or the company logo (contained on a neutral tile), loaded lazily from the
 * source's CDN without a referrer. The box is sized by the caller, so nothing shifts while it loads; when the picture
 * is missing or fails, the caller's fallback (the monogram / place photo) shows instead.
 */
export function JobImage({
  src,
  kind,
  alt = '',
  className = '',
  logoPadding = 'p-[14%]',
  eager = false,
  fallback,
}: {
  src: string | null;
  kind: 'photo' | 'logo' | null;
  alt?: string;
  /** Size, radius and position of the box. */
  className?: string;
  logoPadding?: string;
  eager?: boolean;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An error that happened before hydration has no React listener yet: check once mounted.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (!src || !kind || failed) return <>{fallback}</>;
  return (
    <div className={`overflow-hidden ${kind === 'logo' ? `bg-white ${logoPadding}` : 'bg-surface'} ${className}`} style={kind === 'logo' ? { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`block h-full w-full ${kind === 'logo' ? 'object-contain' : 'object-cover'}`}
      />
    </div>
  );
}
