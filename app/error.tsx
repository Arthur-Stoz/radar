'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-5 text-center">
      <p className="m-0 font-mono text-[15px] text-muted">Error</p>
      <h1 className="mt-3 text-[34px] font-[650] leading-[1.05] tracking-[-0.045em] sm:text-[44px]">Something went off the radar.</h1>
      <p className="mt-4 text-[17px] leading-[1.5] text-muted">It’s on our side, not yours. Try again in a moment.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="h-11 rounded-full bg-ink px-6 text-[15px] font-[550] text-on-ink">
          Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-surface px-6 text-[15px]">
          Home
        </Link>
      </div>
    </main>
  );
}
