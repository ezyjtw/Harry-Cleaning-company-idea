'use client';

// W2 (James-ruled): the Inbox bell rides EVERY L2 screen's header, not just
// Today's — with an unread dot from the same envelope the inbox itself reads.
// The five-tab bar is untouched; this is the header's sixth door.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

export default function InboxBell({ className }: { className?: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (alive && typeof data?.unreadCount === 'number') setUnread(data.unreadCount);
      } catch {
        /* fail-soft — the bell still opens the inbox */
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  return (
    <Link
      href="/app/inbox"
      aria-label={unread > 0 ? `Inbox — ${unread} unread` : 'Inbox'}
      onClick={() => haptic('light')}
      className={`relative shrink-0 rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page ${className || ''}`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {unread > 0 && (
        <span
          data-testid="inbox-bell-dot"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface"
        />
      )}
    </Link>
  );
}
