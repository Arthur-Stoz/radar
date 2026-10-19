import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { contactEmail } from '@/lib/config';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'About', description: 'What Radar is, how it works, where the jobs come from.' };

export default function AboutPage() {
  const store = getStore();
  const sources = store
    ? (store.db.prepare('SELECT name, homepage, enabled, message, active_jobs FROM sources_status ORDER BY enabled DESC, active_jobs DESC').all() as {
        name: string;
        homepage: string;
        enabled: number;
        message: string | null;
        active_jobs: number;
      }[])
    : [];
  const email = contactEmail();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-8 text-[16px] leading-[1.65] sm:px-10 sm:pt-14">
        <h1 className="m-0 text-[34px] font-[650] tracking-[-0.04em] sm:text-[44px]">About Radar</h1>
        <p className="mt-4 text-[18px] text-ink-2">Radar is a free search engine for every job in New Zealand. No account, no ads, no tracking. You search once, and Radar shows the best real listings from every board.</p>

        <h2 className="mb-3 mt-10 text-[22px] font-[650] tracking-[-0.03em]">How it works</h2>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {[
            ['Collect', 'Every 4 hours Radar reads the public listings of each source below, politely (at most one request per second).'],
            ['Search', 'Type what you want, in your own words. Radar understands places, pay, job types and common words in French, German and Spanish.'],
            ['Apply on the original', 'Every job links to the original ad. You always apply on the site where the employer posted it.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface font-mono text-[14px]">{i + 1}</span>
              <span>
                <strong className="font-semibold">{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mb-3 mt-10 text-[22px] font-[650] tracking-[-0.03em]">Sources</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
              <a href={s.homepage} target="_blank" rel="noopener" className="font-medium hover:underline">
                {s.name}
              </a>
              <span className="text-[14px] text-muted">{s.enabled ? `${s.active_jobs.toLocaleString('en-NZ')} live jobs` : s.message || 'Not collected'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[14px] text-muted">
          Job ads belong to their sources and employers. Radar shows a short summary and always links to the original. See <Link href="/status" className="underline underline-offset-2">Status</Link> for live numbers.
        </p>

        <h2 className="mb-3 mt-10 text-[22px] font-[650] tracking-[-0.03em]">Privacy</h2>
        <p className="m-0">
          No accounts and no tracking cookies. If you use the CV match, your CV is read on your device and never uploaded. <Link href="/privacy" className="underline underline-offset-2">Read the privacy note</Link>.
        </p>

        <h2 className="mb-3 mt-10 text-[22px] font-[650] tracking-[-0.03em]">Contact</h2>
        <p className="m-0">{email ? <a href={`mailto:${email}`} className="underline underline-offset-2">{email}</a> : 'A contact address will be listed here soon.'}</p>
      </main>
      <SiteFooter />
    </>
  );
}
