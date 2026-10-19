import { fold } from './text';

// Rule-based CV profile extraction (BUILD.md §6.2). Runs in the browser; no AI, no upload.
// Produces short editable chips: job titles, skills, languages, licences/certificates, visa hints.

export type ChipKind = 'title' | 'skill' | 'language' | 'licence' | 'visa';

export interface ProfileChip {
  kind: ChipKind;
  label: string;
  /** Lowercase terms used to look for this chip in job text. */
  terms: string[];
}

const SKILLS: [string, string[]][] = [
  ['Customer service', ['customer service', 'customer-facing', 'customer facing', 'front of house']],
  ['Barista', ['barista', 'espresso', 'latte art', 'coffee machine']],
  ['Food & beverage', ['food and beverage', 'f&b', 'food & beverage', 'waiting tables', 'table service']],
  ['Bartending', ['bartend', 'cocktail', 'bar service']],
  ['Cooking', ['cooking', 'line cook', 'prep cook', 'commis', 'chef de partie', 'kitchen']],
  ['Food safety', ['food safety', 'food handling', 'haccp', 'food control plan']],
  ['Housekeeping', ['housekeeping', 'room attendant', 'cleaning']],
  ['Cash handling', ['cash handling', 'pos', 'point of sale', 'till', 'eftpos']],
  ['Retail', ['retail', 'merchandising', 'visual merchandising', 'stock replenishment']],
  ['Sales', ['sales', 'upselling', 'business development', 'account management']],
  ['Fruit picking', ['fruit picking', 'picking', 'harvest', 'orchard', 'thinning', 'pruning']],
  ['Packhouse', ['packhouse', 'packing', 'grading']],
  ['Vineyard work', ['vineyard', 'viticulture', 'vintage', 'cellar hand']],
  ['Farm work', ['farm', 'dairy', 'milking', 'calf rearing', 'livestock', 'tractor']],
  ['Construction', ['construction', 'building site', 'labouring', 'labourer', 'carpentry', 'framing']],
  ['Landscaping', ['landscaping', 'gardening', 'horticulture', 'lawn mowing']],
  ['Warehouse', ['warehouse', 'pick and pack', 'picking and packing', 'inventory', 'stock control', 'dispatch']],
  ['Driving', ['delivery driver', 'courier', 'truck driving', 'driving']],
  ['Childcare', ['childcare', 'child care', 'au pair', 'nanny', 'babysitting', 'early childhood']],
  ['Aged care', ['aged care', 'caregiving', 'caregiver', 'support worker', 'disability support', 'personal care']],
  ['Nursing', ['nursing', 'registered nurse', 'patient care']],
  ['Teaching', ['teaching', 'tutoring', 'classroom', 'lesson planning']],
  ['Administration', ['administration', 'data entry', 'filing', 'scheduling', 'reception', 'office management']],
  ['Microsoft Office', ['microsoft office', 'excel', 'word', 'powerpoint', 'outlook']],
  ['Accounting', ['accounting', 'bookkeeping', 'xero', 'myob', 'accounts payable', 'accounts receivable', 'payroll']],
  ['Marketing', ['marketing', 'social media', 'content creation', 'seo', 'google ads']],
  ['Design', ['graphic design', 'adobe', 'photoshop', 'illustrator', 'figma', 'indesign']],
  ['Software development', ['software development', 'programming', 'javascript', 'typescript', 'python', 'java', 'react', 'node.js', 'c#', '.net', 'sql']],
  ['Data analysis', ['data analysis', 'power bi', 'tableau', 'analytics', 'sql']],
  ['IT support', ['it support', 'helpdesk', 'help desk', 'troubleshooting', 'active directory']],
  ['Project management', ['project management', 'agile', 'scrum', 'prince2', 'pmp']],
  ['Team leadership', ['team leader', 'supervis', 'managing a team', 'leadership', 'shift manager', 'duty manager']],
  ['Event work', ['events', 'festival', 'event setup', 'catering']],
  ['Tourism', ['tourism', 'tour guide', 'guiding', 'visitor experience']],
  ['Hospitality', ['hospitality', 'hotel', 'restaurant', 'cafe', 'café', 'hostel']],
  ['Security', ['security guard', 'security officer', 'crowd control']],
  ['Electrical', ['electrical', 'electrician', 'wiring']],
  ['Plumbing', ['plumbing', 'plumber', 'gasfitting']],
  ['Mechanics', ['mechanic', 'automotive', 'vehicle servicing', 'diesel']],
  ['Welding', ['welding', 'fabrication', 'mig', 'tig']],
  ['Painting', ['painting', 'decorating']],
  ['Machine operation', ['machine operator', 'machinery', 'excavator', 'digger', 'loader']],
  ['Call centre', ['call centre', 'call center', 'contact centre', 'inbound calls', 'outbound calls']],
  ['Hairdressing & beauty', ['hairdress', 'barber', 'beauty therapy', 'nail']],
  ['Fitness', ['personal trainer', 'fitness instruct', 'gym']],
];

