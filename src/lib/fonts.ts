import { Newsreader, Jost } from 'next/font/google';

// next/font setup lives here (not in a layout file) — a Next layout may only
// export the reserved fields (metadata, viewport, default, etc.), so a
// `fontVariables` export from layout.tsx breaks the layout type contract.
//
// Weights match the design spec: Newsreader 500/600 (serif/headings),
// Jost 400/500/600 (sans/body). Both are self-hosted by next/font and exposed as
// CSS variables applied to <html> in [locale]/layout.tsx. Etna stays a local
// @font-face (wordmark only) and is untouched.

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
  // Next 14.2's metrics table has no Newsreader entry, so its automatic
  // size-adjust fallback can't be computed. Disable it and give an explicit
  // serif fallback chain instead.
  adjustFontFallback: false,
  fallback: ['Georgia', 'serif'],
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

/** Font CSS-variable classes, applied to <html> by the locale layout. */
export const fontVariables = `${newsreader.variable} ${jost.variable}`;
