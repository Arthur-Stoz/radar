import Link from 'next/link';
import type { CardJob } from '@/lib/search';
import { ago, gradient, hueOf, payLabel } from '@/lib/format';
import { Badge, badgesFor } from './Badges';

/** Link card for server-rendered lists (similar jobs, expired page). */
export function JobCardStatic({ job }: { job: CardJob }) {
  const pay = payLabel(job);
  const name = job.company || job.title;
  return (
    <Link href={`/job/${job.id}`} className="flex gap-4 rounded-[20px] p-4 transition-colors hover:bg-surface sm:p-5">
      <div aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-[18px] font-[650] text-[#0B0B0A]" style={{ background: gradient(hueOf(name)) }}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 line-clamp-2 text-[16px] font-semibold leading-[1.3] tracking-[-0.015em]">{job.title}</h3>
          {pay && <span className="flex-none whitespace-nowrap font-mono text-[13.5px] font-medium">{pay}</span>}
        </div>
        <p className="m-0 truncate text-[14px] text-muted">{[job.company, job.location].filter(Boolean).join(' · ')}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {badgesFor(job, 2).map((b) => (
            <Badge key={b.label} {...b} />
          ))}
          <span className="text-[12.5px] text-muted" suppressHydrationWarning>
            {ago(job.postedAt)} · {job.sourceName}
          </span>
        </div>
      </div>
    </Link>
  );
}
