'use client';

import { forwardRef } from 'react';
import type { CardJob } from '@/lib/search';
import { ago, gradient, hueOf, payLabel } from '@/lib/format';
import { Badge, badgesFor } from './Badges';
import { workTypeText } from './JobPreview';

export interface CardProps {
  job: CardJob;
  selected: boolean;
  seen: boolean;
  onSelect: () => void;
  matchPill?: number | null;
}

export const JobCard = forwardRef<HTMLAnchorElement, CardProps>(function JobCard({ job, selected, seen, onSelect, matchPill }, ref) {
  const pay = payLabel(job);
  const badges = badgesFor(job, 2);
  const name = job.company || job.title;
  return (
    <a
      ref={ref}
      href={`/job/${job.id}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        onSelect();
      }}
      aria-current={selected ? 'true' : undefined}
      data-job-id={job.id}
      className={`group relative flex gap-4 rounded-[20px] p-4 transition-[background,opacity,box-shadow] duration-150 sm:p-5 ${
        selected ? 'bg-surface' : 'hover:bg-surface'
      } ${seen && !selected ? 'opacity-[.62] hover:opacity-100' : ''}`}
      style={selected ? { boxShadow: 'inset 0 0 0 1.5px var(--ink)' } : undefined}
    >
      <div
        aria-hidden="true"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-[18px] font-[650] tracking-[-0.04em] text-[#0B0B0A] sm:h-12 sm:w-12"
        style={{ background: gradient(hueOf(name)) }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 line-clamp-2 min-w-0 text-[16px] font-semibold leading-[1.3] tracking-[-0.015em]">{job.title}</h3>
          {matchPill != null ? (
            <span className="flex-none rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
              {matchPill}% match
            </span>
          ) : (
            pay && <span className="flex-none whitespace-nowrap font-mono text-[13.5px] font-medium tracking-[-0.02em]">{pay}</span>
          )}
        </div>
        <p className="m-0 truncate text-[14px] text-muted">{[job.company, job.location].filter(Boolean).join(' · ')}</p>
        {matchPill != null && pay && <p className="m-0 font-mono text-[13px]">{pay}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <Badge key={b.label} {...b} />
          ))}
          {job.workTypes.length > 0 && <span className="text-[12.5px] text-muted">{workTypeText(job.workTypes.slice(0, 2))}</span>}
        </div>
        <p className="m-0 mt-1 text-[12.5px] text-muted" suppressHydrationWarning>
          {ago(job.postedAt)} · {job.sourceName}
          {job.alsoOn.length > 0 && ` +${job.alsoOn.length}`}
        </p>
      </div>
    </a>
  );
});
