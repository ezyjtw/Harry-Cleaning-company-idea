'use client';

import { useEffect } from 'react';

export default function LayoutHider() {
  useEffect(() => {
    document.body.classList.add('homepage-active');
    return () => {
      document.body.classList.remove('homepage-active');
    };
  }, []);
  return null;
}
