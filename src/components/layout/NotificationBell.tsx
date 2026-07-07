'use client';

// F10: the REAL notification bell — one implementation, three homes (marketing
// header for logged-in users, cleaner-portal shell, account shell), styled per
// home via `tone`. Replaces the previous mock (hard-coded demo data, imported
// nowhere). Reads the real Notification rows; badge polls cheaply; offer
// notifications (BOOKING_REQUEST) visually lead — they're money.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isOfferNotification, notificationHref } from '@/lib/notification-links';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: { bookingId?: string; url?: string } | null;
}

// Badge poll cadence: 60s. Reasoning: one COUNT-only query per signed-in user
// per minute (countOnly=1 skips the list read) — negligible DB cost at this
// scale, while a new job offer surfaces mid-session well inside its multi-
// minute cascade window. The full list loads only when the dropdown opens.
const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell({
  role,
  tone = 'light',
}: {
  role: string | null | undefined;
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pollBadge = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?countOnly=1');
      if (res.ok) {
        const d = await res.json();
        setUnread(d.unreadCount ?? 0);
      }
    } catch {
      /* badge poll is best-effort */
    }
  }, []);

  useEffect(() => {
    pollBadge();
    const t = setInterval(pollBadge, POLL_MS);
    return () => clearInterval(t);
  }, [pollBadge]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=8');
      if (res.ok) {
        const d = await res.json();
        setItems(d.notifications ?? []);
        setUnread(d.unreadCount ?? 0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const openItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => {});
    }
    router.push(notificationHref(n, role));
  };

  const markAll = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setUnread(0);
    fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  const dark = tone === 'dark';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-ink-2 hover:bg-page'
        }`}
      >
        <svg className="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-jost text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="font-jost text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="font-jost text-[12px] font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading && (
              <div className="space-y-2 p-4">
                <div className="h-10 animate-pulse rounded-lg bg-line" />
                <div className="h-10 animate-pulse rounded-lg bg-line" />
              </div>
            )}
            {!loading && items && items.length === 0 && (
              <p className="px-4 py-8 text-center font-jost text-sm text-ink-3">
                Nothing yet — booking updates and messages land here.
              </p>
            )}
            {!loading &&
              items?.map((n) => {
                const offer = isOfferNotification(n);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openItem(n)}
                    className={`block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-page ${
                      offer && !n.read ? 'border-l-2 border-l-primary bg-primary-soft/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${offer ? 'bg-primary' : 'bg-danger'}`}
                        />
                      )}
                      <div className={n.read ? 'opacity-60' : ''}>
                        <p className="font-jost text-[13px] font-semibold text-ink">
                          {offer && (
                            <span className="mr-1.5 rounded bg-primary px-1.5 py-0.5 font-jost text-[10px] font-bold uppercase tracking-wide text-white">
                              Job offer
                            </span>
                          )}
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 font-jost text-[12px] text-ink-2">
                          {n.body}
                        </p>
                        <p className="mt-0.5 font-jost text-[11px] text-ink-3">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center font-jost text-[13px] font-medium text-primary hover:bg-page"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
