// CV matcher worker (BUILD.md §6.2): embeds CV chunks on the device with the same model as the
// server (Xenova/all-MiniLM-L6-v2, q8). Everything is served by Radar itself: no CDN, no upload.
import { env, pipeline } from '/cv-assets/vendor/transformers/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/cv-assets/models/';
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = '/cv-assets/vendor/transformers/';
env.backends.onnx.wasm.numThreads = 1;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor = null;

async function load() {
  if (extractor) return extractor;
  const files = {};
  extractor = await pipeline('feature-extraction', MODEL, {
    dtype: 'q8',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        files[p.file] = [p.loaded, p.total];
        let loaded = 0;
        let total = 0;
        for (const [l, t] of Object.values(files)) {
          loaded += l;
          total += t;
        }
        self.postMessage({ type: 'progress', loaded, total });
      }
    },
  });
  // MiniLM was trained on 256 word pieces.
  extractor.tokenizer.model_max_length = 256;
  return extractor;
}

function meanNormalized(vs) {
  const d = vs[0].length;
  const m = new Array(d).fill(0);
  for (const v of vs) for (let i = 0; i < d; i++) m[i] += v[i];
  const n = Math.sqrt(m.reduce((s, x) => s + x * x, 0)) || 1;
  return m.map((x) => x / n);
}

self.onmessage = async (e) => {
  const { id, chunks } = e.data;
  try {
    self.postMessage({ id, type: 'status', status: 'loading-model' });
    const fe = await load();
    self.postMessage({ id, type: 'status', status: 'embedding' });
    const out = await fe(chunks, { pooling: 'mean', normalize: true });
    self.postMessage({ id, type: 'result', vector: meanNormalized(out.tolist()) });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};
