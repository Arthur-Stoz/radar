import { join, resolve } from 'node:path';
import { EMBED_DTYPE, EMBED_MAX_TOKENS, EMBED_MODEL } from './embedding';

// Server-side query embedding (BUILD.md §5.4), only when SEMANTIC_QUERY=on.
// Lazy-loaded on first use; small LRU cache so repeated searches are free.

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const g = globalThis as unknown as { __radarExtractor?: Promise<Extractor> };
const cache = new Map<string, number[]>();
const MAX = 500;

export const semanticEnabled = () => (process.env.SEMANTIC_QUERY || 'off').toLowerCase() === 'on';

function extractor(): Promise<Extractor> {
  if (!g.__radarExtractor) {
    g.__radarExtractor = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = join(resolve(process.env.CACHE_DIR || './.cache'), 'models');
      const fe = await pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE });
      // MiniLM was trained on 256 word pieces; longer inputs only cost time.
      fe.tokenizer.model_max_length = EMBED_MAX_TOKENS;
      return fe as unknown as Extractor;
    })();
    g.__radarExtractor.catch(() => (g.__radarExtractor = undefined));
  }
  return g.__radarExtractor;
}

/** Normalized query vector, or null when disabled / unavailable (search still works without it). */
export async function embedQuery(text: string, timeoutMs = 1500): Promise<number[] | null> {
  const key = text.trim().toLowerCase();
  if (!semanticEnabled() || key.length < 3) return null;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  try {
    const run = extractor().then((fe) => fe([key], { pooling: 'mean', normalize: true }));
    const out = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
    if (!out) return null;
    const v = out.tolist()[0];
    cache.set(key, v);
    if (cache.size > MAX) cache.delete(cache.keys().next().value!);
    return v;
  } catch {
    return null;
  }
}
