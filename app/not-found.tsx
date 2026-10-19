import type { Metadata } from 'next';
import Link from 'next/link';
import { RadarSweep } from '@/components/RadarSweep';
import { SearchBar } from '@/components/SearchBar';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative isolate flex min-h-[calc(100dvh-72px)] flex-col items-center overflow-hidden px-5 pt-20 text-center sm:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-[340px]">
          <RadarSweep on size={980} rings={[0.2, 0.4, 0.6, 0.8, 1]} blips={false} sweepSeconds={9} />
        </div>
        <p className="m-0 font-mono text-[15px] text-muted">404</p>
        <h1 className="mt-3 text-[36px] font-[650] leading-[1.05] tracking-[-0.045em] sm:text-[56px]">This page went off the radar.</h1>
        <p className="mt-4 max-w-[460px] text-[17px] leading-[1.5] text-muted">The link may be old, or the job was taken down. Try a search instead.</p>
        <div className="mt-8 flex w-full justify-center">
          <div className="w-full max-w-[560px]">
            <SearchBar variant="compact" />
          </div>
        </div>
        <Link href="/" className="mt-6 text-[14px] underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Back to the home page
        </Link>
      </main>
    </>
  );
}
