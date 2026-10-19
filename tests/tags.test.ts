import { describe, expect, it } from 'vitest';
import { detectTags, detectWorkTypes } from '@/lib/tags';

const has = (text: string, tag: string) => detectTags(text).includes(tag as never);

describe('detectTags', () => {
  it('working holiday', () => {
    expect(has('Working holiday visa holders welcome!', 'whv-friendly')).toBe(true);
    expect(has('Backpackers welcome, start Monday', 'whv-friendly')).toBe(true);
    expect(has('All visas welcome', 'whv-friendly')).toBe(true);
    expect(has('Not suitable for working holiday visa holders', 'whv-friendly')).toBe(false);
    expect(has('Sorry, no working holiday visas', 'whv-friendly')).toBe(false);
  });
  it('no experience', () => {
    expect(has('No experience necessary, full training provided', 'no-experience')).toBe(true);
    expect(has('Entry level role', 'no-experience')).toBe(true);
    expect(has('5 years experience required', 'no-experience')).toBe(false);
  });
  it('accommodation', () => {
    expect(has('Staff accommodation available on site', 'accommodation')).toBe(true);
    expect(has('Live-in position at the lodge', 'accommodation')).toBe(true);
    expect(has('Accommodation is not provided', 'accommodation')).toBe(false);
  });
  it('visa sponsorship with negation', () => {
    expect(has('We are an accredited employer and can support your visa', 'visa-sponsorship')).toBe(true);
    expect(has('Visa sponsorship is available for the right candidate', 'visa-sponsorship')).toBe(true);
    expect(has('We are unable to offer visa sponsorship', 'visa-sponsorship')).toBe(false);
    expect(has('You must have the right to work in NZ. No sponsorship.', 'visa-sponsorship')).toBe(false);
  });
  it('remote', () => {
    expect(has('This is a fully remote role', 'remote')).toBe(true);
    expect(has('Work from home two days a week', 'remote')).toBe(true);
    expect(has('Based at a remote site in Fiordland', 'remote')).toBe(false);
    expect(detectTags('Office role', { isRemote: true })).toContain('remote');
  });
  it('shifts, start, seasonal, licence, transport, students', () => {
    expect(has('Weekend work available', 'weekend')).toBe(true);
    expect(has('Night shift 10pm-6am', 'night')).toBe(true);
    expect(has('Immediate start for the right person', 'immediate-start')).toBe(true);
    expect(has('Kiwifruit harvest season', 'seasonal')).toBe(true);
    expect(has('Must hold a full driver licence', 'driver-licence')).toBe(true);
    expect(has('Class 2 licence essential', 'driver-licence')).toBe(true);
    expect(has('Free shuttle to and from the orchard', 'transport-provided')).toBe(true);
    expect(has('Suits uni students', 'student-friendly')).toBe(true);
  });
});

describe('detectWorkTypes', () => {
  it('reads source labels', () => {
    expect(detectWorkTypes(['Full time'])).toEqual(['full-time']);
    expect(detectWorkTypes(['Casual/Vacation'])).toEqual(['casual']);
    expect(detectWorkTypes(['Contract/Temp'])).toEqual(['contract', 'temp']);
    expect(detectWorkTypes(['FT', 'Contract'])).toEqual(['full-time', 'contract']);
    expect(detectWorkTypes(['Ongoing', 'Full Time'])).toEqual(['full-time']);
    expect(detectWorkTypes(['INTERN'])).toEqual(['internship']);
  });
  it('falls back to explicit words in prose', () => {
    expect(detectWorkTypes([], 'This is a part-time role, 20 hours a week')).toEqual(['part-time']);
    expect(detectWorkTypes([], 'We will contract you')).toEqual([]);
  });
});
