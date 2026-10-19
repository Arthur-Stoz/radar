import { formatPay } from './pay';

/** "2h", "3d", "just now" */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 3600) return s < 120 ? 'just now' : `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (86400 * 30))}mo`;
}

export function agoLong(iso: string | null | undefined, now = Date.now()): string {
  const a = ago(iso, now);
  return !a ? '' : a === 'just now' ? a : `${a} ago`;
}

export function payLabel(j: { payMin: number | null; payMax: number | null; payPeriod: string | null; payText: string | null }): string | null {
  return formatPay({ min: j.payMin, max: j.payMax, period: j.payPeriod as never, text: j.payText });
}

export function number(n: number): string {
  return n.toLocaleString('en-NZ');
}

/** Deterministic hue from a string (gradient placeholders). */
export function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function gradient(h: number): string {
  return `radial-gradient(90% 80% at 15% 8%, oklch(0.95 0.045 ${h}) 0%, transparent 70%), radial-gradient(80% 90% at 95% 100%, oklch(0.87 0.085 ${(h + 45) % 360}) 0%, transparent 72%), oklch(0.925 0.045 ${(h + 20) % 360})`;
}

const PHOTOS: Record<string, string> = {
  queenstown: 'queenstown', 'wānaka': 'wanaka', wanaka: 'wanaka', 'franz josef': 'franz', 'fox glacier': 'fox', 'milford sound': 'milford',
  'kaikōura': 'kaikoura', kaikoura: 'kaikoura', blenheim: 'blenheim', 'te puke': 'tepuke', paihia: 'paihia', 'waiheke island': 'waiheke',
  'lake tekapo': 'tekapo', 'stewart island': 'stewart', ponsonby: 'ponsonby',
};

/** A real photo of the place when we have one (design assets), else null. */
export function placePhoto(city: string | null, suburb?: string | null): string | null {
  const k = (suburb || '').toLowerCase();
  if (PHOTOS[k]) return `/assets/photos/${PHOTOS[k]}.webp`;
  const c = (city || '').toLowerCase();
  return PHOTOS[c] ? `/assets/photos/${PHOTOS[c]}.webp` : null;
}
