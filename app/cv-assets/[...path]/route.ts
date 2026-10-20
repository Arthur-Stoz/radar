import { createReadStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { dataDir } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Browser assets for the CV matcher (pdf.js, mammoth, transformers.js + ONNX wasm, the MiniLM model), served by Radar
// itself so the visitor's browser never calls a CDN. They are read from node_modules at runtime, so production does not
// depend on a build step copying them into public/ (a host that runs `next build` directly skips npm's prebuild hook).
// The model is looked up in public/models and the ingest cache, else downloaded once from Hugging Face by the server.

const root = process.cwd();
const nm = join(root, 'node_modules');
const MODEL = 'Xenova/all-MiniLM-L6-v2';
const MODEL_FILES = new Set(['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']);

const VENDOR: Record<string, string> = {
  'vendor/pdfjs/pdf.min.mjs': join(nm, 'pdfjs-dist/build/pdf.min.mjs'),
  'vendor/pdfjs/pdf.worker.min.mjs': join(nm, 'pdfjs-dist/build/pdf.worker.min.mjs'),
  'vendor/mammoth.browser.min.js': join(nm, 'mammoth/mammoth.browser.min.js'),
  'vendor/transformers/transformers.min.js': join(nm, '@huggingface/transformers/dist/transformers.min.js'),
  'vendor/transformers/ort-wasm-simd-threaded.jsep.mjs': join(nm, '@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs'),
  'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm': join(nm, '@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm'),
};

const TYPES: Record<string, string> = {
  mjs: 'text/javascript; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  wasm: 'application/wasm',
  json: 'application/json; charset=utf-8',
  onnx: 'application/octet-stream',
};

const downloads = new Map<string, Promise<string | null>>();
const missing = new Map<string, number>(); // file → time of the last failed download (retry after 10 min)

async function modelFile(file: string): Promise<string | null> {
  const candidates = [
    join(root, 'public/models', MODEL, file),
    join(root, process.env.CACHE_DIR || '.cache', 'models', MODEL, file),
    join(dataDir(), 'models', MODEL, file),
  ];
  for (const c of candidates) if (existsSync(c) && statSync(c).size > 0) return c;
  const dest = candidates[2];
  if (Date.now() - (missing.get(file) ?? 0) < 600_000) return null;
  let p = downloads.get(dest);
  if (!p) {
    p = (async () => {
      const url = `https://huggingface.co/${MODEL}/resolve/main/${file}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) {
        if (file !== 'special_tokens_map.json') console.error(`[cv-assets] ${url} → HTTP ${res.status}`);
        missing.set(file, Date.now());
        return null;
      }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(`${dest}.tmp`, Buffer.from(await res.arrayBuffer()));
      renameSync(`${dest}.tmp`, dest);
      return dest;
    })()
      .catch((e) => {
        console.error(`[cv-assets] model download failed (${file}):`, e);
        missing.set(file, Date.now());
        return null;
      })
      .finally(() => downloads.delete(dest));
    downloads.set(dest, p);
  }
  return p;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const rel = (await ctx.params).path.join('/');
  let file: string | null = null;
  if (VENDOR[rel]) file = VENDOR[rel];
  else if (rel.startsWith(`models/${MODEL}/`) && MODEL_FILES.has(rel.slice(`models/${MODEL}/`.length))) file = await modelFile(rel.slice(`models/${MODEL}/`.length));
  if (!file || !existsSync(file)) {
    if (file) console.error(`[cv-assets] missing file for ${rel}: ${file}`);
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  const ext = rel.slice(rel.lastIndexOf('.') + 1);
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'content-length': String(statSync(file).size),
      'cache-control': 'public, max-age=604800',
    },
  });
}
