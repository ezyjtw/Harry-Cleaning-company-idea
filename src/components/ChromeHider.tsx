'use client';

import { useEffect } from 'react';

// Generalized form of the homepage's LayoutHider: toggles a body class on mount
// so CSS can hide the global #layout-nav / #layout-footer for surfaces that
// bring their own chrome (the homepage, and now the cleaner portal). Visual-only
// — it changes nothing about routing.
export default function ChromeHider({ bodyClass }: { bodyClass: string }) {
  useEffect(() => {
    document.body.classList.add(bodyClass);
    return () => document.body.classList.remove(bodyClass);
  }, [bodyClass]);
  return null;
}
