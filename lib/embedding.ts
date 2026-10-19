// One embedding model everywhere (ingest, server query embedding, browser CV matcher).
// Xenova/all-MiniLM-L6-v2, 8-bit quantized ONNX (~23 MB): the smallest widely used English
// sentence-embedding model with solid retrieval quality. Small matters because the CV matcher
// downloads it into the visitor's browser. 384 dimensions, mean pooling, L2-normalized.
export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DTYPE = 'q8' as const;
export const EMBED_DIM = 384;
export const EMBED_MAX_TOKENS = 256;

/** L2-normalized float vector → Int8 (×127). */
export function quantize(v: ArrayLike<number>): Int8Array {
  const out = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Math.max(-127, Math.min(127, Math.round(v[i] * 127)));
  return out;
}

/** Cosine between a float query (normalized) and an Int8 stored vector. */
export function cosineQ(q: ArrayLike<number>, stored: Int8Array): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < stored.length; i++) {
    s += q[i] * stored[i];
    n += stored[i] * stored[i];
  }
  return n ? s / Math.sqrt(n) : 0;
}
