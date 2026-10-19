// Rule-based tags and work types (BUILD.md §4.2). Multi-word patterns with simple negation guards.

export const TAGS = [
  'whv-friendly',
  'no-experience',
  'student-friendly',
  'accommodation',
  'transport-provided',
  'visa-sponsorship',
  'remote',
  'weekend',
  'night',
  'immediate-start',
  'seasonal',
  'driver-licence',
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  'whv-friendly': 'Working holiday friendly',
  'no-experience': 'No experience',
  'student-friendly': 'Student friendly',
  accommodation: 'Accommodation',
  'transport-provided': 'Transport provided',
  'visa-sponsorship': 'Visa sponsorship',
  remote: 'Remote',
  weekend: 'Weekends',
  night: 'Night shifts',
  'immediate-start': 'Immediate start',
  seasonal: 'Seasonal',
  'driver-licence': 'Driver licence',
};

/** Short labels for cards. */
export const TAG_SHORT: Record<Tag, string> = {
  'whv-friendly': 'WHV friendly',
  'no-experience': 'No experience',
  'student-friendly': 'Students',
  accommodation: 'Accommodation',
  'transport-provided': 'Transport',
  'visa-sponsorship': 'Visa sponsorship',
  remote: 'Remote',
  weekend: 'Weekends',
  night: 'Nights',
  'immediate-start': 'Starts now',
  seasonal: 'Seasonal',
  'driver-licence': 'Licence',
};

const NEG = String.raw`(?:no|not|non|unable to|cannot|can't|can ?not|unfortunately|we do not|we don't|won't|will not|without|n't)`;

interface Rule {
  tag: Tag;
  pos: RegExp[];
  /** If a positive match is preceded (within ~40 chars) by a negation, it is ignored. */
  negatable?: boolean;
  /** Any of these anywhere in the text vetoes the tag. */
  veto?: RegExp[];
}

const RULES: Rule[] = [
  {
    tag: 'whv-friendly',
    pos: [
      /working[- ]holiday(ers| makers| visa| visas| visa holders)?/,
      /\bwhv\b/,
      /backpackers? (are )?welcome/,
      /suit(s|able for)? backpackers?/,
      /all visas? (types? )?(welcome|accepted|considered)/,
      /open work visas? (holders )?(welcome|accepted|considered)/,
      /(travell?ers|backpackers) (welcome|wanted)/,
      /ideal for backpackers/,
    ],
    negatable: true,
    veto: [/not (suitable|open) (for|to) (working holiday|backpackers|whv)/, /no (working holiday|backpackers|whv)/, /working holiday visas? (are )?not/],
  },
  {
    tag: 'no-experience',
    pos: [
      /no (previous |prior |formal )?experience (is )?(necessary|required|needed|essential|neccessary)/,
      /experience (is )?not (necessary|required|needed|essential)/,
      /(full|on[- ]the[- ]job|all) training (is )?(provided|given|available)/,
      /training (will be )?provided/,
      /\bwe will train\b|\bwe'll train\b|\bwill train the right/,
      /\bentry[- ]level\b/,
      /no experience\b/,
      /\bentrylevel\b/,
      /\bbeginners? welcome\b/,
    ],
  },
  {
    tag: 'student-friendly',
    pos: [/students? (are )?welcome/, /suit(s|able for)? (a |uni |university )?students?/, /\bstudent (job|role|position|work)/, /around (your )?(study|studies|uni|classes)/, /\b(uni|university) students\b/, /school holidays/, /summer (job|work) for students/],
  },
  {
    tag: 'accommodation',
    pos: [
      /accommodation (is )?(provided|available|included|supplied|offered|can be arranged|on[- ]site|options)/,
      /(staff|worker|workers'?|on[- ]site|onsite|free|subsidi[sz]ed|shared) accommodation/,
      /\blive[- ]in\b/,
      /(bed|room|housing|lodging) (is )?(included|provided)/,
      /help (with|finding) accommodation/,
    ],
    negatable: true,
    veto: [/accommodation (is )?not (provided|available|included)/],
  },
  {
    tag: 'transport-provided',
    pos: [/transport (is )?(provided|available|included|to and from)/, /(free |daily )?shuttle (service|bus|to|provided|available)/, /pick[- ]?ups? (and|&) drop[- ]?offs?/, /(company|work) (van|bus) (provided|transport)/, /transport to (and from )?(work|site|the orchard)/],
    negatable: true,
  },
  {
    tag: 'visa-sponsorship',
    pos: [/visa sponsorship (is )?(available|offered|provided|possible|considered)/, /(we|employer) (can|will|may) (sponsor|support)( your| a)? (work )?visa/, /sponsorship (is )?available/, /accredited employer/, /\baewv\b/, /support (with |for )?(your )?(work )?visa applications?/],
    negatable: true,
    veto: [/(no|not able to offer|unable to offer|cannot offer|can't offer|do not offer|don't offer|not offering) (visa )?sponsorship/, /sponsorship (is )?not (available|offered|provided)/, /must (already )?(have|hold) (the )?(right|legal right|eligibility) to work/],
  },
  {
    tag: 'remote',
    pos: [/\b(fully |100% )?remote (role|position|work|working|job|first|friendly|option)/, /\bwork(ing)? from home\b/, /\bwfh\b/, /\bremote(ly)?\b(?! (area|location|site|sites|community|communities|rural|island))/],
    negatable: true,
  },
  {
    tag: 'weekend',
    pos: [/\bweekends?\b/, /saturday(s)? (and|&) sunday(s)?/],
    veto: [/no weekends?/, /weekends? off/, /monday (to|-) friday only/],
  },
  { tag: 'night', pos: [/night ?shifts?/, /\bnights?\b (roster|work|role|position)/, /overnight (shifts?|work|roster)/, /\bgraveyard shift/] },
  {
    tag: 'immediate-start',
    pos: [/immediate start/, /start(ing)? (immediately|asap|right away|now|straight away|this week|tomorrow)/, /\basap start/, /available immediately/, /urgent(ly)? (start|hiring|required|needed)/],
  },
  {
    tag: 'seasonal',
    pos: [/\bseasonal\b/, /\bharvest\b/, /(summer|winter|picking|ski|kiwifruit|apple|cherry|vintage|grape) season/, /\bvintage\b/, /\bpicking\b/, /\bthinning\b/, /\bpruning\b/, /\bpackhouse\b/, /\bcherry pick/, /fruit pick/],
  },
  {
    tag: 'driver-licence',
    pos: [/driver'?s'? licen[cs]e/, /\b(full|restricted|clean|current) (nz )?(driver'?s?'? )?licen[cs]e/, /class [1-5]( licen[cs]e)?\b/, /licen[cs]e class [1-5]/, /\bhpmv\b/, /\bheavy vehicle licen[cs]e/],
  },
];

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index);
  return new RegExp(NEG + String.raw`\b[^.!?\n]{0,25}$`).test(before);
}

