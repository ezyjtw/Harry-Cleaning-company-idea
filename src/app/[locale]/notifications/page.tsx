'use client';

// F10: the REAL notification history — replaces the previous mock feed
// (hard-coded "Sarah M." demo rows). Reads the same API as the bell (and the
// future native /app/inbox): GET /api/notifications, per-item mark-as-read on
// tap, mark-all affordance. Deep links via the shared notification-links map.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState(false);

  const load = useCallback(async (take: number) => {
    setError(false);
    try {
      const res = await fetch(`/api/notifications?limit=${take}`);
      if (res.status === 401) {
        window.location.href = '/login?callbackUrl=/notifications';
        return;
      }
      if (!res.ok) throw new Error();
      const d = await res.json();
      setItems(d.notifications ?? []);
      setUnread(d.unreadCount ?? 0);
    } catch {
      setError(true);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load(limit);
    fetch('/api/auth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.user?.role ?? d?.role ?? null))
      .catch(() => {});
  }, [load, limit]);

  const openItem = (n: NotificationItem) => {
    if (!n.read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => {});
    }
    router.push(notificationHref(n, role));
  };

  const markAll = () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setUnread(0);
    fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-newsreader text-3xl font-semibold text-ink">Notifications</h1>
          <p className="mt-1 font-jost text-sm text-ink-3">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            className="rounded-[10px] border border-line bg-surface px-3 py-1.5 font-jost text-[13px] font-medium text-ink-2 hover:bg-page"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {items === null && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-line" />
            ))}
          </div>
        )}
        {items !== null && error && (
          <div className="p-8 text-center">
            <p className="font-jost text-sm text-ink-2">Couldn&apos;t load your notifications.</p>
            <button
              type="button"
              onClick={() => load(limit)}
              className="mt-3 rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}
        {items !== null && !error && items.length === 0 && (
          <p className="p-10 text-center font-jost text-sm text-ink-3">
            Nothing yet — booking updates, offers, and messages land here.
          </p>
        )}
        {items?.map((n) => {
          const offer = isOfferNotification(n);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={`block w-full border-b border-line px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-page ${
                offer && !n.read ? 'border-l-2 border-l-primary bg-primary-soft/40' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {!n.read ? (
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${offer ? 'bg-primary' : 'bg-danger'}`}
                  />
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0" />
                )}
                <div className={`min-w-0 ${n.read ? 'opacity-60' : ''}`}>
                  <p className="font-jost text-[14px] font-semibold text-ink">
                    {offer && (
                      <span className="mr-1.5 rounded bg-primary px-1.5 py-0.5 font-jost text-[10px] font-bold uppercase tracking-wide text-white">
                        Job offer
                      </span>
                    )}
                    {n.title}
                  </p>
                  <p className="mt-0.5 font-jost text-[13px] text-ink-2">{n.body}</p>
                  <p className="mt-1 font-jost text-[11px] text-ink-3">{formatWhen(n.createdAt)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {items && items.length >= limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          className="mt-4 w-full rounded-[10px] border border-line bg-surface px-4 py-2.5 font-jost text-sm font-medium text-ink-2 hover:bg-page"
        >
          Load more
        </button>
      )}
    </div>
  );
}
