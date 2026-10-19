import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Status', description: 'Each source Radar reads, when it last updated and how many live jobs it has.' };

interface Row {
  id: string;
  name: string;
  homepage: string;
  kind: string;
  enabled: number;
  status: string;
  message: string | null;
  last_success_at: string | null;
  active_jobs: number;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

const STATE: Record<string, { label: string; color: string }> = {
  ok: { label: 'Normal', color: 'var(--accent)' },
  partial: { label: 'Some errors', color: '#9FE5C7' },
  failed: { label: 'Down', color: 'var(--ink)' },
  disabled: { label: 'Off', color: 'var(--line-strong)' },
};

export default function StatusPage() {
  const store = getStore();
  const rows = store ? (store.db.prepare('SELECT * FROM sources_status ORDER BY enabled DESC, active_jobs DESC, name').all() as Row[]) : [];
  const live = rows.filter((r) => r.enabled);
  const normal = live.filter((r) => r.status === 'ok' || r.status === 'partial').length;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[960px] px-5 pb-24 pt-8 sm:px-10 sm:pt-14">
        <h1 className="m-0 text-[34px] font-[650] tracking-[-0.04em] sm:text-[44px]">Status</h1>
        {store ? (
          <p className="mt-2 text-[15px] text-muted">
            {normal} of {live.length} sources normal · {store.total.toLocaleString('en-NZ')} live jobs · database built {fmt(store.builtAt)} (NZ time)
          </p>
        ) : (
          <p className="mt-2 text-[15px] text-muted">Loading jobs… the database is being downloaded.</p>
        )}

        <div className="mt-8 overflow-x-auto rounded-[20px] border border-line">
          <table className="w-full min-w-[620px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="px-5 py-3 font-normal">Source</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal">Last successful update</th>
                <th className="px-5 py-3 text-right font-normal">Live jobs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATE[r.status] || STATE.ok;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <a href={r.homepage} target="_blank" rel="noopener" className="font-medium hover:underline">
                        {r.name}
                      </a>
                      {r.kind === 'ats' && <span className="ml-2 text-[12px] text-muted">company career pages</span>}
                      {r.message && <p className="m-0 mt-0.5 text-[12.5px] text-muted">{r.message}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} aria-hidden="true" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">{r.enabled ? fmt(r.last_success_at) : '—'}</td>
                    <td className="px-5 py-4 text-right font-mono">{r.active_jobs.toLocaleString('en-NZ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-[640px] text-[14px] leading-[1.6] text-muted">
          Radar refreshes every 4 hours. When a source is down, Radar keeps showing jobs from the others, and jobs already found stay up until they close. Sources marked
          Off are not collected; <Link href="/about" className="underline underline-offset-2">About</Link> explains why.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