export function detectTags(text: string, opts: { isRemote?: boolean; workTypes?: string[] } = {}): Tag[] {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  const found = new Set<Tag>();
  for (const rule of RULES) {
    if (rule.veto?.some((v) => v.test(t))) continue;
    for (const re of rule.pos) {
      const m = re.exec(t);
      if (!m) continue;
      if (rule.negatable && negated(t, m.index)) continue;
      found.add(rule.tag);
      break;
    }
  }
  if (opts.isRemote) found.add('remote');
  if (opts.workTypes?.includes('seasonal')) found.add('seasonal');
  return TAGS.filter((x) => found.has(x));
}

// ---------- Work types ----------

export const WORK_TYPES = ['full-time', 'part-time', 'casual', 'contract', 'temp', 'seasonal', 'internship'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  'full-time': 'Full time',
  'part-time': 'Part time',
  casual: 'Casual',
  contract: 'Contract',
  temp: 'Temporary',
  seasonal: 'Seasonal',
  internship: 'Internship',
};

const WT_RULES: [WorkType, RegExp][] = [
  ['full-time', /\bfull[- ]?time\b|\bft\b|\bpermanent full\b|\bfulltime\b/],
  ['part-time', /\bpart[- ]?time\b|\bpt\b|\bparttime\b/],
  ['casual', /\bcasual\b/],
  ['contract', /\bcontract(or)?\b|\bfixed[- ]term\b|\bct\b/],
  ['temp', /\btemp(orary)?\b/],
  ['seasonal', /\bseasonal\b/],
  ['internship', /\bintern(ship)?\b|\bgraduate programme\b|\bsummer intern/],
];

const PROSE_RULES: [WorkType, RegExp][] = [
  ['full-time', /\bfull[- ]?time\b/],
  ['part-time', /\bpart[- ]?time\b/],
  ['casual', /\bcasual (role|position|work|staff|basis|job)/],
  ['seasonal', /\bseasonal (role|position|work|staff|job)/],
  ['internship', /\binternship\b/],
];

/** Work types from explicit labels (source fields) first; text is a weaker signal. */
export function detectWorkTypes(labels: (string | null | undefined)[], text = ''): WorkType[] {
  const found = new Set<WorkType>();
  const lab = labels.filter(Boolean).join(' | ').toLowerCase();
  for (const [wt, re] of WT_RULES) if (re.test(lab)) found.add(wt);
  if (!found.size && text) {
    // Prose is a weaker signal: only explicit words, no abbreviations, no "contract"/"temp".
    const t = text.toLowerCase().slice(0, 1500);
    for (const [wt, re] of PROSE_RULES) if (re.test(t)) found.add(wt);
  }
  return WORK_TYPES.filter((w) => found.has(w));
}
