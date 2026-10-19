// Pay parsing (BUILD.md §4.2). Always keeps the raw text; numbers only when we are confident.

export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface Pay {
  text: string | null;
  min: number | null;
  max: number | null;
  period: PayPeriod | null;
  hourlyMin: number | null;
  hourlyMax: number | null;
  belowMinWage: boolean;
}

/** NZ adult minimum wage since 1 April 2026. */
export const MIN_WAGE = 23.95;

const HOURS_PER: Record<PayPeriod, number> = { hour: 1, day: 8, week: 40, month: 2080 / 12, year: 2080 };

const PERIOD_PATTERNS: [PayPeriod, RegExp][] = [
  ['hour', /(per|an|a|\/|p\.?\s?)\s?(hour|hr|h)\b|\bp\.?h\b\.?|hourly|\bph\b|per hr|\/hour/i],
  ['day', /(per|a|\/)\s?day\b|\bdaily\b|\bp\.?d\b\.?|day rate/i],
  ['week', /(per|a|\/)\s?(week|wk)\b|\bweekly\b|\bp\.?w\b\.?/i],
  ['month', /(per|a|\/)\s?(month|mth)\b|\bmonthly\b/i],
  ['year', /(per|a|\/)\s?(annum|year|yr)\b|\bp\.?a\b\.?|annual(ly)?|\bsalary\b|\bpa\b|\bp\/a\b|\bbase\b/i],
];

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*([kK])?`;
const MONEY_RE = new RegExp(String.raw`(\$|NZD\s?|NZ\$)?\s?${NUM}`, 'g');

interface Num {
  value: number;
  hasDollar: boolean;
  hasK: boolean;
  index: number;
  end: number;
}

function numbers(text: string): Num[] {
  const out: Num[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const raw = m[2].replace(/,/g, '');
    let value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    const hasK = !!m[3];
    if (hasK) value *= 1000;
    const end = (m.index ?? 0) + m[0].length;
    const after = text.slice(end, end + 12).toLowerCase();
    // Skip percentages, hours, years, ages, counts.
    if (/^\s?(%|percent|\+?\s?(hours|hrs|hour weeks|hr week|years|yrs|year|weeks|days|people|staff|am|pm|week|month|min)\b)/.test(after) && !m[1]) continue;
    if (!m[1] && value >= 1900 && value <= 2100 && !hasK) continue; // a year like 2026
    out.push({ value, hasDollar: !!m[1], hasK, index: m.index ?? 0, end });
  }
  return out;
}

function detectPeriod(text: string): PayPeriod | null {
  for (const [p, re] of PERIOD_PATTERNS) if (re.test(text)) return p;
  return null;
}

function inferPeriod(v: number): PayPeriod | null {
  if (v >= 15 && v <= 250) return 'hour';
  if (v >= 20000 && v <= 1_000_000) return 'year';
  return null;
}

function plausible(v: number, p: PayPeriod): boolean {
  const h = v / HOURS_PER[p];
  return h >= 10 && h <= 600;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function emptyPay(text: string | null = null): Pay {
  return { text, min: null, max: null, period: null, hourlyMin: null, hourlyMax: null, belowMinWage: false };
}

export function parsePay(input: string | null | undefined, hint?: { period?: PayPeriod | null; min?: number | null; max?: number | null }): Pay {
  const text = (input || '').replace(/\s+/g, ' ').trim();
  const pay = emptyPay(text || null);

  let min: number | null = hint?.min ?? null;
  let max: number | null = hint?.max ?? null;
  let period: PayPeriod | null = hint?.period ?? null;

  if (min == null && text) {
    const nums = numbers(text);
    const dollar = nums.filter((n) => n.hasDollar || n.hasK);
    // Without a $ or k we only accept a clear range/period phrase ("25-30 per hour").
    const usable = dollar.length ? dollar : detectPeriod(text) ? nums : [];
    if (usable.length) {
      const first = usable[0];
      min = first.value;
      // Range: "$25–$30", "$25 - 30", "$60k to $70k", "between $25 and $30".
      const second = nums[nums.indexOf(first) + 1];
      if (second) {
        const between = text.slice(first.end, second.index);
        if (/^\s*(-|–|—|to|and|up to|\/)\s*(\$|nzd)?\s*$/i.test(between)) {
          max = second.value;
          // "$60-70k": the k applies to both.
          if (second.hasK && !first.hasK && first.value < 1000) min = first.value * 1000;
        }
      }
      if (max == null) max = min;
      if (max < min) [min, max] = [max, min];
    }
  }
  if (min == null) return pay;

  period = detectPeriod(text) ?? period ?? inferPeriod(max ?? min);
  if (!period) return pay;
  if (!plausible(min, period) || !plausible(max ?? min, period)) {
    // e.g. "$65,000" tagged hourly by a wrong hint: re-infer from magnitude.
    const p2 = inferPeriod(max ?? min);
    if (!p2 || !plausible(min, p2)) return pay;
    period = p2;
  }

  pay.min = min;
  pay.max = max ?? min;
  pay.period = period;
  pay.hourlyMin = round2(min / HOURS_PER[period]);
  pay.hourlyMax = round2((max ?? min) / HOURS_PER[period]);
  pay.belowMinWage = pay.hourlyMax < MIN_WAGE;
  return pay;
}

/** Short display: "$27–29/h", "$60k–70k", "$65k". */
export function formatPay(p: Pick<Pay, 'min' | 'max' | 'period' | 'text'>): string | null {
  if (p.min == null || !p.period) return null;
  const max = p.max ?? p.min;
  if (p.period === 'year') {
    const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
    return p.min === max ? `$${k(p.min)}` : `$${k(p.min)}–${k(max)}`;
  }
  const n = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(2));
  const suffix = { hour: '/h', day: '/day', week: '/wk', month: '/mo' }[p.period];
  return p.min === max ? `$${n(p.min)}${suffix}` : `$${n(p.min)}–${n(max)}${suffix}`;
}
