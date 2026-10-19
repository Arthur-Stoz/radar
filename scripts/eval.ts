// Relevance eval (BUILD.md §9.3): `npm run eval` against the real DB (DATA_DIR, default ./.data).
// Each case checks the top results with a predicate; prints a pass/fail table.

import { search, type CardJob, type SearchInput } from '../lib/search';

type Pred = (j: CardJob) => boolean;
interface Case {
  name: string;
  input: SearchInput;
  /** Predicate every top result should satisfy. */
  pred: Pred;
  top?: number;
  /** Share of top results that must satisfy pred. */
  min?: number;
  /** Minimum number of results expected. */
  minResults?: number;
  extra?: (r: ReturnType<typeof search>) => string | null;
}

const t = (re: RegExp): Pred => (j) => re.test(j.title.toLowerCase());
const tc = (re: RegExp): Pred => (j) => re.test(`${j.title} ${j.category || ''}`.toLowerCase());
const region = (name: string): Pred => (j) => (j.region || '').toLowerCase() === name.toLowerCase();
const city = (name: string): Pred => (j) => (j.city || '').toLowerCase() === name.toLowerCase();
const tag = (x: string): Pred => (j) => j.tags.includes(x as never);
const and = (...ps: Pred[]): Pred => (j) => ps.every((p) => p(j));
const or = (...ps: Pred[]): Pred => (j) => ps.some((p) => p(j));

const CASES: Case[] = [
  { name: 'barista auckland', input: { q: 'barista auckland' }, pred: and(region('Auckland'), tc(/barista|coffee|caf[eé]|espresso/)) },
  { name: 'fruit picking', input: { q: 'fruit picking' }, pred: tc(/pick|harvest|orchard|fruit|kiwifruit|thinn|prun|pack|vineyard|horticult|seasonal|apple|cherr|berr|grape/) },
  { name: 'kitchen hand no experience', input: { q: 'kitchen hand no experience' }, pred: and(tag('no-experience'), tc(/kitchen|dish|kp|cook|food|catering|hospitality|chef|caf[eé]/)) },
  { name: 'software engineer remote', input: { q: 'software engineer remote' }, pred: and(tag('remote'), t(/engineer|developer|software|programmer|devops|architect/)) },
  { name: 'serveur queenstown', input: { q: 'serveur queenstown' }, pred: and(city('Queenstown'), tc(/wait|server|food (and|&) beverage|f&b|front of house|foh|host|bar|restaurant|hospitality/)), min: 0.7 },
  {
    name: 'barrista auckand (typos)',
    input: { q: 'barrista auckand' },
    pred: tc(/barista|coffee|caf[eé]/),
    min: 0.7,
    extra: (r) => (r.corrected ? null : 'no "Showing results for"'),
  },
  { name: 'chef wellington', input: { q: 'chef wellington' }, pred: and(region('Wellington'), tc(/chef|cook|kitchen|culinary/)) },
  { name: 'nurse christchurch', input: { q: 'nurse christchurch' }, pred: and(region('Canterbury'), tc(/nurs|rn\b|midwi|clinical/)) },
  { name: 'truck driver', input: { q: 'truck driver' }, pred: tc(/driver|truck|class [1-5]|hpmv|operator|transport/) },
  { name: 'forklift', input: { q: 'forklift' }, pred: tc(/forklift|warehouse|store ?person|logistics|reach|operator|dispatch|stores/) },
  { name: 'housekeeper queenstown', input: { q: 'housekeeper queenstown' }, pred: and(city('Queenstown'), tc(/housekeep|room attendant|clean|laundry|accommodation|hotel/)), min: 0.7 },
  { name: 'retail assistant part time', input: { q: 'retail assistant part time' }, pred: and((j) => j.workTypes.includes('part-time'), tc(/retail|sales|shop|store|customer|assistant|team member|checkout|cashier/)) },
  { name: 'electrician', input: { q: 'electrician' }, pred: tc(/electric/) },
  { name: 'accountant auckland', input: { q: 'accountant auckland' }, pred: and(region('Auckland'), tc(/account|finance|financial|bookkeep|payable|receivable|tax|audit/)) },
  { name: 'teacher', input: { q: 'teacher' }, pred: tc(/teach|educat|kaiako|tutor|lecturer|learning|school|kindergarten|ece/) },
  { name: 'caregiver', input: { q: 'caregiver' }, pred: tc(/care|support worker|health ?care assistant|hca|disability|aged|nurs/) },
  { name: 'labourer christchurch', input: { q: 'labourer christchurch' }, pred: and(region('Canterbury'), tc(/labour|labor|hand|construction|general|worker|crew|civil|hammer/)) },
  { name: 'data analyst', input: { q: 'data analyst' }, pred: tc(/data|analyst|analytics|insight|intelligence|bi\b|reporting/) },
  { name: 'receptionist', input: { q: 'receptionist' }, pred: tc(/reception|front desk|front office|admin|guest|concierge|patient/) },
  { name: 'warehouse night shift', input: { q: 'warehouse night shift' }, pred: and(tag('night'), tc(/warehouse|store|picker|packer|logistics|forklift|dispatch|distribution|operator|night/)), min: 0.7 },
  { name: 'kellner (German)', input: { q: 'kellner' }, pred: tc(/wait|server|food (and|&) beverage|f&b|front of house|foh|host|restaurant|hospitality|bar/), min: 0.7 },
  { name: 'nanny', input: { q: 'nanny' }, pred: tc(/nanny|au pair|child|babysit|educator|family/), min: 0.7 },
  { name: 'builder', input: { q: 'builder' }, pred: tc(/build|carpent|construction|joiner|site|project|foreman|apprentice|hammer/) },
  { name: 'customer service', input: { q: 'customer service' }, pred: tc(/customer|service|contact centre|call centre|support|sales|retail|receptionist|team member|account|front/) },
  { name: 'mechanic', input: { q: 'mechanic' }, pred: tc(/mechanic|technician|automotive|diesel|fitter|service/) },
  { name: 'dairy farm', input: { q: 'dairy farm' }, pred: tc(/dairy|farm|milk|herd|calf|agricultur|stock/) },
  { name: '$30 an hour', input: { q: '$30 an hour' }, pred: (j) => (j.hourlyMax ?? 0) >= 30, min: 1 },
  { name: 'plumber hamilton', input: { q: 'plumber hamilton' }, pred: and(or(city('Hamilton'), region('Waikato')), tc(/plumb|gasfit|drainlay/)), min: 0.6, minResults: 3 },
  { name: 'policy advisor wellington', input: { q: 'policy advisor wellington' }, pred: and(region('Wellington'), tc(/polic|advis|analyst/)) },
  { name: 'cleaner', input: { q: 'cleaner' }, pred: tc(/clean|housekeep|janitor|custodian|room attendant/) },
];

