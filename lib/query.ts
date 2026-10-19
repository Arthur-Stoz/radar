import { findPlaceInQuery, regionName } from './geo';
import type { Tag, WorkType } from './tags';
import { fold } from './text';

// Query understanding (BUILD.md §5.1): free text → removable chips + remaining keywords.

export type Chip =
  | { kind: 'loc'; value: string; label: string; match: string } // value: "city:Auckland" | "region:otago"
  | { kind: 'pay'; value: number; label: string; match: string } // min hourly
  | { kind: 'type'; value: WorkType; label: string; match: string }
  | { kind: 'tag'; value: Tag; label: string; match: string };

export interface ParsedQuery {
  keywords: string;
  chips: Chip[];
}

const TYPE_PATTERNS: [RegExp, WorkType, string][] = [
  [/\b(part[- ]?time|temps partiel|teilzeit)\b/, 'part-time', 'Part time'],
  [/\b(full[- ]?time|temps plein|vollzeit)\b/, 'full-time', 'Full time'],
  [/\bcasual\b/, 'casual', 'Casual'],
  [/\b(contract|contractor)\b/, 'contract', 'Contract'],
  [/\b(temp|temporary)\b/, 'temp', 'Temporary'],
  [/\b(seasonal|saisonnier)\b/, 'seasonal', 'Seasonal'],
  [/\b(internship|intern|praktikum)\b/, 'internship', 'Internship'],
];

const TAG_PATTERNS: [RegExp, Tag, string][] = [
  [/\b(no experience( (required|needed|necessary))?|entry[- ]level|sans experience|ohne erfahrung|sin experiencia|beginners?)\b/, 'no-experience', 'No experience'],
  [/\b(working holiday( visa)?|whv|backpackers?|pvt|work and travel)\b/, 'whv-friendly', 'Working holiday friendly'],
  [/\b(remote|work from home|wfh|teletravail|homeoffice)\b/, 'remote', 'Remote'],
  [/\b(with accommodation|accommodation( provided| included)?|live[- ]in|staff accommodation|logement|unterkunft)\b/, 'accommodation', 'Accommodation'],
  [/\b(visa sponsorship|sponsorship|sponsor visa|aewv)\b/, 'visa-sponsorship', 'Visa sponsorship'],
  [/\b(students?|student job|uni students?)\b/, 'student-friendly', 'Student friendly'],
  [/\b(night shifts?|nights?)\b/, 'night', 'Night shifts'],
  [/\b(weekends?)\b/, 'weekend', 'Weekends'],
  [/\b(immediate start|start (now|asap|immediately)|starts this week)\b/, 'immediate-start', 'Immediate start'],
];

// "$30", "30/h", "$30+/h", "30 an hour", "60k+", "$60,000"
const PAY_RE = /(?:\$\s?(\d{2,3}(?:,\d{3})?|\d{2}(?:\.\d{1,2})?)\s*(k)?\s*\+?\s*(?:\/\s?h(?:r|our)?|ph|p\/h|an hour|per hour|\/hr)?|\b(\d{2})\s*(?:\/\s?h(?:r|our)?|ph|p\/h|an hour|per hour|\/hr)\b\+?|\b(\d{2,3})\s?k\b\+?)/i;

export function parseQuery(input: string): ParsedQuery {
  let text = ` ${fold(input || '')} `;
  const chips: Chip[] = [];
  const take = (match: string) => {
    text = text.replace(match, ' ');
  };

  const pay = PAY_RE.exec(text);
  if (pay) {
    let v = Number((pay[1] || pay[3] || pay[4] || '').replace(/,/g, ''));
    if (pay[2] || pay[4]) v = (v < 1000 ? v * 1000 : v) / 2080;
    else if (v > 1000) v = v / 2080;
    if (v >= 15 && v <= 300) {
      const hourly = Math.round(v);
      chips.push({ kind: 'pay', value: hourly, label: `$${hourly}+/h`, match: pay[0].trim() });
      take(pay[0]);
    }
  }

  for (const [re, value, label] of TYPE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      chips.push({ kind: 'type', value, label, match: m[0] });
      take(m[0]);
    }
  }
  for (const [re, value, label] of TAG_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      chips.push({ kind: 'tag', value, label, match: m[0] });
      take(m[0]);
    }
  }

  // Location, optionally introduced by in/near/around/à/en.
  const place = findPlaceInQuery(text);
  if (place) {
    const value = place.city ? `city:${place.city}` : `region:${place.regionId}`;
    const label = place.city ?? regionName(place.regionId) ?? place.match;
    chips.push({ kind: 'loc', value, label, match: place.match });
    const re = new RegExp(`\\b(?:(?:in|near|around|at|a|en|bei|cerca de)\\s+)?${place.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    text = text.replace(re, ' ');
  }

  const keywords = text
    .replace(/\b(jobs?|in|near|around|at|the|a|an|and|for|with|nz|new zealand|emploi|travail|arbeit|trabajo|job offers?|hiring|vacancy|vacancies|position|positions|role|roles)\b/g, ' ')
    .replace(/[^\p{L}\p{N}&+#' -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { keywords, chips };
}
