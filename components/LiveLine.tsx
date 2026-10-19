'use client';

import { useEffect, useState } from 'react';

function since(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** "12,431 jobs from 9 sources · updated 14 min ago" — real numbers only. */
export function LiveLine({ total, sources, builtAt, className = '' }: { total?: number; sources?: number; builtAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return (
    <div className={`flex items-center gap-[9px] text-[13px] text-muted ${className}`}>
      <span className="pulse-dot" aria-hidden="true" />
      <span>
        {total != null && (
          <>
            <span className="font-mono text-ink-3">{total.toLocaleString('en-NZ')}</span> jobs
          </>
        )}
        {sources ? (
          <>
            {' '}from <span className="font-mono text-ink-3">{sources}</span> sources
          </>
        ) : null}
        {builtAt ? <>{total != null ? ' · updated ' : 'Updated '}<span suppressHydrationWarning>{now ? since(builtAt, now) : since(builtAt, Date.parse(builtAt))}</span></> : null}
      </span>
    </div>
  );
}
