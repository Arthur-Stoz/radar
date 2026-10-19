import { createHash } from 'node:crypto';
import type { CardJob } from './search';

// Optional AI rerank (BUILD.md §6.4). Only when GEMINI_API_KEY is set.
// Sends ONLY the profile chips and the top jobs' titles + summaries — never CV text or personal data.
// 2.5 s timeout; any error, 429 or timeout silently keeps the local ranking.

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; // free-tier Flash-Lite (ai.google.dev, checked 2026-10-19)
const TIMEOUT_MS = 2500;
const cache = new Map<string, { order: string[]; reasons: Record<string, string> }>();

export const rerankEnabled = () => !!process.env.GEMINI_API_KEY;

export async function rerank(chips: string[], jobs: CardJob[]): Promise<CardJob[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || jobs.length < 3 || !chips.length) return jobs;
  const top = jobs.slice(0, 30);
  const cacheKey = createHash('sha1')
    .update(JSON.stringify([chips, top.map((j) => j.id)]))
    .digest('hex');
  let plan = cache.get(cacheKey);
  if (!plan) {
    const list = top.map((j, i) => `${i + 1}. [${j.id}] ${j.title}${j.company ? ` — ${j.company}` : ''} (${j.location}). ${j.summary.slice(0, 220)}`).join('\n');
    const prompt = `A job seeker in New Zealand has this profile: ${chips.join(', ')}.
Rank these jobs from best to worst fit for them. For each, give one short reason (max 12 words) tied to the profile.
Return JSON only: {"ranking":[{"id":"<id>","reason":"<reason>"}]} including every id once.

${list}`;
    try {
      const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return jobs;
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const parsed = JSON.parse(text) as { ranking?: { id: string; reason?: string }[] };
      const ids = new Set(top.map((j) => j.id));
      const order = (parsed.ranking || []).map((r) => r.id).filter((id) => ids.has(id));
      if (order.length < top.length / 2) return jobs;
      plan = { order, reasons: Object.fromEntries((parsed.ranking || []).filter((r) => r.reason).map((r) => [r.id, String(r.reason).slice(0, 120)])) };
      cache.set(cacheKey, plan);
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    } catch {
      return jobs;
    }
  }
  const byId = new Map(top.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const ordered: CardJob[] = [];
  for (const id of plan.order) {
    const j = byId.get(id);
    if (j && !seen.has(id)) {
      seen.add(id);
      ordered.push({ ...j, reason: plan.reasons[id] });
    }
  }
  for (const j of top) if (!seen.has(j.id)) ordered.push(j);
  return [...ordered, ...jobs.slice(30)];
}
