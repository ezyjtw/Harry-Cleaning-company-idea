import type { NotificationType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  channels?: NotificationChannel[];
}

export interface SMSConfig {
  to: string;
  body: string;
}

export interface PushConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export class EnhancedNotificationService {
  /**
   * Create and deliver a notification across multiple channels
   */
  static async send(payload: NotificationPayload) {
    const channels = payload.channels ?? ['IN_APP', 'PUSH'];

    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ? (payload.data as Prisma.InputJsonValue) : undefined,
      },
    });

    // Deliver to each requested channel
    const deliveryPromises: Promise<void>[] = [];

    if (channels.includes('PUSH')) {
      deliveryPromises.push(this.queuePushNotification(payload));
    }
    if (channels.includes('EMAIL')) {
      deliveryPromises.push(this.queueEmailNotification(payload));
    }
    if (channels.includes('SMS')) {
      deliveryPromises.push(this.queueSMSNotification(payload));
    }

    await Promise.allSettled(deliveryPromises);

    return notification;
  }

  /**
   * Send booking confirmation notification
   */
  static async sendBookingConfirmation(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { client: true, cleaner: true },
    });
    if (!booking || !booking.clientId || !booking.cleanerId) return;

    // Notify customer
    await this.send({
      userId: booking.clientId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking Confirmed',
      body: `Your ${booking.serviceType} cleaning on ${new Date(booking.date).toLocaleDateString('en-GB')} at ${booking.startTime} has been confirmed.`,
      data: { bookingId },
    });

    // Notify cleaner
    await this.send({
      userId: booking.cleanerId,
      type: 'BOOKING_CONFIRMED',
      title: 'New Booking Confirmed',
      body: `You have a new ${booking.serviceType} booking on ${new Date(booking.date).toLocaleDateString('en-GB')} at ${booking.startTime}.`,
      data: { bookingId },
    });
  }

  /**
   * Send booking reminder notification
   */
  static async sendBookingReminder(bookingId: string, recipientId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    await this.send({
      userId: recipientId,
      type: 'BOOKING_REQUEST',
      title: 'Upcoming Booking Reminder',
      body: `Reminder: You have a ${booking.serviceType} cleaning tomorrow at ${booking.startTime}.`,
      data: { bookingId },
    });
  }

  /**
   * Send cleaner arrival notification
   */
  static async sendArrivalAlert(bookingId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || !booking.clientId) return;

    await this.send({
      userId: booking.clientId,
      type: 'BOOKING_CONFIRMED',
      title: 'Cleaner En Route',
      body: 'Your cleaner is on the way! They should arrive shortly.',
      data: { bookingId },
    });
  }

  /**
   * Send job completion notification
   */
  static async sendJobCompletion(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { cleaner: true },
    });
    if (!booking || !booking.clientId) return;

    await this.send({
      userId: booking.clientId,
      type: 'BOOKING_COMPLETED',
      title: 'Cleaning Complete',
      body: `Your cleaning has been completed. Please take a moment to review ${booking.cleaner.name ?? 'your cleaner'}.`,
      data: { bookingId },
    });
  }

  /**
   * Send review request
   */
  static async sendReviewRequest(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { cleaner: true },
    });
    if (!booking || !booking.clientId) return;

    await this.send({
      userId: booking.clientId,
      type: 'NEW_REVIEW',
      title: 'How was your cleaning?',
      body: `Please leave a review for ${booking.cleaner.name ?? 'your cleaner'}. Your feedback helps other customers!`,
      data: { bookingId },
    });
  }

  /**
   * Get paginated notifications for a user
   */
  static async getNotifications(
    userId: string,
    options?: { page?: number; pageSize?: number; unreadOnly?: boolean }
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Record<string, unknown> = { userId };
    if (options?.unreadOnly) where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { notifications, total, unreadCount, page, pageSize, hasMore: page * pageSize < total };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string) {
    return prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  /**
   * Send booking-related notifications with appropriate channels
   */
  static async sendBookingNotification(
    bookingId: string,
    type: NotificationType,
    title: string,
    body: string,
    recipientId: string
  ) {
    return this.send({
      userId: recipientId,
      type,
      title,
      body,
      data: { bookingId },
      channels: ['IN_APP', 'PUSH', 'EMAIL'],
    });
  }

  /**
   * Send urgent notification (all channels including SMS)
   */
  static async sendUrgent(payload: Omit<NotificationPayload, 'channels'>) {
    return this.send({
      ...payload,
      channels: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'],
    });
  }

  /**
   * Queue a push notification for web push delivery
   */
  private static async queuePushNotification(payload: NotificationPayload) {
    try {
      await prisma.backgroundJob.create({
        data: {
          type: 'SEND_EMAIL',
          payload: {
            action: 'PUSH_NOTIFICATION',
            userId: payload.userId,
            title: payload.title,
            body: payload.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: payload.data,
          } as Prisma.InputJsonValue,
          scheduledAt: new Date(),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.error('[Notification] Failed to queue push notification');
    }
  }

  /**
   * Queue an email notification
   */
  private static async queueEmailNotification(payload: NotificationPayload) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true },
      });
      if (!user) return;

      await prisma.backgroundJob.create({
        data: {
          type: 'SEND_EMAIL',
          payload: {
            action: 'EMAIL_NOTIFICATION',
            to: user.email,
            recipientName: user.name ?? 'Customer',
            subject: payload.title,
            body: payload.body,
            type: payload.type,
            data: payload.data,
          } as Prisma.InputJsonValue,
          scheduledAt: new Date(),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.error('[Notification] Failed to queue email notification');
    }
  }

  /**
   * Queue an SMS notification
   */
  private static async queueSMSNotification(payload: NotificationPayload) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { phone: true },
      });
      if (!user?.phone) return;

      await prisma.backgroundJob.create({
        data: {
          type: 'SEND_SMS',
          payload: {
            action: 'SMS_NOTIFICATION',
            to: user.phone,
            body: `${payload.title}: ${payload.body}`,
            type: payload.type,
          } as Prisma.InputJsonValue,
          scheduledAt: new Date(),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.error('[Notification] Failed to queue SMS notification');
    }
  }
}
