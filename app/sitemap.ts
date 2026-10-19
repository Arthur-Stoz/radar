import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/config';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const store = getStore();
  const pages: MetadataRoute.Sitemap = ['', '/search', '/about', '/privacy', '/status'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'daily' }));
  if (!store) return pages;
  const titles = store.vocab.filter((v) => v.kind === 'title').slice(0, 300);
  const jobs = store.db.prepare('SELECT id, last_seen AS lastSeen FROM jobs ORDER BY posted_ts DESC LIMIT 20000').all() as { id: string; lastSeen: string }[];
  return [
    ...pages,
    ...titles.map((t) => ({ url: `${base}/search?q=${encodeURIComponent(t.display)}`, changeFrequency: 'daily' as const })),
    ...jobs.map((j) => ({ url: `${base}/job/${j.id}`, lastModified: j.lastSeen })),
  ];
}
