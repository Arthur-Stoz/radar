import Link from 'next/link';
import { Logo } from './Logo';

export function SiteFooter() {
  return (
    <footer className="relative z-[1] overflow-hidden" style={{ background: 'var(--footer-bg)', color: '#fff' }}>
      <div className="flex flex-col justify-between gap-10 px-6 pt-14 sm:flex-row sm:items-start sm:px-10 lg:px-20 lg:pt-[72px]">
        <div className="flex max-w-[440px] flex-col gap-4">
          <Logo href={null} />
          <p className="m-0 text-sm leading-relaxed" style={{ color: 'var(--footer-muted)' }}>
            Radar links to jobs posted on other websites. Always apply on the original listing. Never pay to get a job.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col items-start gap-4 sm:items-end">
          <ul className="m-0 flex list-none gap-6 p-0 text-sm">
            <li><Link className="text-white/90 hover:text-white" href="/about">About</Link></li>
            <li><Link className="text-white/90 hover:text-white" href="/privacy">Privacy</Link></li>
            <li><Link className="text-white/90 hover:text-white" href="/status">Status</Link></li>
          </ul>
          <span className="text-[13px]" style={{ color: 'var(--footer-muted)' }}>© {new Date().getFullYear()} Radar</span>
        </nav>
      </div>
      <div aria-hidden="true" className="mt-10 flex h-[130px] justify-center overflow-hidden sm:h-[220px] lg:mt-14 lg:h-[330px]">
        <svg viewBox="0 0 1000 300" className="h-[160%] w-auto max-w-none select-none" role="presentation" focusable="false">
          <text x="500" y="285" textAnchor="middle" fontWeight="700" fontSize="395" letterSpacing="-29" fill="var(--footer-word)" style={{ fontFamily: 'var(--font-geist-sans)' }}>
            Radar
          </text>
        </svg>
      </div>
    </footer>
  );
}
