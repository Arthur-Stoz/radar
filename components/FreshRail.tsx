import Link from 'next/link';
import { RailArrows } from './RailArrows';
import type { CardJob } from '@/lib/search';
import { ago, gradient, hueOf, payLabel, placePhoto } from '@/lib/format';
import { Badge, badgesFor, SourceMark } from './Badges';

export function CompanyTile({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: gradient(hueOf(name)) }}>
      <div
        className="flex h-[62px] w-[62px] items-center justify-center rounded-[18px] text-[29px] font-[650] tracking-[-0.04em] text-[#0B0B0A]"
        style={{ background: 'rgba(255,255,255,.8)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 6px 18px rgba(0,0,0,.05)' }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    </div>
  );
}

export function FreshRail({ jobs }: { jobs: CardJob[] }) {
  return (
    <section className="relative z-[1] pb-20 lg:pb-28" aria-labelledby="fresh-h">
      <div className="mb-[18px] flex items-end justify-between gap-4 px-5 sm:px-10 lg:px-20">
        <div>
          <h2 id="fresh-h" className="m-0 text-[24px] font-[650] tracking-[-0.035em] sm:text-[30px]">
            Fresh today
          </h2>
          <p className="mt-1.5 text-[15px] text-muted">The newest listings across every source</p>
        </div>
        <RailArrows target="fresh-rail" />
      </div>
      <div id="fresh-rail" className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 pt-2 sm:scroll-px-10 sm:gap-5 sm:px-10 lg:scroll-px-20 lg:px-20">
        {jobs.map((j) => {
          const photo = placePhoto(j.city, j.suburb);
          const pay = payLabel(j);
          return (
            <Link
              key={j.id}
              href={`/job/${j.id}`}
              className="flex flex-[0_0_260px] snap-start flex-col gap-3 rounded-2xl outline-offset-4 transition-transform duration-300 hover:-translate-y-[3px] sm:flex-[0_0_300px]"
            >
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-[14px] bg-surface">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy" className="absolute inset-0 block h-full w-full object-cover" />
                ) : (
                  <CompanyTile name={j.company || j.title} className="absolute inset-0" />
                )}
                <div className="pointer-events-none absolute inset-0 rounded-[14px]" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }} />
              </div>
              <div className="flex flex-col gap-[5px] px-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="line-clamp-2 min-w-0 text-[16px] font-semibold leading-[1.3] tracking-[-0.015em]">{j.title}</span>
                  {pay && <span className="flex-none font-mono text-[13.5px] font-medium tracking-[-0.02em]">{pay}</span>}
                </div>
                <span className="truncate text-[14px] leading-[1.35] text-muted">{[j.company, j.location].filter(Boolean).join(' · ')}</span>
                <div className="mt-[5px] flex flex-wrap gap-[5px]">
                  {badgesFor(j, 2).map((b) => (
                    <Badge key={b.label} {...b} />
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-[7px] text-[12.5px] text-muted">
                  <SourceMark source={j.source} name={j.sourceName} />
                  <span>
                    on {j.sourceName} · {ago(j.postedAt)} ago
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
