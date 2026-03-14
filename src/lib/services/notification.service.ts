// ─── Notification Types ─────────────────────────────────────

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'CLEANER_ASSIGNED'
  | 'PAYMENT_RECEIVED'
  | 'REVIEW_RECEIVED'
  | 'MESSAGE_RECEIVED'
  | 'DISPUTE_UPDATE';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Mock Data ──────────────────────────────────────────────

const now = new Date();

function hoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Your cleaning with Sarah M. on March 18 at 10:00 AM has been confirmed.',
    data: { bookingId: 'booking-1', cleanerId: 'cleaner-1' },
    read: false,
    createdAt: hoursAgo(1),
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'MESSAGE_RECEIVED',
    title: 'New message from Sarah M.',
    body: 'Hi! Just confirming I will bring my own cleaning products for the session.',
    data: { conversationId: 'conv-1', senderId: 'cleaner-1' },
    read: false,
    createdAt: hoursAgo(2),
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'PAYMENT_RECEIVED',
    title: 'Payment processed',
    body: 'Your payment of £85.00 has been placed in escrow for booking #1042.',
    data: { bookingId: 'booking-2', amount: '85.00' },
    read: false,
    createdAt: hoursAgo(5),
  },
  {
    id: 'notif-4',
    userId: 'user-1',
    type: 'REVIEW_RECEIVED',
    title: 'New review received',
    body: 'Emma L. left you a 5-star review: "Absolutely spotless! Will book again."',
    data: { reviewId: 'review-1', cleanerId: 'cleaner-2' },
    read: true,
    createdAt: hoursAgo(24),
  },
  {
    id: 'notif-5',
    userId: 'user-1',
    type: 'BOOKING_REMINDER',
    title: 'Upcoming booking tomorrow',
    body: 'Reminder: You have a deep cleaning session tomorrow at 2:00 PM with James T.',
    data: { bookingId: 'booking-3' },
    read: true,
    createdAt: hoursAgo(26),
  },
  {
    id: 'notif-6',
    userId: 'user-1',
    type: 'CLEANER_ASSIGNED',
    title: 'Cleaner assigned',
    body: 'Maria G. has been assigned to your booking on March 20.',
    data: { bookingId: 'booking-4', cleanerId: 'cleaner-3' },
    read: true,
    createdAt: daysAgo(2),
  },
  {
    id: 'notif-7',
    userId: 'user-1',
    type: 'BOOKING_CANCELLED',
    title: 'Booking cancelled',
    body: 'Your booking #1038 on March 12 has been cancelled. A full refund has been issued.',
    data: { bookingId: 'booking-5' },
    read: true,
    createdAt: daysAgo(3),
  },
  {
    id: 'notif-8',
    userId: 'user-1',
    type: 'DISPUTE_UPDATE',
    title: 'Dispute resolved',
    body: 'Your dispute for booking #1035 has been resolved. A partial refund of £40.00 has been issued.',
    data: { disputeId: 'dispute-1', bookingId: 'booking-6' },
    read: true,
    createdAt: daysAgo(5),
  },
];

// ─── Service Functions ──────────────────────────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<Notification> {
  const notification: Notification = {
    id: `notif-${Date.now()}`,
    userId,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // In production, this would save to the database
  console.log('[Notification] Created:', notification.title);
  return notification;
}

export async function getNotifications(
  userId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedNotifications> {
  const userNotifications = mockNotifications.filter((n) => n.userId === userId);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginated = userNotifications.slice(start, end);

  return {
    notifications: paginated,
    total: userNotifications.length,
    page,
    pageSize,
    hasMore: end < userNotifications.length,
  };
}

export async function markAsRead(notificationId: string): Promise<Notification | null> {
  const notification = mockNotifications.find((n) => n.id === notificationId);
  if (!notification) return null;

  notification.read = true;
  console.log('[Notification] Marked as read:', notificationId);
  return notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  let count = 0;
  mockNotifications.forEach((n) => {
    if (n.userId === userId && !n.read) {
      n.read = true;
      count++;
    }
  });

  console.log(`[Notification] Marked ${count} notifications as read for user ${userId}`);
  return count;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return mockNotifications.filter((n) => n.userId === userId && !n.read).length;
}
