'use client';

import dynamic from 'next/dynamic';

// Non-critical interactive bits load after the page is interactive.
const KeyboardHelp = dynamic(() => import('./KeyboardHelp').then((m) => m.KeyboardHelp), { ssr: false });
const CvDropZone = dynamic(() => import('./CvButton').then((m) => m.CvDropZone), { ssr: false });

export function LazyKeyboardHelp() {
  return <KeyboardHelp />;
}

export function LazyCvDropZone() {
  return <CvDropZone />;
}
