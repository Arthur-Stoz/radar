'use client';

import { chunkText, extractProfile } from './profile';
import { saveProfile, setCvState as set, type CvProfile } from './cvState';

export type { CvProfile };

// Browser-side CV matching (BUILD.md §6). The CV is read and embedded on the device.
// Only the mean vector and the confirmed chips are ever sent to /api/match; they live in sessionStorage.

const MAX_BYTES = 5 * 1024 * 1024;

// The readers and the model are served by app/cv-assets (from node_modules at runtime, not from a build-time copy).
const ASSETS = '/cv-assets/vendor';

export class CvReadError extends Error {}

// ---------- Reading files (on the device) ----------

const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;

async function readPdf(buf: ArrayBuffer): Promise<string> {
  type PdfJs = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }> }> };
  };
  let pdfjs: PdfJs;
  try {
    pdfjs = (await dynamicImport(`${ASSETS}/pdfjs/pdf.min.mjs`)) as PdfJs;
  } catch (e) {
    console.error('[cv] could not load the PDF reader', e);
    throw new CvReadError('The PDF reader did not load. Check your connection and try again, or paste your CV.');
  }
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdfjs/pdf.worker.min.mjs`;
  let doc: Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data: buf }).promise;
  } catch (e) {
    console.error('[cv] could not open the PDF', e);
    const name = (e as { name?: string } | null)?.name;
    if (name === 'PasswordException') throw new CvReadError('This PDF is password-protected. Remove the password, or paste your CV.');
    if (name === 'InvalidPDFException') throw new CvReadError('This file is not a valid PDF (it may be damaged). Try another file, or paste your CV.');
    throw new CvReadError('We could not open this PDF. Try another file, or paste your CV.');
  }
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
    s.onerror = () => {
      s.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(s);
  });
}

async function readDocx(buf: ArrayBuffer): Promise<string> {
  try {
    await loadScript(`${ASSETS}/mammoth.browser.min.js`);
  } catch (e) {
    console.error('[cv] could not load the Word reader', e);
    throw new CvReadError('The Word reader did not load. Check your connection and try again, or paste your CV.');
  }
  const mammoth = (window as unknown as { mammoth: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } }).mammoth;
  try {
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  } catch (e) {
    console.error('[cv] could not read the DOCX', e);
    throw new CvReadError('We could not read this Word file (.docx only, not the old .doc). Try another file, or paste your CV.');
  }
}

export async function readCvFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new CvReadError(`That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 5 MB. Try a smaller file, or paste your CV.`);
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
    const done = () => {
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
    };
    // A module worker whose imports fail never posts a message: it fires "error" on the Worker instead.
    const onErr = (e: ErrorEvent) => {
      done();
      worker = null;
      w.terminate();
      reject(new Error(`CV worker failed to start: ${e.message || 'script error'}`));
    };
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'progress') set({ progress: { loaded: d.loaded, total: d.total } });
      if (d.id !== id) return;
      if (d.type === 'status') set({ status: d.status });
      else if (d.type === 'result') {
        done();
        resolve(d.vector);
      } else if (d.type === 'error') {
        done();
        reject(new Error(d.message));
      }
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
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
    // If the on-device model cannot load, keep going: matching then uses the profile chips (keywords) only.
    const [chips, vector] = await Promise.all([
      titles().then((t) => extractProfile(text, t)),
      embed(text).catch((e) => {
        console.error('[cv] the matcher model is unavailable, matching on keywords only', e);
        return null;
      }),
    ]);
    const profile: CvProfile = { vector, chips, loc, fileName: typeof input === 'string' ? 'Pasted CV' : input.name };
    saveProfile(profile);
    return profile;
  } catch (e) {
    console.error('[cv] reading failed', e);
    set({
      status: 'error',
      error: e instanceof CvReadError ? e.message : `Something went wrong reading your CV (${e instanceof Error ? e.message : String(e)}). Try again, or paste it.`,
    });
    return null;
  }
}
