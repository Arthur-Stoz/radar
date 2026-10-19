import Link from 'next/link';
import { AutoRefresh } from '@/components/AutoRefresh';
import { CvDropZone } from '@/components/CvButton';
import { FreshRail } from '@/components/FreshRail';
import { LiveLine } from '@/components/LiveLine';
import { SearchBar } from '@/components/SearchBar';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getHomeData, sourcesSentence } from '@/lib/home';

export const dynamic = 'force-dynamic';

function Tile({ icon, from, to, rot }: { icon: string; from: string; to: string; rot: number }) {
  return (
    <span
      aria-hidden="true"
      className="mx-[0.02em] inline-flex h-[0.88em] w-[0.88em] items-center justify-center rounded-[0.23em] align-[-0.1em]"
      style={{ background: `linear-gradient(160deg,${from},${to})`, transform: `rotate(${rot}deg)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7), inset 0 0 0 1px rgba(0,0,0,.04)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/assets/icons/${icon}.webp`} alt="" width={64} height={64} className="h-[76%] w-[76%] object-contain" />
    </span>
  );
}

export default function Home() {
  const data = getHomeData();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative isolate z-0 flex flex-col items-center px-5 pb-20 pt-12 text-center sm:px-10 sm:pb-[136px] sm:pt-[96px]">
          <h1 className="m-0 text-[44px] font-[650] leading-[1.02] tracking-[-0.047em] sm:text-[64px] lg:text-[84px]">
            <span className="block">
              Every <Tile icon="coffee" from="#FCEEDC" to="#F1D5B1" rot={-7} /> job in
            </span>
            <span className="block">
              <Tile icon="kiwi" from="#ECF7DE" to="#CFE8B2" rot={6} /> New Zealand.
            </span>
            <span className="block">
              <Tile icon="mountain" from="#E8F1FC" to="#C8DCF4" rot={-4} /> One search.
            </span>
          </h1>
          <p className="mt-[26px] max-w-[560px] text-[17px] leading-[1.45] text-muted sm:text-[19px]" style={{ textWrap: 'balance' }}>
            {data && data.sources.length ? `${sourcesSentence(data.sources)}, all in one place.` : 'Every job board in New Zealand, all in one place.'}
          </p>

          <div className="relative mt-9 flex w-full justify-center sm:mt-11">
            <SearchBar variant="hero" />
          </div>

          {data ? (
            <>
              <div className="mt-[22px] flex max-w-[720px] flex-wrap justify-center gap-2">
                {data.quick.map((c) => (
                  <Link
                    key={c.label}
                    href={c.href}
                    className="inline-flex h-9 items-center rounded-full bg-surface px-[15px] text-[14px] text-ink-2 transition-[background,transform] duration-150 hover:bg-surface-2 active:scale-[.97]"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
              <LiveLine className="mt-[30px]" total={data.total} sources={data.sources.length} builtAt={data.builtAt} />
            </>
          ) : (
            <div className="mt-[30px] flex items-center gap-[9px] text-[13px] text-muted" role="status">
              <span className="pulse-dot" aria-hidden="true" />
              Loading jobs… this takes a few seconds the first time.
              <AutoRefresh seconds={5} />
            </div>
          )}
        </section>

        {data && data.fresh.length > 0 && <FreshRail jobs={data.fresh} />}

        {data && (
          <section className="relative z-[1] px-5 pb-24 sm:px-10 lg:px-20 lg:pb-[140px]" aria-labelledby="browse-h">
            <h2 id="browse-h" className="mb-5 text-[24px] font-[650] tracking-[-0.035em] sm:text-[30px]">
              Browse by type
            </h2>
            <div className="grid auto-rows-[188px] grid-cols-2 gap-3 sm:auto-rows-[236px] sm:gap-[14px] lg:grid-cols-4">
              {data.cats.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  aria-label={`${c.label}, ${c.count.toLocaleString('en-NZ')} jobs`}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface p-5 transition-[background,transform] duration-300 hover:-translate-y-0.5 hover:bg-surface-2 sm:px-[26px] sm:py-6 ${c.span === 2 ? 'col-span-2' : ''}`}
                >
                  <div className="relative z-[1]">
                    <div className="text-[19px] font-semibold tracking-[-0.03em] sm:text-[22px]">{c.label}</div>
                    <div className="mt-[5px] font-mono text-[13px] text-muted">{c.count.toLocaleString('en-NZ')} jobs</div>
                  </div>
                  <div className="relative z-[1] text-[13px] leading-[1.4] text-muted sm:text-[14px]" style={{ maxWidth: c.span === 2 ? '46%' : '52%', textWrap: 'pretty' }}>
                    {c.eg}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/assets/icons/${c.icon}.webp`}
                    alt=""
                    loading="lazy"
                    className="pointer-events-none absolute h-auto"
                    style={{
                      right: c.span === 2 ? '7%' : '8%',
                      bottom: c.span === 2 ? '10%' : '9%',
                      width: c.span === 2 ? 'clamp(96px, 12vw, 172px)' : 'clamp(72px, 9vw, 124px)',
                      transform: `rotate(${c.rot}deg)`,
                      filter: 'drop-shadow(0 16px 18px rgba(0,0,0,.10))',
                    }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <CvDropZone />
    </>
  );
}
