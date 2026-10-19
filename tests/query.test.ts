import { describe, expect, it } from 'vitest';
import { parseQuery } from '@/lib/query';
import { buildUnits, ftsQuery } from '@/lib/search';
import { canonicalOf, synonymGroupCount, synonymsOf } from '@/lib/synonyms';

describe('parseQuery', () => {
  it('extracts location, pay, type and tags as chips', () => {
    const p = parseQuery('part time barista in Auckland $28/h no experience');
    expect(p.keywords).toBe('barista');
    const kinds = Object.fromEntries(p.chips.map((c) => [c.kind, c.value]));
    expect(kinds.loc).toBe('city:Auckland');
    expect(kinds.pay).toBe(28);
    expect(kinds.type).toBe('part-time');
    expect(kinds.tag).toBe('no-experience');
  });

  it('understands annual pay and region names', () => {
    const p = parseQuery('developer 120k+ wellington');
    expect(p.chips.find((c) => c.kind === 'pay')?.value).toBe(58);
    expect(p.chips.find((c) => c.kind === 'loc')?.value).toBe('city:Wellington');
    expect(p.keywords).toBe('developer');
  });

  it('maps backpacker words to tags', () => {
    const p = parseQuery('fruit picking backpackers hawkes bay');
    expect(p.chips.map((c) => c.value)).toEqual(expect.arrayContaining(['whv-friendly', 'region:hawkes-bay']));
    expect(p.keywords).toBe('fruit picking');
  });

  it('keeps plain keywords', () => {
    expect(parseQuery('software engineer').keywords).toBe('software engineer');
    expect(parseQuery('').chips).toEqual([]);
  });

  it('handles macrons and "near"', () => {
    expect(parseQuery('cafe near Whangārei').chips[0].value).toBe('city:Whangārei');
    expect(parseQuery('kitchen hand near ponsonby').chips[0].value).toBe('city:Auckland');
  });
});

describe('synonyms', () => {
  it('has a large dictionary', () => {
    expect(synonymGroupCount()).toBeGreaterThanOrEqual(190);
  });
  it('expands both ways', () => {
    expect(synonymsOf('barista')).toContain('coffee');
    expect(synonymsOf('coffee')).toContain('barista');
    expect(synonymsOf('kp')).toContain('kitchen hand');
    expect(synonymsOf('waitress')).toContain('waiter');
    expect(synonymsOf('hospo')).toContain('hospitality');
    expect(synonymsOf('nanny')).toContain('au pair');
    expect(synonymsOf('housekeeper')).toContain('room attendant');
    expect(synonymsOf('dev')).toContain('software engineer');
  });
  it('maps backpacker languages to English', () => {
    expect(canonicalOf('serveur')).toBe('waiter');
    expect(canonicalOf('Kellner')).toBe('waiter');
    expect(canonicalOf('camarero')).toBe('waiter');
    expect(canonicalOf('cueillette')).toBe('fruit picking');
    expect(canonicalOf('vendeur')).toBe('retail assistant');
  });
});

describe('FTS query', () => {
  it('matches multi-word phrases greedily and keeps synonyms to titles', () => {
    const units = buildUnits('kitchen hand');
    expect(units).toHaveLength(1);
    const q = ftsQuery(units);
    expect(q).toContain('"kitchen hand" OR {title category}');
    expect(q).toContain('"dishwasher"');
    expect(q).not.toContain('"kp"'); // tiny abbreviations are triggers, not expansions
  });
  it('ANDs separate concepts', () => {
    expect(ftsQuery(buildUnits('barista weekend'))).toMatch(/\) AND "weekend"$/);
  });
});
