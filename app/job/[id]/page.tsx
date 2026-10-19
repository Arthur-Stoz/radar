import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { JobPreview } from '@/components/JobPreview';
import { JobCardStatic } from '@/components/JobCardStatic';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getStore } from '@/lib/db';
import { payLabel } from '@/lib/format';
import { aliasOf, getExpired, getJob, similarJobs } from '@/lib/jobs';
import { siteUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    const old = getExpired(id);
    return { title: old ? `${old.title} (closed)` : 'Job not found', robots: { index: false } };
  }
  const pay = payLabel(job);
  const title = `${job.title}${job.company ? ` at ${job.company}` : ''} · ${job.location}`;
  const description = [pay, job.summary].filter(Boolean).join(' · ').slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/job/${job.id}` },
    openGraph: { title, description, type: 'article', url: `${siteUrl()}/job/${job.id}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const job = getJob(id);
  const store = getStore();

  if (!job) {
    const canonical = aliasOf(id);
    if (canonical) redirect(`/job/${canonical}`);
    const old = getExpired(id);
    if (!old && store) notFound();
    const similar = old ? similarJobs({ title: old.title, city: old.city, regionId: old.regionId, excludeId: id }) : [];
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[880px] px-5 pb-24 pt-10 sm:px-10">
          <div className="rounded-[20px] bg-surface p-6 sm:p-8">
            <h1 className="m-0 text-[26px] font-[650] tracking-[-0.035em] sm:text-[32px]">{old ? 'This job has closed.' : store ? 'We can’t find this job.' : 'Loading jobs…'}</h1>
            <p className="mb-0 mt-2 text-[16px] text-muted">
              {old
                ? `${old.title}${old.company ? ` at ${old.company}` : ''} is no longer listed on ${old.sourceName}. Here are similar jobs still open.`
                : 'It may have been taken down by the employer. Try a search instead.'}
            </p>
            <Link href={old ? `/search?q=${encodeURIComponent(old.title)}` : '/search'} className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-on-ink">
              {old ? 'See similar jobs' : 'Search jobs'}
            </Link>
          </div>
          {similar.length > 0 && (
            <section className="mt-10" aria-labelledby="similar-h">
              <h2 id="similar-h" className="mb-3 text-[22px] font-[650] tracking-[-0.03em]">
                Still open
              </h2>
              <div className="flex flex-col gap-1">
                {similar.map((j) => (
                  <JobCardStatic key={j.id} job={j} />
                ))}
              </div>
            </section>
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  const similar = similarJobs({ title: job.title, city: job.city, regionId: null, excludeId: job.id, limit: 4 });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[880px] px-5 pb-24 pt-6 sm:px-10 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-[14px] text-muted">
          <Link href="/search" className="hover:text-ink">
            Jobs
          </Link>
          {job.region && (
            <>
              <span aria-hidden="true">›</span>
              <Link href={`/search?loc=${encodeURIComponent((job.region || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''))}`} className="hover:text-ink">
                {job.region}
              </Link>
            </>
          )}
          <span aria-hidden="true">›</span>
          <span className="truncate text-ink">{job.title}</span>
        </nav>
        <JobPreview job={job} full headingLevel={1} />
        {similar.length > 0 && (
          <section className="mt-14" aria-labelledby="similar-h">
            <h2 id="similar-h" className="mb-3 text-[22px] font-[650] tracking-[-0.03em]">
              Similar jobs
            </h2>
            <div className="flex flex-col gap-1">
              {similar.map((j) => (
                <JobCardStatic key={j.id} job={j} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
