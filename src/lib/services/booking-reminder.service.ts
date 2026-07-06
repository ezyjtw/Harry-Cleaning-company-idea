import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import {
  sendBookingReminder,
  sendCleanerReminder,
  sendReviewRequest,
} from '@/lib/services/email.service';

export interface ReminderSchedule {
  bookingId: string;
  type: 'customer_reminder' | 'cleaner_reminder' | 'arrival_alert' | 'review_request';
  scheduledFor: Date;
  recipientId: string;
}

export class BookingReminderService {
  /**
   * Schedule all reminders for a newly created booking
   */
  static async scheduleReminders(bookingId: string): Promise<ReminderSchedule[]> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { client: true, cleaner: true },
    });

    if (!booking) return [];

    const reminders: ReminderSchedule[] = [];
    const bookingDateTime = new Date(booking.date);
    const [hours, minutes] = booking.startTime.split(':').map(Number);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    // 1. Customer reminder: 24 hours before
    const customerReminder = new Date(bookingDateTime);
    customerReminder.setHours(customerReminder.getHours() - 24);
    if (customerReminder > new Date()) {
      reminders.push({
        bookingId,
        type: 'customer_reminder',
        scheduledFor: customerReminder,
        recipientId: booking.clientId ?? '',
      });
    }

    // 2. Cleaner reminder: 12 hours before
    const cleanerReminder = new Date(bookingDateTime);
    cleanerReminder.setHours(cleanerReminder.getHours() - 12);
    if (cleanerReminder > new Date()) {
      reminders.push({
        bookingId,
        type: 'cleaner_reminder',
        scheduledFor: cleanerReminder,
        recipientId: booking.cleanerId ?? '',
      });
    }

    // 3. Arrival alert: 30 minutes before
    const arrivalAlert = new Date(bookingDateTime);
    arrivalAlert.setMinutes(arrivalAlert.getMinutes() - 30);
    if (arrivalAlert > new Date()) {
      reminders.push({
        bookingId,
        type: 'arrival_alert',
        scheduledFor: arrivalAlert,
        recipientId: booking.clientId ?? '',
      });
    }

    // 4. Review request: 2 hours after booking end
    const bookingEndTime = new Date(bookingDateTime);
    bookingEndTime.setHours(bookingEndTime.getHours() + Number(booking.duration));
    const reviewRequest = new Date(bookingEndTime);
    reviewRequest.setHours(reviewRequest.getHours() + 2);
    reminders.push({
      bookingId,
      type: 'review_request',
      scheduledFor: reviewRequest,
      recipientId: booking.clientId ?? '',
    });

    // Store reminders as background jobs
    for (const reminder of reminders) {
      await prisma.backgroundJob.create({
        data: {
          type: 'SEND_REMINDER',
          payload: {
            bookingId: reminder.bookingId,
            reminderType: reminder.type,
            recipientId: reminder.recipientId,
          } as Prisma.InputJsonValue,
          scheduledAt: reminder.scheduledFor,
        },
      });
    }

    return reminders;
  }

  /**
   * Send the branded reminder EMAIL for the email-eligible reminder types
   * (customer 24h, cleaner 12h, review request). The 30-minute arrival alert is
   * push-only. Each send gates on shouldSend(recipient,'REMINDER','EMAIL') inside
   * email.service, so channel-level opt-outs are honoured. Guest bookings (no
   * account) have no recipient user and are skipped.
   */
  static async sendReminderEmail(
    reminderType: string,
    bookingId: string,
    recipientId: string
  ): Promise<void> {
    if (
      reminderType !== 'customer_reminder' &&
      reminderType !== 'cleaner_reminder' &&
      reminderType !== 'review_request'
    ) {
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { client: true, cleaner: true },
    });
    if (!booking) return;

    const bookingDate = new Date(booking.date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const emailData = {
      id: booking.id,
      customerName: booking.client?.name ?? 'Customer',
      cleanerName: booking.cleaner?.name ?? undefined,
      date: bookingDate,
      time: booking.startTime,
      address: [
        booking.addressLine1,
        booking.addressLine2,
        booking.addressCity,
        booking.addressPostcode,
      ]
        .filter(Boolean)
        .join(', '),
      serviceType: booking.serviceType,
      totalPrice: Number(booking.totalPrice),
    };

    if (reminderType === 'cleaner_reminder') {
      if (!booking.cleaner?.email) return;
      await sendCleanerReminder(
        emailData,
        { name: booking.cleaner.name ?? 'Cleaner', email: booking.cleaner.email },
        recipientId
      );
      return;
    }

    // customer_reminder + review_request → the client (account-holders only)
    if (!booking.client?.email) return;
    const user = { name: booking.client.name ?? 'Customer', email: booking.client.email };
    if (reminderType === 'customer_reminder') {
      await sendBookingReminder(emailData, user, recipientId);
    } else {
      await sendReviewRequest(emailData, user, recipientId);
    }
  }

  /**
   * Cancel all pending reminders for a booking
   */
  static async cancelReminders(bookingId: string): Promise<number> {
    const result = await prisma.backgroundJob.updateMany({
      where: {
        type: 'SEND_REMINDER',
        status: 'PENDING',
        payload: { path: ['bookingId'], equals: bookingId },
      },
      data: { status: 'CANCELLED' as string },
    });

    return result.count;
  }
}
