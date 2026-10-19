import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteFooter } from '@/components/SiteFooter';

export default function Home() {
  return (
    <>
      <header className="flex h-[72px] items-center justify-between px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3 text-[13px] text-muted">
          <span>Free · No account</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-col items-center px-6 py-24 text-center">
        <h1 className="m-0 text-5xl font-[650] tracking-[-0.047em] lg:text-[84px]">Every job in New Zealand. One search.</h1>
        <p className="mt-6 text-muted">Loading jobs…</p>
      </main>
      <SiteFooter />
    </>
  );
}
