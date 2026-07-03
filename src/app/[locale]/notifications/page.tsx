'use client';

import Link from 'next/link';
import { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────

type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'CLEANER_ASSIGNED'
  | 'PAYMENT_RECEIVED'
  | 'REVIEW_RECEIVED'
  | 'MESSAGE_RECEIVED'
  | 'DISPUTE_UPDATE';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ─── Mock Data ──────────────────────────────────────────────

const now = Date.now();

const allMockNotifications: Notification[] = [
  // Today
  {
    id: 'notif-1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Your cleaning with Sarah M. on March 18 at 10:00 AM has been confirmed. Your payment of £65.00 is being held securely until the job is complete.',
    read: false,
    createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-2',
    type: 'MESSAGE_RECEIVED',
    title: 'New message from Sarah M.',
    body: 'Hi! Just confirming I will bring my own cleaning products for the session. See you Tuesday!',
    read: false,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-3',
    type: 'PAYMENT_RECEIVED',
    title: 'Payment processed',
    body: 'Your payment of £85.00 is being held securely for booking #1042. The funds will be released to the cleaner once the job is completed.',
    read: false,
    createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
  },
  // Yesterday
  {
    id: 'notif-4',
    type: 'REVIEW_RECEIVED',
    title: 'New review received',
    body: 'Emma L. left you a 5-star review: "Absolutely spotless! The kitchen and bathrooms are gleaming. Will definitely book again."',
    read: true,
    createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-5',
    type: 'BOOKING_REMINDER',
    title: 'Upcoming booking tomorrow',
    body: 'Reminder: You have a deep cleaning session tomorrow at 2:00 PM with James T. at 42 Oak Lane, London.',
    read: true,
    createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
  },
  // Earlier
  {
    id: 'notif-6',
    type: 'CLEANER_ASSIGNED',
    title: 'Cleaner assigned',
    body: 'Maria G. has been assigned to your booking on March 20. She specializes in end-of-tenancy cleaning with 4.9 rating.',
    read: true,
    createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-7',
    type: 'BOOKING_CANCELLED',
    title: 'Booking cancelled',
    body: 'Your booking #1038 on March 12 has been cancelled. A full refund of £55.00 has been issued to your original payment method.',
    read: true,
    createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-8',
    type: 'DISPUTE_UPDATE',
    title: 'Dispute resolved',
    body: 'Your dispute for booking #1035 has been resolved in your favour. A partial refund of £40.00 has been issued.',
    read: true,
    createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-9',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Your regular weekly cleaning with Sarah M. is confirmed for every Tuesday at 10:00 AM starting March 11.',
    read: true,
    createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-10',
    type: 'MESSAGE_RECEIVED',
    title: 'New message from James T.',
    body: 'Thanks for the great review! I appreciate it and look forward to our next session.',
    read: true,
    createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Helpers ────────────────────────────────────────────────

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const nowDate = new Date();
  const diffMs = nowDate.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)} hours ago`;
  }
  return `${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== nowDate.getFullYear() ? 'numeric' : undefined,
  })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function getDateGroup(dateString: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const notifDate = new Date(date);
  notifDate.setHours(0, 0, 0, 0);

  if (notifDate.getTime() === today.getTime()) return 'Today';
  if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
}

function getNotificationIcon(type: NotificationType): React.ReactNode {
  const iconClass = 'h-5 w-5';

  // 8 notification types collapse onto 4 semantic tints:
  //   trust  = positive/success (confirmed, payment)
  //   danger = negative (cancelled, dispute)
  //   warning = time-sensitive/attention (reminder, review)
  //   primary = informational (cleaner assigned, message)
  const iconMap: Record<NotificationType, { bg: string; color: string; path: string }> = {
    BOOKING_CONFIRMED: {
      bg: 'bg-trust/10',
      color: 'text-trust',
      path: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    },
    BOOKING_CANCELLED: {
      bg: 'bg-danger/10',
      color: 'text-danger',
      path: 'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    },
    BOOKING_REMINDER: {
      bg: 'bg-warning/10',
      color: 'text-warning',
      path: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    },
    CLEANER_ASSIGNED: {
      bg: 'bg-primary-soft',
      color: 'text-primary',
      path: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    },
    PAYMENT_RECEIVED: {
      bg: 'bg-trust/10',
      color: 'text-trust',
      path: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
    },
    REVIEW_RECEIVED: {
      bg: 'bg-warning/10',
      color: 'text-warning',
      path: 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
    },
    MESSAGE_RECEIVED: {
      bg: 'bg-primary-soft',
      color: 'text-primary',
      path: 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z',
    },
    DISPUTE_UPDATE: {
      bg: 'bg-danger/10',
      color: 'text-danger',
      path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    },
  };

  const icon = iconMap[type];

  return (
    <div
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${icon.bg}`}
    >
      <svg
        className={`${iconClass} ${icon.color}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon.path} />
      </svg>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

const PAGE_SIZE = 5;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(allMockNotifications);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = visibleCount < notifications.length;

  // Group notifications by date
  const grouped: Record<string, Notification[]> = {};
  visibleNotifications.forEach((n) => {
    const group = getDateGroup(n.createdAt);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(n);
  });

  // Order groups
  const groupOrder: ('Today' | 'Yesterday' | 'Earlier')[] = ['Today', 'Yesterday', 'Earlier'];

  function handleMarkAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function handleMarkAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleLoadMore() {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, notifications.length));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-ink-3">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="self-start rounded-[10px] border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 transition hover:bg-page focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
          </div>
          <h2 className="font-newsreader text-xl font-semibold text-ink">No notifications</h2>
          <p className="mt-1 text-sm text-ink-3">You are all caught up!</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-primary transition hover:text-primary-hover"
          >
            Back to home
          </Link>
        </div>
      ) : (
        <>
          {/* Grouped notifications */}
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const items = grouped[group];
              if (!items || items.length === 0) return null;

              return (
                <div key={group}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {group}
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    <ul className="divide-y divide-line">
                      {items.map((notification) => (
                        <li
                          key={notification.id}
                          className={`relative flex gap-4 px-4 py-4 transition sm:px-6 ${
                            !notification.read ? 'bg-primary-soft/40' : 'bg-surface'
                          }`}
                        >
                          {/* Icon */}
                          <div className="pt-0.5">{getNotificationIcon(notification.type)}</div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm ${
                                  !notification.read
                                    ? 'font-semibold text-ink'
                                    : 'font-medium text-ink-2'
                                }`}
                              >
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="flex-shrink-0 rounded-[8px] px-2 py-0.5 text-xs font-medium text-primary transition hover:bg-primary-soft"
                                  title="Mark as read"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-ink-2">
                              {notification.body}
                            </p>
                            <p className="mt-2 text-xs text-ink-3">
                              {formatTimestamp(notification.createdAt)}
                            </p>
                          </div>

                          {/* Unread dot */}
                          {!notification.read && (
                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 sm:left-2">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                className="inline-flex items-center rounded-[10px] border border-line bg-surface px-6 py-2.5 text-sm font-medium text-ink-2 transition hover:bg-page focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                Load more notifications
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
