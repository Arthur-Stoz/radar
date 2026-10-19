import { describe, expect, it } from 'vitest';
import { userAgent } from '@/lib/config';

describe('config', () => {
  it('builds the bot user agent', () => {
    expect(userAgent()).toMatch(/^RadarNZ\/1\.0 \(\+.+\/about/);
  });
});
