import type { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
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

// ─── Service Functions ──────────────────────────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data || undefined,
    },
  });

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: (notification.data as Record<string, string>) || undefined,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function getNotifications(
  userId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedNotifications> {
  const where = { userId };
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, string>) || undefined,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function markAsRead(notificationId: string): Promise<Notification | null> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) return null;

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    type: updated.type,
    title: updated.title,
    body: updated.body,
    data: (updated.data as Record<string, string>) || undefined,
    read: updated.read,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