const LANGUAGES = ['English', 'French', 'German', 'Spanish', 'Italian', 'Portuguese', 'Dutch', 'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Hindi', 'Punjabi', 'Tagalog', 'Māori', 'Samoan', 'Tongan', 'Arabic', 'Russian', 'Swedish', 'Danish', 'Norwegian', 'Czech', 'Polish', 'Thai', 'Vietnamese', 'Indonesian'];
const NATIVE: Record<string, string> = { francais: 'French', deutsch: 'German', espanol: 'Spanish', italiano: 'Italian', portugues: 'Portuguese', nederlands: 'Dutch' };

const LICENCES: [string, RegExp, string[]][] = [
  ['Full driver licence', /\b(full|class 1|full nz|full international|valid)\b[^.\n]{0,25}\b(driver'?s?|driving)\s+licen[cs]e\b|\bdriver'?s?\s+licen[cs]e\b|\bpermis de conduire\b|\bfuhrerschein\b/i, ['driver licence', "driver's licence", 'drivers licence', 'full licence', 'driving licence']],
  ['Class 2 licence', /\bclass\s*2\b/i, ['class 2']],
  ['Class 4/5 licence', /\bclass\s*[45]\b/i, ['class 4', 'class 5']],
  ['Forklift (F endorsement)', /\bforklift\b|\bf endorsement\b/i, ['forklift', 'f endorsement']],
  ['WTR endorsement', /\bwtr\b|wheels,? tracks,? (and |& )?rollers/i, ['wtr', 'wheels tracks']],
  ['First aid', /\bfirst aid\b|\bcpr\b/i, ['first aid']],
  ['Site Safe', /\bsite safe\b/i, ['site safe']],
  ['LCQ / bar licence', /\blcq\b|licen[cs]e controller|\brsa\b|responsible service of alcohol|manager'?s certificate/i, ['lcq', 'licence controller', 'manager certificate', "manager's certificate"]],
  ['Barista certificate', /barista (certificate|course|training)/i, ['barista']],
  ['Food safety certificate', /food (safety|hygiene|handling) (certificate|course|level)/i, ['food safety']],
  ['Chainsaw ticket', /\bchainsaw\b/i, ['chainsaw']],
  ['Traffic control (STMS/TC)', /\bstms\b|traffic control/i, ['stms', 'traffic control']],
  ['Working at heights', /working at heights/i, ['working at heights', 'heights']],
  ['Registered nurse (APC)', /\b(registered nurse|nursing council|apc)\b/i, ['registered nurse', 'nursing']],
];

const VISAS: [string, RegExp, string[]][] = [
  ['Working holiday visa', /working holiday|\bwhv\b|vacances[- ]travail|\bpvt\b|work and travel/i, ['working holiday', 'backpacker', 'whv']],
  ['Open work visa', /open work visa/i, ['open work visa', 'all visas']],
  ['NZ resident', /\b(nz|new zealand) (permanent )?resident\b|residence visa|resident visa/i, ['resident']],
  ['NZ citizen', /\b(nz|new zealand) citizen\b/i, ['citizen']],
  ['Student visa', /student visa/i, ['student']],
];

// Common job titles (the server vocabulary adds the real top titles at runtime).
const TITLES = [
  'barista', 'chef', 'cook', 'kitchen hand', 'waiter', 'waitress', 'bartender', 'server', 'host', 'housekeeper', 'room attendant', 'receptionist',
  'front desk', 'night auditor', 'duty manager', 'restaurant manager', 'cafe manager', 'bar manager', 'food and beverage attendant', 'sous chef', 'commis chef',
  'chef de partie', 'pastry chef', 'baker', 'dishwasher', 'fruit picker', 'packer', 'packhouse worker', 'orchard worker', 'vineyard worker', 'farm hand',
  'dairy farm assistant', 'labourer', 'builder', 'carpenter', 'electrician', 'plumber', 'painter', 'landscaper', 'gardener', 'cleaner', 'retail assistant',
  'sales assistant', 'store manager', 'cashier', 'customer service representative', 'call centre agent', 'administrator', 'office administrator',
  'personal assistant', 'executive assistant', 'accountant', 'bookkeeper', 'payroll officer', 'marketing coordinator', 'graphic designer',
  'software engineer', 'software developer', 'web developer', 'data analyst', 'business analyst', 'project manager', 'product manager',
  'it support', 'teacher', 'teacher aide', 'early childhood teacher', 'nanny', 'au pair', 'caregiver', 'support worker', 'registered nurse', 'nurse',
  'healthcare assistant', 'pharmacist', 'truck driver', 'delivery driver', 'courier', 'forklift operator', 'warehouse worker', 'storeperson',
  'machine operator', 'mechanic', 'welder', 'security guard', 'tour guide', 'event staff', 'lifeguard', 'ski instructor', 'deckhand',
];

const has = (hay: string, needle: string) => {
  const i = hay.indexOf(needle);
  if (i < 0) return false;
  const before = i === 0 || !/[a-z0-9]/.test(hay[i - 1]);
  const after = i + needle.length >= hay.length || !/[a-z0-9]/.test(hay[i + needle.length]);
  return before && after;
};

/** Extract chips from CV text. `vocabTitles` are real job titles from the server (lowercase). */
export function extractProfile(text: string, vocabTitles: string[] = []): ProfileChip[] {
  const raw = text.slice(0, 40000);
  const t = fold(raw);
  const chips: ProfileChip[] = [];
  const seen = new Set<string>();
  const push = (c: ProfileChip) => {
    // One chip per label whatever its kind ("Barista" as a title and as a skill is one chip).
    const k = c.label.toLowerCase().replace(/ (certificate|licence)$/, '');
    if (seen.has(k)) return;
    seen.add(k);
    chips.push(c);
  };

  // Titles: count occurrences, prefer the most mentioned (experience sections repeat them).
  const titleCounts = new Map<string, number>();
  for (const title of new Set([...TITLES, ...vocabTitles.filter((v) => v.length >= 4 && v.split(' ').length <= 4)])) {
    const f = fold(title);
    if (has(t, f)) titleCounts.set(f, (titleCounts.get(f) || 0) + t.split(f).length - 1);
  }
  const titles = [...titleCounts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([k]) => k)
    .filter((k, i, arr) => !arr.slice(0, i).some((o) => o.includes(k)))
    .slice(0, 4);
  for (const k of titles) push({ kind: 'title', label: k.replace(/\b\w/g, (c) => c.toUpperCase()), terms: [k] });

  for (const [label, terms] of SKILLS) if (terms.some((x) => has(t, fold(x)))) push({ kind: 'skill', label, terms: terms.map(fold) });

  for (const l of LANGUAGES) if (has(t, fold(l))) push({ kind: 'language', label: l, terms: [fold(l)] });
  for (const [w, l] of Object.entries(NATIVE)) if (has(t, w)) push({ kind: 'language', label: l, terms: [fold(l)] });

  for (const [label, re, terms] of LICENCES) if (re.test(raw)) push({ kind: 'licence', label, terms });
  for (const [label, re, terms] of VISAS) if (re.test(raw)) push({ kind: 'visa', label, terms });

  // Keep it short and useful: titles, then the top skills, then the rest.
  const order: ChipKind[] = ['title', 'skill', 'licence', 'language', 'visa'];
  const byKind = order.flatMap((k) => chips.filter((c) => c.kind === k).slice(0, k === 'skill' ? 6 : 4));
  return byKind.slice(0, 16);
}

/** Split CV text into ~800-character chunks on paragraph boundaries for embedding. */
export function chunkText(text: string, size = 800, max = 24): string[] {
  const paras = text
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n(?=[A-Z•\-*])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + ' ' + p).length > size && cur) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${p}` : p;
    while (cur.length > size * 1.5) {
      out.push(cur.slice(0, size));
      cur = cur.slice(size);
    }
  }
  if (cur) out.push(cur);
  return out.slice(0, max);
}

/** Mean of vectors, L2-normalized. */
export function meanNormalized(vs: number[][]): number[] {
  if (!vs.length) return [];
  const d = vs[0].length;
  const m = new Array(d).fill(0);
  for (const v of vs) for (let i = 0; i < d; i++) m[i] += v[i];
  const n = Math.sqrt(m.reduce((s, x) => s + x * x, 0)) || 1;
  return m.map((x) => x / n);
}
