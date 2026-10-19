import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { siteUrl } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Radar — Every job in New Zealand. One search.', template: '%s · Radar' },
  description:
    'Search every job in New Zealand in one place: Seek, Trade Me, Backpacker Board, PickNZ, government and company career pages. Free, no account.',
  openGraph: { siteName: 'Radar', type: 'website', locale: 'en_NZ' },
  
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0a' },
  ],
};

// Runs before paint: resolves the stored theme preference (light | dark | system).
const themeScript = `(function(){try{var p=localStorage.getItem('radar-theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');var r=p==='system'?(m.matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
