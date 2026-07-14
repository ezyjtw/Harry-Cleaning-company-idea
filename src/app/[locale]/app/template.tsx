'use client';

import { useEffect, useRef } from 'react';

// C6: a 150ms fade on every /app route change. template.tsx remounts on each
// navigation within /app, so the fade plays per-route. This directory is served
// only to the native shell (layout gate) — no shared web page is affected. Web
// Animations API, so no global CSS is touched; if it's unavailable the page
// simply renders at full opacity.
export default function AppRouteFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
      duration: 150,
      easing: 'ease-out',
    });
  }, []);
  return <div ref={ref}>{children}</div>;
}
