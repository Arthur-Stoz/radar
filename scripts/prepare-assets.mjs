// Copies the browser assets the CV matcher needs into public/ so that nothing is loaded from a
// third-party CDN: transformers.js + its ONNX runtime wasm, the embedding model, pdf.js, mammoth.
// Runs automatically before `npm run dev` and `npm run build` (predev / prebuild).
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const pub = join(root, 'public');
const nm = join(root, 'node_modules');

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx'];

function copy(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) return;
  copyFileSync(src, dest);
}

const tf = join(nm, '@huggingface/transformers/dist');
for (const f of ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) copy(join(tf, f), join(pub, 'vendor/transformers', f));
copy(join(nm, 'pdfjs-dist/build/pdf.min.mjs'), join(pub, 'vendor/pdfjs/pdf.min.mjs'));
copy(join(nm, 'pdfjs-dist/build/pdf.worker.min.mjs'), join(pub, 'vendor/pdfjs/pdf.worker.min.mjs'));
copy(join(nm, 'mammoth/mammoth.browser.min.js'), join(pub, 'vendor/mammoth.browser.min.js'));

// Model: reuse the ingest cache when present, otherwise download once from Hugging Face.
const modelDir = join(pub, 'models', MODEL);
const cacheDir = join(root, process.env.CACHE_DIR || '.cache', 'models', MODEL);
for (const f of MODEL_FILES) {
  const dest = join(modelDir, f);
  if (existsSync(dest) && statSync(dest).size > 0) continue;
  mkdirSync(dirname(dest), { recursive: true });
  const cached = join(cacheDir, f);
  if (existsSync(cached)) {
    copyFileSync(cached, dest);
    continue;
  }
  const url = `https://huggingface.co/${MODEL}/resolve/main/${f}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (f === 'special_tokens_map.json') continue; // optional
    throw new Error(`prepare-assets: cannot download ${url} (${res.status})`);
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
console.log('prepare-assets: browser assets ready in public/vendor and public/models');
