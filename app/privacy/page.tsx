import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { contactEmail } from '@/lib/config';

export const metadata: Metadata = { title: 'Privacy', description: 'Radar has no accounts and no tracking cookies. Your CV never leaves your device.' };

export default function PrivacyPage() {
  const email = contactEmail();
  const items: [string, string][] = [
    ['No accounts', 'There is nothing to sign up for. Radar does not know who you are.'],
    ['No tracking cookies', 'Radar sets no cookies. Your theme choice and the jobs you have already opened are kept in your own browser storage, and you can clear them any time.'],
    ['Your CV stays on your device', 'If you use CV match, the file is read in your browser. Only a list of numbers (a summary vector) and the skills you confirm are sent to rank jobs. The CV text is never uploaded or stored.'],
    ['What the server logs', 'Like any website, the host keeps standard access logs (address, page, time, browser) for security and to fix errors. We do not sell or share them.'],
    ['Leaving Radar', 'When you click "View on…", you go to the original job site. Its own privacy policy applies there.'],
  ];
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[720px] px-5 pb-24 pt-8 text-[16px] leading-[1.65] sm:px-10 sm:pt-14">
        <h1 className="m-0 text-[34px] font-[650] tracking-[-0.04em] sm:text-[44px]">Privacy</h1>
        <p className="mt-4 text-[18px] text-ink-2">Short and true.</p>
        <dl className="mt-8 flex flex-col gap-6">
          {items.map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold">{t}</dt>
              <dd className="m-0 mt-1 text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
        {email && (
          <p className="mt-10 text-[15px] text-muted">
            Questions: <a href={`mailto:${email}`} className="underline underline-offset-2">{email}</a>
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
