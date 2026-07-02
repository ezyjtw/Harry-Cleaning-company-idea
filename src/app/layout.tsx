import type { Metadata, Viewport } from 'next';

import './globals.css';

// Fonts (Newsreader + Jost via next/font) are defined in src/lib/fonts.ts — NOT
// here. A Next layout may only export its reserved fields (metadata, viewport,
// default…); an extra `fontVariables` export breaks the layout type contract.
// The font CSS-variable classes are applied to <html> in [locale]/layout.tsx.

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
  themeColor: '#16296b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
