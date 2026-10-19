import { describe, expect, it } from 'vitest';
import { findPlaceInQuery, parseLocation } from '@/lib/geo';

describe('parseLocation', () => {
  const cases: [string, string | null, string | null, string | null][] = [
    ['Ponsonby, Auckland', 'Ponsonby', 'Auckland', 'auckland'],
    ['Christchurch Central, Canterbury', null, 'Christchurch', 'canterbury'],
    ['Christchurch City, Canterbury', null, 'Christchurch', 'canterbury'],
    ['Te Aro, Wellington', 'Te Aro', 'Wellington', 'wellington'],
    ['Queenstown-Lakes, Otago', null, 'Queenstown', 'otago'],
    ['Whangarei', null, 'Whangārei', 'northland'],
    ['Whangārei', null, 'Whangārei', 'northland'],
    ['Ōtautahi', null, 'Christchurch', 'canterbury'],
    ['Tāmaki Makaurau', null, 'Auckland', 'auckland'],
    ['Waikato', null, null, 'waikato'],
    ['Southland, Southland', null, null, 'southland'],
    ['Richmond, Tasman', null, 'Richmond', 'tasman'],
    ['Richmond, Canterbury', 'Richmond', 'Christchurch', 'canterbury'],
    ['Hawkes Bay', null, null, 'hawkes-bay'],
    ["Hawke's Bay", null, null, 'hawkes-bay'],
    ['Te Puke, Bay of Plenty', null, 'Te Puke', 'bay-of-plenty'],
    ['Wānaka', null, 'Wānaka', 'otago'],
    ['Wanaka, Otago', null, 'Wānaka', 'otago'],
    ['Far North, Northland', null, 'Kerikeri', 'northland'],
    ['Auckland, NZ', null, 'Auckland', 'auckland'],
    ['NZ: Auckland: Xero 4 (96 St Georges Bay Rd)', null, 'Auckland', 'auckland'],
    ['Palmerston North', null, 'Palmerston North', 'manawatu-whanganui'],
  ];
  it.each(cases)('%s', (raw, suburb, city, region) => {
    const l = parseLocation(raw);
    expect(l.suburb).toBe(suburb);
    expect(l.city).toBe(city);
    expect(l.regionId).toBe(region);
  });

  it('detects remote and hybrid', () => {
    expect(parseLocation('Remote - New Zealand').isRemote).toBe(true);
    expect(parseLocation('Wellington · Hybrid').isHybrid).toBe(true);
    expect(parseLocation('Auckland').isRemote).toBe(false);
  });

  it('works from structured region + district', () => {
    expect(parseLocation(null, { region: 'Otago', city: 'Queenstown-Lakes' }).city).toBe('Queenstown');
  });
});

describe('findPlaceInQuery', () => {
  it('finds places in free text', () => {
    expect(findPlaceInQuery('barista auckland')?.city).toBe('Auckland');
    expect(findPlaceInQuery('serveur queenstown')?.city).toBe('Queenstown');
    expect(findPlaceInQuery('fruit picking hawkes bay')?.regionId).toBe('hawkes-bay');
    expect(findPlaceInQuery('software engineer')).toBeNull();
  });
});
