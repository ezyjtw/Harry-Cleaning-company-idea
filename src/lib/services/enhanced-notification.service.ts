import type { NotificationType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class EnhancedNotificationService {
  /**
   * Create and deliver a notification
   */
  static async send(payload: NotificationPayload) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ? (payload.data as Prisma.InputJsonValue) : undefined,
      },
    });

    // Queue push notification if user has enabled them
    // This would integrate with web push or FCM
    await this.queuePushNotification(payload);

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
    if (!booking) return;

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
    if (!booking) return;

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
    if (!booking) return;

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
    if (!booking) return;

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
   * Queue a push notification (placeholder for web push integration)
   */
  private static async queuePushNotification(payload: NotificationPayload) {
    // Queue as background job for actual push delivery
    try {
      await prisma.backgroundJob.create({
        data: {
          type: 'SEND_EMAIL',
          payload: {
            action: 'PUSH_NOTIFICATION',
            userId: payload.userId,
            title: payload.title,
            body: payload.body,
          } as Prisma.InputJsonValue,
          scheduledAt: new Date(),
        },
      });
    } catch {
      // Non-critical: log but don't fail
      // eslint-disable-next-line no-console
      console.error('[Notification] Failed to queue push notification');
    }
  }
}
