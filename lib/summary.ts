import { clip } from './text';

// Extractive summary (BUILD.md §4.2): no AI, the 1–2 most informative sentences.

const BOILERPLATE = [
  /^about (us|the company|the business|the team|our company|the organisation|the organization)\b/i,
  /equal (employment )?opportunit/i,
  /\beeo\b/i,
  /we (are an|are committed to|celebrate|encourage applications from) (equal|divers|inclus)/i,
  /\b(click|press|hit) (the )?["“]?apply/i,
  /\bapply (now|today|online|via|through|below)\b/i,
  /to apply,? (please|send|email|click)/i,
  /\bonly (shortlisted|successful) (applicants|candidates)\b/i,
  /\bmust (have|hold) (the )?(right|legal right|nz residency|eligibility)\b/i,
  /\bnz (citizens?|residents?) (or|and) /i,
  /\bprivacy (act|policy|statement)\b/i,
  /\bapplications close\b/i,
  /\breferences? (will be|are) (required|checked)/i,
  /\bpre-employment (checks?|screening)/i,
  /\bwe thank all applicants\b/i,
  /\bwork rights?\b.*\brequired\b/i,
  /^(job )?ref(erence)?[: #]/i,
  /\bvisit (our|the) (website|careers)/i,
  /^https?:\/\//i,
  /^\W*$/,
];

const SIGNAL = [
  /\b(we are|we're) (looking|seeking|hiring|recruiting)/i,
  /\b(looking for|seeking) (a|an|someone|experienced|enthusiastic|motivated|reliable)/i,
  /\byou will (be|join|work|help|lead|support|have)/i,
  /\bthe role\b|\bthis role\b|\bthis position\b|\bthe position\b/i,
  /\bjoin (our|the|a)\b/i,
  /\$\d/,
  /\b(full|part)[- ]time\b|\bcasual\b|\bpermanent\b|\bfixed[- ]term\b/i,
  /\b(hours|shifts?|roster)\b/i,
];

export function splitSentences(text: string): string[] {
  return text
    .replace(/•/g, '\n')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
}

export function extractSummary(description: string, title = '', max = 280): string {
  const sentences = splitSentences(description);
  if (!sentences.length) return clip(description.replace(/\s+/g, ' ').trim(), max);
  const titleWords = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = sentences
    .map((s, i) => {
      if (BOILERPLATE.some((re) => re.test(s))) return { s, i, score: -1 };
      let score = 1 / (1 + i * 0.35); // earlier is better
      for (const re of SIGNAL) if (re.test(s)) score += 0.6;
      const low = s.toLowerCase();
      for (const w of titleWords) if (low.includes(w)) score += 0.4;
      if (s.length < 50) score -= 0.4;
      if (s.endsWith(':')) score -= 0.8;
      if (/^[A-Z][A-Za-z ]{0,40}$/.test(s)) score -= 1; // headings
      return { s, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return clip(sentences[0], max);
  const best = scored[0];
  let out = best.s;
  const second = scored.slice(1).find((x) => x.s.length + out.length + 1 <= max);
  if (second) out = second.i < best.i ? `${second.s} ${out}` : `${out} ${second.s}`;
  if (!/[.!?…]$/.test(out)) out += '.';
  return clip(out, max);
}
