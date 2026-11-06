import localFont from 'next/font/local';

// next/font setup lives here (not in a layout file) — a Next layout may only
// export the reserved fields (metadata, viewport, default, etc.), so a
// `fontVariables` export from layout.tsx breaks the layout type contract.
//
// Weights match the design spec: Newsreader 500/600 (serif/headings),
// Jost 400/500/600 (sans/body). Etna stays a local @font-face (wordmark only)
// and is untouched.
//
// RENA-083 (B6.6, James-ruled: OFL sources, licences committed): the files are
// committed under src/fonts (woff2 from @fontsource/newsreader and
// @fontsource/jost 5.2.8, each folder with its OFL.txt), so a build never
// reaches Google. Google served each family in unicode-range subsets (latin,
// latin-ext, and cyrillic for Jost, vietnamese for Newsreader); each subset is
// its own local family here, and globals.css chains them into --font-jost and
// --font-newsreader in the same order, so every character renders in the face
// it did before. Only the last family in each chain carries the fallbacks.
// next/font requires literal options, hence the repetition.

const jostLatin = localFont({
  src: [
    { path: '../fonts/jost/jost-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/jost/jost-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/jost/jost-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jost-latin',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  adjustFontFallback: false,
  fallback: [],
});

const jostLatinExt = localFont({
  src: [
    { path: '../fonts/jost/jost-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/jost/jost-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/jost/jost-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jost-latin-ext',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  adjustFontFallback: false,
  fallback: [],
});

const jostCyrillic = localFont({
  src: [
    { path: '../fonts/jost/jost-cyrillic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/jost/jost-cyrillic-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/jost/jost-cyrillic-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jost-cyrillic',
  display: 'swap',
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
  adjustFontFallback: false,
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

const newsreaderLatin = localFont({
  src: [
    {
      path: '../fonts/newsreader/newsreader-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-500-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-newsreader-latin',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  adjustFontFallback: false,
  fallback: [],
});

const newsreaderLatinExt = localFont({
  src: [
    {
      path: '../fonts/newsreader/newsreader-latin-ext-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-ext-500-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-ext-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-latin-ext-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-newsreader-latin-ext',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  adjustFontFallback: false,
  fallback: [],
});

const newsreaderVietnamese = localFont({
  src: [
    {
      path: '../fonts/newsreader/newsreader-vietnamese-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-vietnamese-500-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../fonts/newsreader/newsreader-vietnamese-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader/newsreader-vietnamese-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-newsreader-vietnamese',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    },
  ],
  adjustFontFallback: false,
  fallback: ['Georgia', 'serif'],
});

/** Font CSS-variable classes, applied to <html> by the locale layout. */
export const fontVariables = [
  jostLatin.variable,
  jostLatinExt.variable,
  jostCyrillic.variable,
  newsreaderLatin.variable,
  newsreaderLatinExt.variable,
  newsreaderVietnamese.variable,
].join(' ');
