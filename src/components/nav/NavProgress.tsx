'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { currentNavToken, subscribeNavProgress } from '@/lib/nav/nav-progress';

// H41: the slim top route-progress bar. A NavLink click fires
// startNavProgress() the instant its handler runs — this bar appears and
// creeps toward ~90% while the route resolves, then completes and fades when
// the pathname actually changes. Zero-latency feedback for the slow-route
// case; the NavLink hard-nav fallback remains the backstop for true stalls.

export default function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const tokenRef = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    return subscribeNavProgress(() => {
      const token = currentNavToken();
      if (token === tokenRef.current) return;
      tokenRef.current = token;
      clearTimers();
      setVisible(true);
      setProgress(8);
      // Creep toward 90% — never reaches 100 until the route lands.
      timers.current.push(window.setTimeout(() => setProgress(45), 80));
      timers.current.push(window.setTimeout(() => setProgress(70), 300));
      timers.current.push(window.setTimeout(() => setProgress(88), 800));
    });
  }, []);

  // Route actually changed → complete and fade.
  useEffect(() => {
    if (!visible) return;
    clearTimers();
    setProgress(100);
    const done = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    timers.current.push(done);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'rgb(var(--color-primary))',
          transition: 'width 0.25s ease-out, opacity 0.25s ease-out',
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: '0 0 8px rgba(var(--color-primary), 0.6)',
        }}
      />
    </div>
  );
}
