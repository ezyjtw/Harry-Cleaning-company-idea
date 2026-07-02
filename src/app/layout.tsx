import type { Metadata, Viewport } from 'next';
import { Newsreader, Jost } from 'next/font/google';

import './globals.css';

// Fonts loaded here (root layout) and self-hosted by next/font, exposed as CSS
// variables. The .variable classes are applied to <html> in [locale]/layout.tsx
// (that layout renders the html element). Weights match the spec: Newsreader
// 500/600 (serif/headings), Jost 400/500/600 (sans/body). Etna stays as a local
// @font-face (wordmark only) and is untouched.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});

/** Font CSS-variable classes, applied to <html> by the locale layout. */
export const fontVariables = `${newsreader.variable} ${jost.variable}`;

export const metadata: Metadata = {
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rena',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
