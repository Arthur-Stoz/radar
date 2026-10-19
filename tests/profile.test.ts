import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunkText, extractProfile, meanNormalized } from '@/lib/profile';
import { matchPercent } from '@/lib/search';

const cv = readFileSync(join(__dirname, 'fixtures', 'cv-hospitality.txt'), 'utf8');

describe('extractProfile', () => {
  const chips = extractProfile(cv);
  const labels = chips.map((c) => c.label);

  it('finds job titles and skills', () => {
    expect(chips.filter((c) => c.kind === 'title').map((c) => c.label)).toContain('Barista');
    expect(labels).toEqual(expect.arrayContaining(['Food & beverage', 'Food safety', 'Cash handling']));
  });
  it('finds languages, licences and visa hints', () => {
    expect(labels).toEqual(expect.arrayContaining(['French', 'English', 'Spanish']));
    expect(labels).toEqual(expect.arrayContaining(['Full driver licence', 'First aid']));
    expect(labels).toContain('Working holiday visa');
  });
  it('never repeats a label across kinds', () => {
    const lower = labels.map((l) => l.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
  it('uses the server vocabulary for titles', () => {
    const c = extractProfile('I worked three years as a glacier guide in Franz Josef.', ['glacier guide']);
    expect(c.find((x) => x.kind === 'title')?.label).toBe('Glacier Guide');
  });
  it('stays quiet on unrelated text', () => {
    expect(extractProfile('Lorem ipsum dolor sit amet.')).toEqual([]);
  });
});

describe('chunking and vectors', () => {
  it('chunks long text into bounded pieces', () => {
    const chunks = chunkText(cv);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1200)).toBe(true);
  });
  it('mean vector is unit length', () => {
    const v = meanNormalized([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
  });
  it('match percent is monotonic and bounded', () => {
    expect(matchPercent(0.7)).toBeGreaterThan(matchPercent(0.5));
    expect(matchPercent(0.5)).toBeGreaterThan(matchPercent(0.3));
    expect(matchPercent(5)).toBe(99);
    expect(matchPercent(-5)).toBe(1);
  });
});
