import { describe, expect, it } from 'vitest';
import { dedup, similarity, trigrams } from '@/ingest/dedup';
import { normalize } from '@/ingest/normalize';

const now = new Date('2026-10-19T00:00:00Z');
const mk = (source: string, id: string, title: string, company: string, location: string, extra = {}) =>
  normalize(source, { sourceId: id, url: `https://example.com/${source}/${id}`, title, company, location, postedAt: '2026-10-15', ...extra }, now)!;

describe('dedup', () => {
  it('merges the same job across sources and keeps the richest', () => {
    const a = mk('seek', '1', 'Barista', 'Kōwhai Coffee Co', 'Ponsonby, Auckland');
    const b = mk('trademe', '2', 'Barista', 'Kowhai Coffee Co Ltd', 'Auckland', { payText: '$27 - $29 per hour', description: 'Pull great espresso. Full time.', hasDetail: true });
    const out = dedup([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('trademe');
    expect(out[0].alsoOn).toEqual([{ source: 'seek', url: 'https://example.com/seek/1' }]);
  });

  it('merges near-identical titles (trigram ≥ 0.85) in the same city', () => {
    const a = mk('seek', '1', 'Kitchen Hand - Full Time', 'Fiordland Lodge', 'Te Anau');
    const b = mk('trademe', '2', 'Kitchen Hand Full Time', 'Fiordland Lodge', 'Te Anau');
    expect(dedup([a, b])).toHaveLength(1);
  });

  it('keeps different jobs, other cities and same-source repeats apart', () => {
    const a = mk('seek', '1', 'Barista', 'Fig & Fern', 'Auckland');
    const b = mk('trademe', '2', 'Barista', 'Fig & Fern', 'Wellington');
    const c = mk('trademe', '3', 'Head Chef', 'Fig & Fern', 'Auckland');
    const d = mk('seek', '4', 'Barista', 'Fig & Fern', 'Auckland');
    expect(dedup([a, b, c, d])).toHaveLength(4);
  });

  it('trigram similarity', () => {
    expect(similarity(trigrams('barista | kowhai'), trigrams('barista | kowhai'))).toBe(1);
    expect(similarity(trigrams('barista'), trigrams('mechanic'))).toBeLessThan(0.2);
  });
});
