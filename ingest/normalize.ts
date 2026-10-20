import { parseLocation, type Location } from '../lib/geo';
import { parsePay, type Pay } from '../lib/pay';
import { extractSummary } from '../lib/summary';
import { detectTags, detectWorkTypes, type Tag, type WorkType } from '../lib/tags';
import { clip, decodeEntities, hash, htmlToText } from '../lib/text';
import type { RawJob } from './types';

/** BUILD.md §4.1 job record. */
export interface Job {
  id: string;
  source: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  company: string | null;
  companyLogo: string | null;
  /** Best picture for cards: the ad's own photo, else the company logo, else none (BUILD: never invented). */
  imageUrl: string | null;
  imageKind: 'photo' | 'logo' | null;
  location: Location;
  workType: WorkType[];
  category: string | null;
  pay: Pay;
  postedAt: string | null;
  expiresAt: string | null;
  firstSeen: string;
  lastSeen: string;
  description: string;
  summary: string;
  highlights: string[];
  tags: Tag[];
  alsoOn: { source: string; url: string }[];
  /** Ids of duplicates merged into this job. */
  aliases: string[];
  contentHash: string;
  hasDetail: boolean;
  missed: number;
  /** Listing fields kept only for sources whose list page lacks data (see KEEP_RAW). */
  raw: RawJob | null;
}

// Sources that rebuild deferred listings from the previous run need the raw listing.
const KEEP_RAW = new Set(['backpackerboard', 'picknz', 'jobsconz', 'seasonaljobs']);

export const jobId = (source: string, sourceId: string) => hash(`${source}:${sourceId}`);

/** An absolute http(s) picture URL, or null. */
export function cleanImageUrl(u: string | null | undefined, base?: string): string | null {
  if (!u || typeof u !== 'string') return null;
  try {
    const url = new URL(decodeEntities(u.trim()), base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.href.length > 600) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function pickImage(r: Pick<RawJob, 'image' | 'companyLogo' | 'url'>): { imageUrl: string | null; imageKind: 'photo' | 'logo' | null } {
  const photo = cleanImageUrl(r.image, r.url);
  if (photo) return { imageUrl: photo, imageKind: 'photo' };
  const logo = cleanImageUrl(r.companyLogo, r.url);
  if (logo) return { imageUrl: logo, imageKind: 'logo' };
  return { imageUrl: null, imageKind: null };
}

function cleanTitle(t: string): string {
  return decodeEntities(t)
    .replace(/\s+/g, ' ')
    .replace(/^[-–•*\s]+|[-–•*\s]+$/g, '')
    .trim();
}

function isoOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function normalize(source: string, r: RawJob, now: Date): Job | null {
  const title = cleanTitle(r.title || '');
  if (!title || !r.url) return null;

  const descText = r.descriptionHtml ? htmlToText(r.descriptionHtml) : htmlToText(r.description || '');
  const description = clip(descText, 8000);
  const teaser = r.teaser ? htmlToText(r.teaser).replace(/\s+/g, ' ').trim() : '';

  const location = parseLocation(r.location, { region: r.region, city: r.city });
  if (r.remote) location.isRemote = true;

  const workType = detectWorkTypes(r.workTypes || [], `${title}\n${description}`);
  const pay = parsePay(r.payText, { period: r.payPeriod ?? null, min: r.payMin ?? null, max: r.payMax ?? null });
  if (!pay.text && pay.min != null) pay.text = null;

  const summary = teaser.length >= 40 ? clip(teaser, 280) : description ? extractSummary(description, title) : teaser;
  const highlights = (r.bullets || [])
    .map((b) => htmlToText(b).replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 3)
    .slice(0, 3)
    .map((b) => clip(b, 120));

  const tagText = [title, teaser, (r.bullets || []).join('. '), description, r.payText, r.location].filter(Boolean).join('\n');
  const tags = detectTags(tagText, { isRemote: location.isRemote, workTypes: workType });
  if (tags.includes('seasonal') && !workType.includes('seasonal') && /\bseasonal\b/i.test(`${title} ${(r.workTypes || []).join(' ')}`)) workType.push('seasonal');

  const id = jobId(source, r.sourceId);
  const nowIso = now.toISOString();
  return {
    id,
    source,
    sourceId: r.sourceId,
    sourceUrl: r.url,
    title,
    company: r.company ? decodeEntities(r.company).replace(/\s+/g, ' ').trim() : null,
    companyLogo: r.companyLogo || null,
    ...pickImage(r),
    location,
    workType,
    category: r.category || null,
    pay,
    postedAt: isoOrNull(r.postedAt),
    expiresAt: isoOrNull(r.expiresAt),
    firstSeen: nowIso,
    lastSeen: nowIso,
    description,
    summary,
    highlights,
    tags,
    alsoOn: [],
    aliases: [],
    contentHash: hash([title, r.company, r.location, summary, description.slice(0, 1500)].join('|')),
    hasDetail: !!r.hasDetail,
    missed: 0,
    raw: KEEP_RAW.has(source) ? { ...r, descriptionHtml: null, description: null } : null,
  };
}

/** Text used for the embedding (BUILD.md §4.3). */
export function embeddingText(j: Pick<Job, 'title' | 'company' | 'location' | 'summary' | 'description'>): string {
  return [j.title, j.company, j.location.city || j.location.region, j.summary, j.description.slice(0, 1500)].filter(Boolean).join('. ');
}
