// Rank jobs for a CV file, the way the browser does it: `npx tsx scripts/cv-match.ts tests/fixtures/cv-hospitality.txt [query]`
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EMBED_DTYPE, EMBED_MAX_TOKENS, EMBED_MODEL } from '../lib/embedding';
import { chunkText, extractProfile, meanNormalized } from '../lib/profile';
import { search, type SearchInput } from '../lib/search';
import { getStore } from '../lib/db';

export async function cvVector(text: string): Promise<number[]> {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = join(resolve(process.env.CACHE_DIR || './.cache'), 'models');
  const fe = await pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE });
  fe.tokenizer.model_max_length = EMBED_MAX_TOKENS;
  const out = await fe(chunkText(text), { pooling: 'mean', normalize: true });
  return meanNormalized(out.tolist() as number[][]);
}

export function cvChips(text: string) {
  const store = getStore();
  const titles = store ? store.vocab.filter((v) => v.kind === 'title').slice(0, 1500).map((v) => v.display.toLowerCase()) : [];
  return extractProfile(text, titles);
}

async function main() {
  const text = readFileSync(process.argv[2], 'utf8');
  const chips = cvChips(text);
  console.log('chips:', chips.map((c) => `${c.kind}:${c.label}`).join(' · '));
  const vector = await cvVector(text);
  const input: SearchInput = { q: process.argv[3] || '', cv: { vector, chips }, pageSize: Number(process.env.N || 15), page: Number(process.env.P || 1) };
  const r = search(input);
  console.log(`total ${r.total}, ${r.tookMs} ms`);
  for (const j of r.results) console.log(`${String(j.match).padStart(3)}% ${j.score?.toFixed(3)}  ${j.title} · ${j.company} · ${j.location}  [${(j.why || []).join(', ')}]`);
}

if (process.argv[1]?.endsWith('cv-match.ts')) void main();
