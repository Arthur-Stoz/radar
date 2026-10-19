import { PLACES, REGIONS, type Place, type Region } from './gazetteer';
import { fold } from './text';

export interface Location {
  raw: string;
  suburb: string | null;
  city: string | null;
  region: string | null; // display name
  regionId: string | null;
  isRemote: boolean;
  isHybrid: boolean;
}

const norm = (s: string) => fold(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();

const placeIndex = new Map<string, Place[]>();
for (const p of PLACES) {
  const k = norm(p.name);
  const arr = placeIndex.get(k) || [];
  arr.push(p);
  placeIndex.set(k, arr);
}

const regionIndex = new Map<string, Region>();
for (const r of REGIONS) {
  regionIndex.set(norm(r.name), r);
  for (const a of r.aliases) regionIndex.set(norm(a), r);
}
export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

// Longest names first so "palmerston north" beats "palmerston".
const placeNames = [...placeIndex.keys()].sort((a, b) => b.length - a.length);
const regionNames = [...regionIndex.keys()].sort((a, b) => b.length - a.length);

const KIND_RANK: Record<Place['kind'], number> = { town: 0, district: 1, suburb: 2 };

function pick(cands: Place[], regionHint: string | null): Place {
  if (regionHint) {
    const inRegion = cands.filter((c) => c.regionId === regionHint);
    if (inRegion.length) return [...inRegion].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])[0];
  }
  return [...cands].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])[0];
}

function containsWord(hay: string, needle: string): boolean {
  if (needle.length < 3) return false;
  const i = hay.indexOf(needle);
  if (i < 0) return false;
  const before = i === 0 || hay[i - 1] === ' ';
  const after = i + needle.length === hay.length || hay[i + needle.length] === ' ';
  return before && after;
}

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere in (nz|new zealand)|home based|home-based|telecommute|virtual)\b/i;
const HYBRID_RE = /\bhybrid\b/i;

/** Parse a free-text location ("Ponsonby, Auckland", "Christchurch City", "Remote - NZ"). */
export function parseLocation(raw: string | null | undefined, extra?: { region?: string | null; city?: string | null }): Location {
  const text = [raw, extra?.city, extra?.region].filter(Boolean).join(', ');
  const out: Location = {
    raw: (raw || '').trim(),
    suburb: null,
    city: null,
    region: null,
    regionId: null,
    isRemote: REMOTE_RE.test(text),
    isHybrid: HYBRID_RE.test(text),
  };
  if (!text.trim()) return out;

  const segments = text
    .split(/,|\/|\||\s[-–]\s|\(|\)|;/)
    .map(norm)
    .map((s) => s.replace(/^(all|rest of|greater|central|wider|near)\s+/, '').replace(/\s+(region|area|district council|city council|nz|new zealand)$/, '').trim())
    .filter(Boolean);
  const whole = norm(text);

  // Region hint: an explicit region in any segment except the first (the first is usually the most specific place).
  let regionHint: string | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const r = regionIndex.get(segments[i]);
    if (r && (i > 0 || segments.length === 1)) {
      regionHint = r.id;
      break;
    }
  }
  if (!regionHint) {
    for (const n of regionNames) {
      if (containsWord(whole, n) && !placeIndex.has(n)) {
        regionHint = regionIndex.get(n)!.id;
        break;
      }
    }
  }

  let place: Place | null = null;
  for (const seg of segments) {
    const cands = placeIndex.get(seg);
    // A bare region name ("Waikato", "Southland") is a region, unless a town has exactly that name (Wellington, Nelson…).
    if (regionIndex.has(seg) && !cands?.some((c) => c.kind === 'town')) continue;
    if (cands) {
      // A bare region name that is also a city name (Wellington, Auckland, Nelson…) → the city.
      place = pick(cands, regionHint);
      break;
    }
  }
  if (!place) {
    for (const n of placeNames) {
      if (regionIndex.has(n) && !placeIndex.get(n)!.some((c) => c.kind === 'town')) continue;
      if (containsWord(whole, n)) {
        place = pick(placeIndex.get(n)!, regionHint);
        break;
      }
    }
  }

  if (place) {
    out.city = place.city;
    out.suburb = place.kind === 'suburb' ? place.suburb || place.name : null;
    if (out.suburb && out.suburb === out.city) out.suburb = null;
    out.regionId = place.regionId;
  } else if (regionHint) {
    out.regionId = regionHint;
  }
  if (out.regionId) out.region = REGION_BY_ID.get(out.regionId)!.name;
  return out;
}

/** Find a place or region mentioned in a search query. Returns the matched text span. */
export function findPlaceInQuery(q: string): { match: string; city: string | null; regionId: string | null } | null {
  const n = norm(q);
  for (const name of [...placeNames, ...regionNames].sort((a, b) => b.length - a.length)) {
    if (name.length < 4 && !['akl', 'bop', 'hb'].includes(name)) continue;
    if (containsWord(n, name)) {
      const r = regionIndex.get(name);
      const cands = placeIndex.get(name);
      if (cands && (!r || cands.some((c) => c.kind === 'town'))) {
        const p = pick(cands, null);
        return { match: name, city: p.kind === 'suburb' ? p.city : p.city, regionId: p.regionId };
      }
      if (r) return { match: name, city: null, regionId: r.id };
    }
  }
  return null;
}

export function regionName(id: string | null | undefined): string | null {
  return id ? REGION_BY_ID.get(id)?.name ?? null : null;
}

export const ALL_REGIONS = REGIONS;

/** Display string "Suburb, City" / "City, Region" / raw. */
export function displayLocation(loc: Pick<Location, 'suburb' | 'city' | 'region' | 'raw' | 'isRemote'>): string {
  if (loc.suburb && loc.city) return `${loc.suburb}, ${loc.city}`;
  if (loc.city) return loc.city;
  if (loc.region) return loc.region;
  if (loc.isRemote) return 'Remote';
  return loc.raw || 'New Zealand';
}

export function citySlug(city: string): string {
  return norm(city).replace(/ /g, '-');
}
