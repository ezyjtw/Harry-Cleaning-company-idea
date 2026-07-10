'use client';

// B4 (F10a in the shell): the L2 notification history. Reads the SAME envelope
// as the web bell ({notifications, unreadCount} + /api/notifications/read-all),
// app-shaped rows (offers lead with the navy treatment), deep links through
// appNotificationHref — /app/* URLs are native here (the web-fallback mapping
// inverts). Mark-as-read is unified with the web (same endpoints). Reached
// from the bell in the Today header.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';
import { appNotificationHref } from '@/lib/notification-links';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: { bookingId?: string; url?: string } | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AppInboxPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
    (window as unknown as { __renaRefresh?: () => void }).__renaRefresh = fetchInbox;
    return () => {
      delete (window as unknown as { __renaRefresh?: () => void }).__renaRefresh;
    };
  }, [fetchInbox]);

  const markAllRead = async () => {
    haptic('light');
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  const markOneRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch(`/api/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
  };

  if (!loading && loadError && items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-newsreader text-xl font-semibold text-ink">
          Couldn&apos;t load your inbox
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchInbox();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-newsreader text-[26px] font-semibold leading-tight text-ink">Inbox</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 font-jost text-[13px] text-ink-3">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="mt-1 rounded-full border border-line bg-surface px-3 py-1 font-jost text-[12px] font-medium text-ink-2 active:bg-page"
          >
            Mark all read
          </button>
        )}
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-line" />
          <div className="h-20 animate-pulse rounded-2xl bg-line" />
          <div className="h-20 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-jost text-sm text-ink-2">Nothing here yet — offers and updates land in this inbox.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const isOffer = n.type === 'BOOKING_REQUEST';
            return (
              <Link
                key={n.id}
                href={appNotificationHref(n, 'CLEANER')}
                onClick={() => {
                  haptic('light');
                  if (!n.read) markOneRead(n.id);
                }}
                className={
                  isOffer && !n.read
                    ? 'block rounded-2xl bg-primary p-4 text-white active:opacity-90'
                    : `block rounded-2xl border border-line p-4 active:bg-page ${
                        n.read ? 'bg-surface' : 'bg-primary-soft'
                      }`
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`font-jost text-sm font-semibold ${
                        isOffer && !n.read ? 'text-white' : 'text-ink'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p
                      className={`mt-0.5 font-jost text-[13px] ${
                        isOffer && !n.read ? 'text-white/80' : 'text-ink-2'
                      }`}
                    >
                      {n.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`font-jost text-[11px] ${
                        isOffer && !n.read ? 'text-white/60' : 'text-ink-3'
                      }`}
                    >
                      {timeAgo(n.createdAt)}
                    </span>
                    {!n.read && !isOffer && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
