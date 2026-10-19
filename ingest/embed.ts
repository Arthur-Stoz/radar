import { EMBED_DTYPE, EMBED_MAX_TOKENS, EMBED_MODEL, quantize } from '../lib/embedding';

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractor: Extractor | null = null;

async function load(cacheDir: string): Promise<Extractor> {
  if (extractor) return extractor;
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = cacheDir;
  const fe = await pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE });
  // MiniLM was trained on 256 word pieces; longer inputs only cost time.
  fe.tokenizer.model_max_length = EMBED_MAX_TOKENS;
  extractor = fe as unknown as Extractor;
  return extractor;
}

/** Embed texts in batches; returns Int8 vectors in input order. */
export async function embedAll(texts: string[], opts: { cacheDir: string; batch?: number; log?: (m: string) => void; stopAt?: number }): Promise<Int8Array[]> {
  const fe = await load(opts.cacheDir);
  const size = opts.batch ?? 32;
  const out: Int8Array[] = [];
  const t0 = Date.now();
  for (let i = 0; i < texts.length; i += size) {
    if (opts.stopAt && Date.now() > opts.stopAt) {
      opts.log?.(`embeddings: time budget reached at ${i}/${texts.length}; the rest is embedded next run`);
      break;
    }
    const res = await fe(texts.slice(i, i + size), { pooling: 'mean', normalize: true });
    for (const v of res.tolist()) out.push(quantize(v));
    if (opts.log && (i / size) % 50 === 0 && i) {
      const rate = (i / ((Date.now() - t0) / 1000)).toFixed(0);
      opts.log(`embeddings: ${i}/${texts.length} (${rate}/s)`);
    }
  }
  return out;
}
