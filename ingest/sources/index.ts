import type { Source } from '../types';
import { seek } from './seek';
import { trademe } from './trademe';
import { jobsgovt } from './jobsgovt';
import { backpackerboard } from './backpackerboard';
import { picknz } from './picknz';
import { facebook } from './facebook';
import { ashby, greenhouse, lever, smartrecruiters, workable } from './ats';

export const ALL_SOURCES: Source[] = [seek, trademe, jobsgovt, greenhouse, lever, smartrecruiters, workable, ashby, backpackerboard, picknz, facebook];

const list = (v: string | undefined) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Enabled flag, overridden by DISABLED_SOURCES (turn off) and ENABLED_SOURCES (opt in, e.g. once permission is granted). */
export function activeSources(env: NodeJS.ProcessEnv = process.env): Source[] {
  const off = new Set(list(env.DISABLED_SOURCES));
  const on = new Set(list(env.ENABLED_SOURCES));
  return ALL_SOURCES.filter((s) => !off.has(s.id) && (s.enabled || on.has(s.id)));
}

export function sourceById(id: string): Source | undefined {
  return ALL_SOURCES.find((s) => s.id === id);
}
