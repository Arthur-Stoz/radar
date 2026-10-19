'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import type { CardJob } from '@/lib/search';
import { agoLong, payLabel } from '@/lib/format';
import { TAG_LABELS, WORK_TYPE_LABELS, type WorkType } from '@/lib/tags';
import { Badge, SourceMark } from './Badges';

const noopSubscribe = () => () => {};

export function workTypeText(types: string[]): string {
  return types.map((t) => WORK_TYPE_LABELS[t as WorkType] || t).join(' · ');
}

/** Preview content shared by the desktop panel, the mobile sheet and /job/[id]. */
export function JobPreview({ job, full = false, headingLevel = 2 }: { job: CardJob & { description?: string }; full?: boolean; headingLevel?: 1 | 2 }) {
  const pay = payLabel(job);
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const text = full && job.description ? job.description : job.descriptionStart;
  const facts: [string, string][] = [];
  if (pay) facts.push(['Pay', pay + (job.payText && job.payText !== pay ? ` · “${job.payText}”` : '')]);
  else if (job.payText && /\$\s?\d/.test(job.payText)) facts.push(['Pay', job.payText]);
  if (job.workTypes.length) facts.push(['Type', workTypeText(job.workTypes)]);
  facts.push(['Where', job.isRemote && job.location !== 'Remote' ? `${job.location} · Remote OK` : job.location]);
  facts.push(['Posted', agoLong(job.postedAt)]);
  if (job.category) facts.push(['Category', job.category]);

  return (
    <article className="flex flex-col gap-5" aria-labelledby={`job-${job.id}-title`}>
      <header className="flex flex-col gap-2">
        <H id={`job-${job.id}-title`} className={`m-0 font-[650] leading-[1.15] tracking-[-0.035em] ${headingLevel === 1 ? 'text-[30px] sm:text-[40px]' : 'text-[24px] sm:text-[28px]'}`}>
          {job.title}
        </H>
        <p className="m-0 text-[16px] text-muted">{[job.company, job.location].filter(Boolean).join(' · ')}</p>
        {pay && (
          <p className="m-0 mt-1 font-mono text-[22px] font-medium tracking-[-0.03em]">
            {pay.replace(/\/h$/, '')}
            {pay.endsWith('/h') && <span className="ml-1 font-sans text-[14px] font-normal tracking-normal text-muted">/hour</span>}
          </p>
        )}
        {job.belowMinWage && (
          <p className="m-0 text-[13px] text-muted">
            <span aria-hidden="true">ⓘ</span> Check pay rate: the adult minimum wage is $23.95/h.
          </p>
        )}
        {job.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {job.tags.slice(0, 6).map((t) => (
              <Badge key={t} label={TAG_LABELS[t]} tone="plain" />
            ))}
          </div>
        )}
      </header>

      <ApplyButton job={job} />

      <dl className="m-0 grid grid-cols-[88px_1fr] gap-x-4 gap-y-2.5 rounded-[16px] bg-surface p-4 text-[14px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 min-w-0 break-words">{v}</dd>
          </div>
        ))}
        <dt className="text-muted">Source</dt>
        <dd className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <SourceMark source={job.source} name={job.sourceName} /> {job.sourceName}
          </span>
          {job.alsoOn.map((a) => (
            <a key={a.source} href={`/go/${job.id}?via=${encodeURIComponent(a.source)}`} target="_blank" rel="noopener" className="text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
              Also on {a.sourceName} ↗
            </a>
          ))}
        </dd>
      </dl>

      {job.summary && (
        <section>
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">In short</h3>
          <p className="m-0 text-[15px] leading-[1.6] text-ink-2">{job.summary}</p>
        </section>
      )}

      {job.highlights.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {job.highlights.map((h) => (
            <li key={h} className="flex gap-2.5 text-[15px] leading-[1.5]">
              <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      )}

      {text && (
        <section>
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">From the ad</h3>
          <p className="job-text m-0 text-[15px] leading-[1.65] text-ink-2">{text}</p>
          {!full && (
            <Link href={`/job/${job.id}`} className="mt-3 inline-block text-[14px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Read the full summary
            </Link>
          )}
        </section>
      )}

      <p className="m-0 border-t border-line pt-4 text-[13px] leading-[1.5] text-muted">
        Radar shows a summary. Apply on {job.sourceName}, where the employer posted this job. Never pay to get a job.
      </p>
    </article>
  );
}

export function ApplyButton({ job }: { job: CardJob }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => 'share' in navigator && window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
  const url = typeof window !== 'undefined' ? `${window.location.origin}/job/${job.id}` : `/job/${job.id}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/go/${job.id}`}
        target="_blank"
        rel="noopener"
        data-apply
        className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[16px] font-[550] tracking-[-0.01em] text-on-ink transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[.98] sm:flex-none"
      >
        View on {job.sourceName} <span aria-hidden="true">↗</span>
      </a>
      <button
        type="button"
        onClick={async () => {
          if (canShare) {
            try {
              await navigator.share({ title: job.title, text: `${job.title}${job.company ? ` at ${job.company}` : ''}`, url });
              return;
            } catch {}
          }
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {}
        }}
        className="inline-flex h-[52px] items-center gap-2 rounded-full bg-surface px-5 text-[15px] transition-colors hover:bg-surface-2"
        aria-live="polite"
      >
        {canShare ? 'Share' : copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}
