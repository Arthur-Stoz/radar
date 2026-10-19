'use client';

import type { ProfileChip } from './profile';

// Lightweight CV state (sessionStorage only). The heavy reader/embedder lives in cvClient.ts and is loaded on demand.

export interface CvProfile {
  vector: number[];
  chips: ProfileChip[];
  /** Region id or "" for all of New Zealand. */
  loc: string;
  fileName: string;
}

export type CvStatus = 'idle' | 'reading' | 'loading-model' | 'embedding' | 'ready' | 'error';

export interface CvState {
  status: CvStatus;
  progress: { loaded: number; total: number } | null;
  error: string | null;
  profile: CvProfile | null;
}

const KEY = 'radar-cv';
let state: CvState = { status: 'idle', progress: null, error: null, profile: null };
let hydrated = false;
const listeners = new Set<() => void>();

export function setCvState(patch: Partial<CvState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeCv(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCvState(): CvState {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) state = { ...state, status: 'ready', profile: JSON.parse(saved) };
    } catch {}
  }
  return state;
}

const SERVER_STATE: CvState = { status: 'idle', progress: null, error: null, profile: null };
export const getCvServerState = () => SERVER_STATE;

export function saveProfile(p: CvProfile) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  setCvState({ profile: p, status: 'ready', error: null });
}

export function clearCv() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  setCvState({ status: 'idle', progress: null, error: null, profile: null });
}

export const OPEN_CV_EVENT = 'radar:open-cv';
