import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="relative z-[3] flex h-16 items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-10">
      <Logo />
      {children}
      <div className="flex flex-none items-center gap-2 text-[13px] text-muted">
        <span className="hidden sm:inline">Free · No account</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
