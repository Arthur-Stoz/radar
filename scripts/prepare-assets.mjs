// Pre-fetches the embedding model the CV matcher runs in the browser into public/models, so dev/CI never wait for it.
// Optional: app/cv-assets serves the readers from node_modules and downloads the model at runtime when this did not run.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const pub = join(root, 'public');

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx'];

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
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) {
    // Not fatal: app/cv-assets downloads the model at runtime.
    if (f !== 'special_tokens_map.json') console.warn(`prepare-assets: cannot download ${url} (${res?.status ?? 'network error'})`);
    continue;
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
console.log('prepare-assets: model ready in public/models');
