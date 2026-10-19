import { TAG_SHORT, type Tag } from '@/lib/tags';

export interface BadgeJob {
  postedAt: string;
  tags: Tag[];
  expiresAt?: string | null;
}

const PRIORITY: Tag[] = ['whv-friendly', 'accommodation', 'no-experience', 'remote', 'visa-sponsorship', 'immediate-start', 'student-friendly', 'seasonal', 'transport-provided'];

/** Up to `max` badges: New (accent), then the most useful tags, then Closing soon. */
export function badgesFor(j: BadgeJob, max = 3, now = Date.now()): { label: string; tone: 'new' | 'plain' | 'outline' }[] {
  const out: { label: string; tone: 'new' | 'plain' | 'outline' }[] = [];
  if (now - Date.parse(j.postedAt) < 12 * 3600_000) out.push({ label: 'New', tone: 'new' });
  for (const t of PRIORITY) if (j.tags.includes(t) && out.length < max) out.push({ label: TAG_SHORT[t], tone: 'plain' });
  if (j.expiresAt && Date.parse(j.expiresAt) - now < 3 * 86400_000 && Date.parse(j.expiresAt) > now && out.length < max + 1) out.push({ label: 'Closing soon', tone: 'outline' });
  return out.slice(0, max);
}

export function Badge({ label, tone }: { label: string; tone: 'new' | 'plain' | 'outline' }) {
  const style =
    tone === 'new'
      ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }
      : tone === 'outline'
        ? { background: 'var(--bg)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line-strong)', fontWeight: 500 }
        : { background: 'var(--surface)', color: 'var(--ink-3)', fontWeight: 500 };
  return (
    <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-full px-[9px] text-[12px]" style={style}>
      {label}
    </span>
  );
}

export function SourceMark({ source, name, size = 14 }: { source: string; name: string; size?: number }) {
  // Monogram instead of a third-party favicon: no request leaves the visitor's browser.
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-[4px] bg-surface-2 font-semibold text-ink-3"
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1 }}
      data-source={source}
    >
      {name.slice(0, 1)}
    </span>
  );
}
