import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageUrlOf, ogImage } from '../ingest/jsonld';
import { cleanImageUrl, pickImage } from '../ingest/normalize';
import { picknzLogo } from '../ingest/sources/picknz';
import { seekBrandId } from '../ingest/sources/seek';
import { trademeToRaw } from '../ingest/sources/trademe';
import { cityValue, resolveLoc } from '../lib/search';

describe('job pictures', () => {
  it('prefers the ad photo, then the logo, else nothing', () => {
    expect(pickImage({ image: 'https://cdn/p.jpg', companyLogo: 'https://cdn/l.png', url: 'https://x/1' })).toEqual({ imageUrl: 'https://cdn/p.jpg', imageKind: 'photo' });
    expect(pickImage({ image: null, companyLogo: '//cdn/l.png', url: 'https://x/1' })).toEqual({ imageUrl: 'https://cdn/l.png', imageKind: 'logo' });
    expect(pickImage({ image: 'javascript:alert(1)', companyLogo: null, url: 'https://x/1' })).toEqual({ imageUrl: null, imageKind: null });
    expect(cleanImageUrl('http://a.b/c.png')).toBe('https://a.b/c.png');
  });

  it('Trade Me: the listing photo at full size, and the brand logo', () => {
    const list = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'trademe-search.json'), 'utf8')).List;
    const r = trademeToRaw(list[0]);
    expect(r.image).toBe('https://trademe.tmcdn.co.nz/photoserver/full/2278033931.jpg');
    expect(r.companyLogo).toMatch(/^https:\/\/trademe\.tmcdn\.co\.nz\/tm\/agentimages\/jobs\//);
  });

  it('Seek: the brand id comes from the logo URL', () => {
    expect(seekBrandId('https://bx-branding-gateway.cloud.seek.com.au/6d9d34ac-5833-4eab-8725-f7522341db6b.1/jdpLogo')).toBe('6d9d34ac-5833-4eab-8725-f7522341db6b.1');
    expect(seekBrandId('https://example.com/x/jdpLogo')).toBeNull();
  });

  it('reads og:image, schema.org images and the PickNZ employer logo', () => {
    expect(ogImage('<meta property="og:image" content="https://a.b/c.png?x=1&amp;y=2" />')).toBe('https://a.b/c.png?x=1&y=2');
    expect(ogImage('<meta content="https://x/y.jpg" name="twitter:image">')).toBe('https://x/y.jpg');
    expect(imageUrlOf([{ '@type': 'ImageObject', url: 'https://x/a.png' }])).toBe('https://x/a.png');
    const html = '<img src="https://jobs.picknz.co.nz/wp-content/uploads/2021/08/PickNZ-logo.png"><img class="x" src="https://jobs.picknz.co.nz/wp-content/uploads/wpjobboard/job/3407/company-logo/Farmhands-Logo.png">';
    expect(picknzLogo(html)).toBe('https://jobs.picknz.co.nz/wp-content/uploads/wpjobboard/job/3407/company-logo/Farmhands-Logo.png');
  });
});

describe('location filter values', () => {
  it('a town that shares its name with a region gets its own value', () => {
    expect(cityValue('Auckland')).toBe('auckland-city');
    expect(cityValue('Christchurch')).toBe('christchurch');
    expect(resolveLoc('auckland')).toEqual({ kind: 'region', id: 'auckland' });
    expect(resolveLoc('auckland-city')).toMatchObject({ kind: 'city', city: 'Auckland', regionId: 'auckland' });
    expect(resolveLoc('christchurch')).toMatchObject({ kind: 'city', city: 'Christchurch' });
  });
});
