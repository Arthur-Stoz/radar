'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { REGIONS } from '@/lib/regions';
import { processCv } from '@/lib/cvClient';
import { clearCv, saveProfile, type CvProfile } from '@/lib/cvState';
import type { ProfileChip } from '@/lib/profile';
import { LensIcon, useCv } from './CvButton';

const mb = (n: number) => `${Math.round(n / 1e5) / 10} MB`;

export default function CvPanel({ id, getQuery, onClose }: { id: string; getQuery?: () => string; onClose: () => void }) {
  const router = useRouter();
  const cv = useCv();
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<CvProfile | null>(null);
  const [newChip, setNewChip] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = cv.status === 'reading' || cv.status === 'loading-model' || cv.status === 'embedding';
  const profile = draft ?? cv.profile;

  const run = async (input: File | string) => {
    setDraft(null);
    const p = await processCv(input, cv.profile?.loc || '');
    if (p) setDraft(p);
  };

  const update = (patch: Partial<CvProfile>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setDraft(next);
    saveProfile(next);
  };

  const removeChip = (c: ProfileChip) => update({ chips: profile!.chips.filter((x) => x !== c) });
  const addChip = () => {
    const label = newChip.trim();
    if (!label || !profile) return;
    update({ chips: [...profile.chips, { kind: 'skill', label, terms: [label.toLowerCase()] }] });
    setNewChip('');
  };

  const showMatches = () => {
    if (!profile) return;
    const p = new URLSearchParams();
    const q = getQuery?.().trim();
    if (q) p.set('q', q);
    if (profile.loc) p.set('loc', profile.loc);
    p.set('cv', '1');
    onClose();
    router.push(`/search?${p}`);
  };

  return (
        <div
          id={id}
          role="dialog"
          aria-label="Match with your CV"
          className="fixed inset-x-3 bottom-3 z-50 max-h-[85dvh] overflow-y-auto rounded-[20px] border border-line bg-bg p-5 text-left sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+14px)] sm:w-[400px]"
          style={{ boxShadow: 'var(--shadow-pop)', animation: 'rdFade .15s ease' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-[17px] font-[650] tracking-[-0.02em]">Match with your CV</h2>
            <button type="button" onClick={() => onClose()} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          {busy ? (
            <div className="py-6" role="status" aria-live="polite">
              <p className="m-0 text-[15px]">
                {cv.status === 'reading' ? 'Reading your CV…' : cv.status === 'loading-model' ? 'Getting the matcher ready…' : 'Matching your skills…'}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: cv.status === 'loading-model' && cv.progress ? `${Math.min(100, (cv.progress.loaded / cv.progress.total) * 100)}%` : cv.status === 'embedding' ? '100%' : '15%' }}
                />
              </div>
              {cv.status === 'loading-model' && cv.progress && (
                <p className="m-0 mt-2 font-mono text-[12px] text-muted">
                  {mb(cv.progress.loaded)} / {mb(cv.progress.total)} · only the first time
                </p>
              )}
            </div>
          ) : profile && cv.status === 'ready' ? (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-[14px] text-muted">
                From <span className="text-ink">{profile.fileName}</span>. Remove anything that’s wrong, add what’s missing.
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="What we found in your CV">
                {profile.chips.map((c) => (
                  <li key={`${c.kind}-${c.label}`}>
                    <button type="button" onClick={() => removeChip(c)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] hover:bg-surface-2" aria-label={`Remove ${c.label}`}>
                      {c.label}
                      <span aria-hidden="true" className="text-muted">
                        ×
                      </span>
                    </button>
                  </li>
                ))}
                {!profile.chips.length && <li className="text-[13px] text-muted">No skills detected — add a few below.</li>}
              </ul>
              {/* Not a <form>: this dialog lives inside the search form. */}
              <div className="flex gap-2">
                <input
                  value={newChip}
                  onChange={(e) => setNewChip(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChip();
                    }
                  }} placeholder="Add a skill or job title" aria-label="Add a skill or job title" className="h-10 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[14px] outline-none focus:border-accent" />
                <button type="button" onClick={addChip} className="h-10 rounded-full bg-surface px-4 text-[14px] hover:bg-surface-2">
                  Add
                </button>
              </div>
              <label className="flex flex-col gap-1.5 text-[14px]">
                Where do you want to work?
                <select value={profile.loc} onChange={(e) => update({ loc: e.target.value })} className="h-10 rounded-full border border-line bg-bg px-3 text-[14px]">
                  <option value="">All of New Zealand</option>
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={showMatches} className="h-11 flex-1 rounded-full bg-ink px-5 text-[15px] font-[550] text-on-ink hover:opacity-90">
                  Show my matches
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearCv();
                    setDraft(null);
                  }}
                  className="h-11 rounded-full px-4 text-[14px] text-muted hover:text-ink"
                >
                  Clear CV
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cv.status === 'error' && cv.error && (
                <p className="m-0 rounded-[12px] bg-surface p-3 text-[14px]" role="alert">
                  {cv.error}
                </p>
              )}
              {paste ? (
                <>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={7}
                    placeholder="Paste your CV here"
                    aria-label="Paste your CV"
                    className="w-full resize-y rounded-[12px] border border-line bg-bg p-3 text-[14px] outline-none focus:border-accent"
                  />
                  <button type="button" disabled={text.trim().length < 80} onClick={() => run(text)} className="h-11 rounded-full bg-ink px-5 text-[15px] font-[550] text-on-ink disabled:opacity-40">
                    Use this text
                  </button>
                  <button type="button" onClick={() => setPaste(false)} className="text-[14px] text-muted underline underline-offset-2">
                    Upload a file instead
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const f = e.dataTransfer.files?.[0];
                      if (f) void run(f);
                    }}
                    className="flex flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-line-strong px-4 py-8 text-center hover:border-ink"
                  >
                    <LensIcon active={false} />
                    <span className="text-[15px] font-medium">Drop your CV (PDF, DOCX or TXT)</span>
                    <span className="text-[13px] text-muted">or click to choose a file</span>
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    data-testid="cv-file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void run(f);
                      e.target.value = '';
                    }}
                  />
                  <button type="button" onClick={() => setPaste(true)} className="text-[14px] text-muted underline underline-offset-2 hover:text-ink">
                    or paste it
                  </button>
                </>
              )}
              <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Read on your device. Never uploaded.
              </p>
            </div>
          )}
        </div>
  );
}