function run() {
  const rows: { case: string; results: number; ok: string; share: string; pass: string; note: string }[] = [];
  let passed = 0;
  for (const c of CASES) {
    const top = c.top ?? 10;
    const min = c.min ?? 0.8;
    const r = search({ ...c.input, pageSize: top });
    if (!r.ready) throw new Error('No database. Run `npm run ingest` first (or set DATA_DIR).');
    const got = r.results.slice(0, top);
    const ok = got.filter(c.pred).length;
    const share = got.length ? ok / got.length : 0;
    const extra = c.extra?.(r) ?? null;
    const enough = r.total >= (c.minResults ?? Math.min(top, 5));
    const pass = enough && share >= min && !extra;
    if (pass) passed++;
    const fails = got.filter((j) => !c.pred(j)).slice(0, 2).map((j) => `${j.title} (${j.city || j.region || '?'})`);
    rows.push({
      case: c.name,
      results: r.total,
      ok: `${ok}/${got.length}`,
      share: `${Math.round(share * 100)}%`,
      pass: pass ? 'PASS' : 'FAIL',
      note: [extra, !enough ? 'too few results' : null, ...(pass ? [] : fails)].filter(Boolean).join('; ').slice(0, 110),
    });
  }
  console.table(rows);
  const pct = Math.round((passed / CASES.length) * 100);
  console.log(`\nEval: ${passed}/${CASES.length} passed (${pct}%)`);
  process.exit(pct >= 90 ? 0 : 1);
}

run();
