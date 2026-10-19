'use client';

import { chunkText, extractProfile } from './profile';
import { saveProfile, setCvState as set, type CvProfile } from './cvState';

export type { CvProfile };

// Browser-side CV matching (BUILD.md §6). The CV is read and embedded on the device.
// Only the mean vector and the confirmed chips are ever sent to /api/match; they live in sessionStorage.

const MAX_BYTES = 5 * 1024 * 1024;

// ---------- Reading files (on the device) ----------

const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;

async function readPdf(buf: ArrayBuffer): Promise<string> {
  type PdfJs = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }> }> };
  };
  const pdfjs = (await dynamicImport('/vendor/pdfjs/pdf.min.mjs')) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join(''));
  }
  return parts.join('\n\n');
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

async function readDocx(buf: ArrayBuffer): Promise<string> {
  await loadScript('/vendor/mammoth.browser.min.js');
  const mammoth = (window as unknown as { mammoth: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } }).mammoth;
  return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
}

export class CvReadError extends Error {}

export async function readCvFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new CvReadError('That file is over 5 MB. Try a smaller file, or paste your CV.');
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  let text = '';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await readPdf(buf);
  else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) text = await readDocx(buf);
  else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) text = new TextDecoder().decode(buf);
  else throw new CvReadError('Radar reads PDF, DOCX and TXT files. You can also paste your CV.');
  if (text.replace(/\s+/g, '').length < 80) {
    throw new CvReadError(
      name.endsWith('.pdf') ? 'This PDF has no text layer (it looks scanned). Paste your CV text instead.' : 'We could not find any text in that file. Paste your CV instead.',
    );
  }
  return text;
}

// ---------- Embedding in a worker ----------

let worker: Worker | null = null;
let seq = 0;

function embed(text: string): Promise<number[]> {
  if (!worker) worker = new Worker('/cv-worker.js', { type: 'module' });
  const id = ++seq;
  const w = worker;
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'progress') set({ progress: { loaded: d.loaded, total: d.total } });
      if (d.id !== id) return;
      if (d.type === 'status') set({ status: d.status });
      else if (d.type === 'result') {
        w.removeEventListener('message', onMsg);
        resolve(d.vector);
      } else if (d.type === 'error') {
        w.removeEventListener('message', onMsg);
        reject(new Error(d.message));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, chunks: chunkText(text) });
  });
}

let vocabTitles: string[] | null = null;
async function titles(): Promise<string[]> {
  if (vocabTitles) return vocabTitles;
  try {
    vocabTitles = ((await (await fetch('/api/vocab')).json()) as { titles: string[] }).titles;
  } catch {
    vocabTitles = [];
  }
  return vocabTitles;
}

/** Full pipeline: file or pasted text → chips + vector. Leaves the state "ready" with an unsaved draft. */
export async function processCv(input: File | string, loc = ''): Promise<CvProfile | null> {
  set({ status: 'reading', error: null, progress: null });
  try {
    const text = typeof input === 'string' ? input : await readCvFile(input);
    if (text.replace(/\s+/g, '').length < 80) throw new CvReadError('That looks a bit short. Paste a little more of your CV.');
    const [chips, vector] = await Promise.all([titles().then((t) => extractProfile(text, t)), embed(text)]);
    const profile: CvProfile = { vector, chips, loc, fileName: typeof input === 'string' ? 'Pasted CV' : input.name };
    saveProfile(profile);
    return profile;
  } catch (e) {
    set({ status: 'error', error: e instanceof CvReadError ? e.message : 'Something went wrong reading your CV. Try again, or paste it.' });
    if (!(e instanceof CvReadError)) console.error(e);
    return null;
  }
}
