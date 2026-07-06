import type { NotificationType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import {
  categoryForType,
  shouldSend,
  type NotificationCategory,
} from '@/lib/services/notification-preferences.service';

// ─── Types ──────────────────────────────────────────────────────

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'EXPO_PUSH';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  channels?: NotificationChannel[];
  // A11: preference category. Defaults from the type map; pass explicitly when a
  // shared type is used for a toggleable message (e.g. a reminder on BOOKING_REQUEST).
  category?: NotificationCategory;
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
    const category = payload.category ?? categoryForType(payload.type);

    // In-app notification (the bell) is intrinsic and always written.
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ? (payload.data as Prisma.InputJsonValue) : undefined,
      },
    });

    // A11: every outbound channel consults the preference gate. Essential
    // transactional messages pass through unconditionally; toggleable/marketing
    // respect the user's choice (and channel master switches).
    const [allowPush, allowEmail, allowSms, allowExpo] = await Promise.all([
      channels.includes('PUSH') ? shouldSend(payload.userId, category, 'PUSH') : false,
      channels.includes('EMAIL') ? shouldSend(payload.userId, category, 'EMAIL') : false,
      channels.includes('SMS') ? shouldSend(payload.userId, category, 'SMS') : false,
      // EXPO_PUSH is opt-in per call (never in the default channels), so existing
      // web sends are unaffected. Gated on the push master switch (ESSENTIAL
      // always passes). Even when allowed, queueExpoPush is a no-op when the user
      // has no registered device tokens.
      channels.includes('EXPO_PUSH') ? shouldSend(payload.userId, category, 'EXPO_PUSH') : false,
    ]);

    // Deliver to each permitted channel
    const deliveryPromises: Promise<void>[] = [];

    if (allowPush) {
      deliveryPromises.push(this.queuePushNotification(payload));
    }
    if (allowEmail) {
      deliveryPromises.push(this.queueEmailNotification(payload));
    }
    if (allowSms) {
      deliveryPromises.push(this.queueSMSNotification(payload));
    }
    if (allowExpo) {
      deliveryPromises.push(this.queueExpoPush(payload));
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
   * Send the Rena Pro NEW-OFFER push to a cleaner. Category ESSENTIAL — never
   * suppressible by preference toggles (standing ruling); only logout stops it.
   * Delivers IN_APP + EXPO_PUSH; the payload deep-links to /app/offer/[id].
   *
   * ⚠️ DORMANT — not called anywhere yet. Wiring the cascade offer to call this
   * is HELD until the P1 build is signed off (so no offer push can fire before
   * the app exists to receive it).
   */
  static async sendNewOfferPush(bookingId: string, cleanerId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    await this.send({
      userId: cleanerId,
      type: 'BOOKING_REQUEST',
      title: 'New job offer',
      body: `${booking.serviceType} · £${Number(booking.cleanerEarnings).toFixed(2)} · ${new Date(booking.date).toLocaleDateString('en-GB')} at ${booking.startTime}`,
      data: { bookingId, url: `/app/offer/${bookingId}` },
      category: 'ESSENTIAL',
      channels: ['IN_APP', 'EXPO_PUSH'],
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
      // Toggleable: BOOKING_REQUEST would otherwise default to ESSENTIAL.
      category: 'REMINDER',
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
      // Toggleable review nudge (NEW_REVIEW already maps to REMINDER; explicit for clarity).
      category: 'REMINDER',
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
   * Queue a native (Rena Pro / Expo) push. NO-OP when the user has no registered
   * device tokens — so this changes nothing for web-only users. Enqueues one
   * EXPO_PUSH background job carrying the user's tokens; the job handler sends via
   * the Expo push API.
   */
  private static async queueExpoPush(payload: NotificationPayload) {
    try {
      const tokens = await prisma.deviceToken.findMany({
        where: { userId: payload.userId },
        select: { expoPushToken: true },
      });
      if (tokens.length === 0) return; // no devices → nothing to do

      await prisma.backgroundJob.create({
        data: {
          type: 'EXPO_PUSH',
          payload: {
            tokens: tokens.map((t) => t.expoPushToken),
            title: payload.title,
            body: payload.body,
            data: payload.data,
          } as Prisma.InputJsonValue,
          scheduledAt: new Date(),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.error('[Notification] Failed to queue Expo push');
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
