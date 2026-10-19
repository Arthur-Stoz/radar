import { ImageResponse } from 'next/og';
import { payLabel } from '@/lib/format';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Job on Radar';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  const pay = job ? payLabel(job) : null;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#FFFFFF', padding: '64px 72px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.05em', color: '#0B0B0A' }}>Radar</span>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: '#00C97A', marginTop: 14 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#0B0B0A', display: 'flex' }}>{job ? job.title.slice(0, 80) : 'Every job in New Zealand'}</div>
          <div style={{ fontSize: 32, color: '#6B6B6B', display: 'flex' }}>{job ? [job.company, job.location].filter(Boolean).join(' · ') : 'One search.'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {pay && <span style={{ fontSize: 30, background: '#F5F5F4', borderRadius: 999, padding: '10px 24px', color: '#0B0B0A' }}>{pay}</span>}
          {job && <span style={{ fontSize: 26, color: '#6B6B6B' }}>on {job.sourceName}</span>}
        </div>
      </div>
    ),
    size,
  );
}
