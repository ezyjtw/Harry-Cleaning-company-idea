'use client';

import { useEffect } from 'react';

// Toggles a body class on mount so CSS can hide the global #layout-nav /
// #layout-footer for surfaces that bring their own chrome (the cleaner portal,
// via bodyClass="portal-active"). Visual-only — it changes nothing about routing.
export default function ChromeHider({ bodyClass }: { bodyClass: string }) {
  useEffect(() => {
    document.body.classList.add(bodyClass);
    return () => document.body.classList.remove(bodyClass);
  }, [bodyClass]);
  return null;
}
