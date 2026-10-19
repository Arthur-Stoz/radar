import { describe, expect, it } from 'vitest';
import { formatPay, parsePay } from '@/lib/pay';

type Case = [input: string, min: number | null, max: number | null, period: string | null];

// Real-world strings seen on Seek, Trade Me, government and ATS listings.
const CASES: Case[] = [
  ['$25–$30 per hour', 25, 30, 'hour'],
  ['$28/hr', 28, 28, 'hour'],
  ['$60k–$70k', 60000, 70000, 'year'],
  ['$65,000 + super', 65000, 65000, 'year'],
  ['Competitive', null, null, null],
  ['Competitive salary', null, null, null],
  ['$35 – $38 per hour', 35, 38, 'hour'],
  ['$75,000 – $95,000 per year', 75000, 95000, 'year'],
  ['$65,000 - $75,000 depending on experience', 65000, 75000, 'year'],
  ['$80K - $100K annually', 80000, 100000, 'year'],
  ['$40 - $55 per hour', 40, 55, 'hour'],
  ['$25.0 - $35.0 p.h.', 25, 35, 'hour'],
  ['$23.97 - $29.68', 23.97, 29.68, 'hour'],
  ['$26 - $40 p.h. + Kiwisaver + Annual & Sick Pay', 26, 40, 'hour'],
  ['$25-$27 paid weekly', 25, 27, 'hour'],
  ['$850 - $950 per day', 850, 950, 'day'],
  ['$120k + bonus', 120000, 120000, 'year'],
  ['$60-70k', 60000, 70000, 'year'],
  ['Up to $32 an hour', 32, 32, 'hour'],
  ['From $27 per hour', 27, 27, 'hour'],
  ['$30ph', 30, 30, 'hour'],
  ['$1,200 per week', 1200, 1200, 'week'],
  ['NZD 95,000 - 110,000', 95000, 110000, 'year'],
  ['$26 per hour plus tips', 26, 26, 'hour'],
  ['$24/h + 8% holiday pay', 24, 24, 'hour'],
  ['Hourly rate $25 to $30', 25, 30, 'hour'],
  ['$70,000 – $85,000 per year', 70000, 85000, 'year'],
  ['$110,000 - $130,000 + KiwiSaver', 110000, 130000, 'year'],
  ['Negotiable', null, null, null],
  ['Attractive remuneration package', null, null, null],
  ['$330 Annual Wellness Allowance', null, null, null],
  ['45+ hour weeks, immediate start', null, null, null],
  ['$5,000 per month', 5000, 5000, 'month'],
  ['$31.50 per hour', 31.5, 31.5, 'hour'],
  ['$55k', 55000, 55000, 'year'],
];

describe('parsePay', () => {
  it.each(CASES)('%s', (input, min, max, period) => {
    const p = parsePay(input);
    expect(p.text).toBe(input);
    expect(p.min).toBe(min);
    expect(p.max).toBe(max);
    expect(p.period).toBe(period);
  });

  it('converts annual to hourly (÷ 2080) and daily (÷ 8)', () => {
    expect(parsePay('$62,400 per year').hourlyMin).toBe(30);
    expect(parsePay('$240 per day').hourlyMin).toBe(30);
  });

  it('flags pay below the adult minimum wage, never above it', () => {
    expect(parsePay('$20 per hour').belowMinWage).toBe(true);
    expect(parsePay('$23.95 per hour').belowMinWage).toBe(false);
    expect(parsePay('$25 - $30 per hour').belowMinWage).toBe(false);
  });

  it('uses structured hints when there is no text', () => {
    const p = parsePay(null, { min: 90000, max: 110000, period: 'year' });
    expect(p.hourlyMax).toBeCloseTo(52.88, 1);
  });

  it('formats compactly', () => {
    expect(formatPay(parsePay('$27–$29 per hour'))).toBe('$27–29/h');
    expect(formatPay(parsePay('$60k–$70k'))).toBe('$60k–70k');
    expect(formatPay(parsePay('Competitive'))).toBeNull();
  });
});
