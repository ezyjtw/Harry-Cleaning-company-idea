/**
 * Background job processor.
 * Processes jobs from the BackgroundJob table.
 * In production, this would run as a separate worker process.
 */

import { prisma } from '@/lib/db/prisma';
import { BookingReminderService } from '@/lib/services/booking-reminder.service';
import { shouldSend } from '@/lib/services/notification-preferences.service';
import { processXeroPush, type XeroPushPayload } from '@/lib/services/xero-push.service';

// Copy for each scheduled reminder type (title, body). Category is REMINDER for
// all of them, so delivery honours the user's reminder + push preferences.
const REMINDER_COPY: Record<string, { title: string; body: string }> = {
  customer_reminder: {
    title: 'Your cleaning is tomorrow',
    body: 'A reminder that your Rena cleaning is coming up. Tap to view the details.',
  },
  cleaner_reminder: {
    title: 'You have a job tomorrow',
    body: 'A reminder about your upcoming Rena cleaning job. Tap to view the details.',
  },
  arrival_alert: {
    title: 'Your cleaner is arriving soon',
    body: 'Your cleaner should arrive in about 30 minutes.',
  },
  review_request: {
    title: 'How was your cleaning?',
    body: 'Leave a review for your recent Rena cleaning.',
  },
};

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const jobHandlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  jobHandlers.set(type, handler);
}

export async function processNextBatch(batchSize: number = 10): Promise<number> {
  const now = new Date();

  const candidates = await prisma.backgroundJob.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: batchSize,
  });

  let processedCount = 0;

  for (const job of candidates) {
    // ATOMIC CLAIM: flip PENDING→PROCESSING with a status guard. Only ONE cron
    // tick can win this updateMany; overlapping/retried ticks that lose the race
    // get count 0 and skip, so a job is never processed twice concurrently.
    // (Same atomic-claim pattern the scheduler's release/refund handlers use.)
    const claim = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue; // another tick already claimed it

    const handler = jobHandlers.get(job.type);
    if (!handler) {
      // Unknown type: fail it rather than leave it PENDING to be re-claimed
      // every tick forever.
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: `No handler for job type: ${job.type}` },
      });
      // eslint-disable-next-line no-console
      console.warn(`[JobProcessor] No handler for job type: ${job.type}`);
      continue;
    }

    try {
      await handler(job.payload as Record<string, unknown>);

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      processedCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // attempts was already incremented at claim time. Requeue to PENDING until
      // maxAttempts is hit, then mark FAILED (terminal).
      const updatedJob = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
      const newStatus =
        updatedJob && updatedJob.attempts >= updatedJob.maxAttempts ? 'FAILED' : 'PENDING';

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: newStatus, lastError: errorMessage },
      });

      // eslint-disable-next-line no-console
      console.error(`[JobProcessor] Job ${job.id} failed:`, errorMessage);
    }
  }

  return processedCount;
}

// Register default handlers
registerJobHandler('SEND_EMAIL', async (payload) => {
  const action = payload.action as string;

  if (action === 'PUSH_NOTIFICATION') {
    // Web Push delivery
    try {
      const webpush = await import('web-push');
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
          `mailto:${process.env.SUPPORT_EMAIL || 'support@renacleaning.co.uk'}`,
          vapidPublicKey,
          vapidPrivateKey
        );

        // Get user's push subscriptions from DB
        const userId = payload.userId as string;
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId },
        });

        const pushPayload = JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge || '/icons/icon-72x72.png',
          data: payload.data,
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(JSON.parse(sub.subscription), pushPayload);
          } catch (err: unknown) {
            const error = err as { statusCode?: number };
            if (error.statusCode === 410) {
              // Subscription expired, remove it
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            }
          }
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('[JobProcessor] VAPID keys not configured, skipping push notification');
      }
    } catch {
      // eslint-disable-next-line no-console
      console.log('[JobProcessor] web-push not available or push failed');
    }
    return;
  }

  if (action === 'EMAIL_NOTIFICATION') {
    // Email notifications are handled directly by the notification service
    // via the email service functions. This handler processes queued email jobs.
    // eslint-disable-next-line no-console
    console.log('[JobProcessor] Processing email notification to:', payload.to);
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Sending email:', payload);
});

registerJobHandler('SEND_SMS', async (payload) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    // eslint-disable-next-line no-console
    console.log('[JobProcessor] Twilio not configured, skipping SMS:', payload.to);
    return;
  }

  try {
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    await client.messages.create({
      body: payload.body as string,
      from: fromNumber,
      to: payload.to as string,
    });

    // eslint-disable-next-line no-console
    console.log('[JobProcessor] SMS sent to:', payload.to);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[JobProcessor] SMS send failed:', error);
    throw error; // Re-throw to trigger retry
  }
});

registerJobHandler('SEND_REMINDER', async (payload) => {
  // Producer (BookingReminderService.scheduleReminders) sets recipientId +
  // reminderType + bookingId. (The previous handler read payload.userId, which
  // producers never set — so every reminder was a silent no-op.)
  // recipientId is the account-holder's userId; it is '' for guest bookings
  // (no account), which still get the transactional customer email path.
  const recipientId = (payload.recipientId as string | undefined) || '';
  const reminderType = payload.reminderType as string | undefined;
  const bookingId = payload.bookingId as string | undefined;
  if (!reminderType || !bookingId) return;

  // Skip stale reminders for bookings that were cancelled/exhausted after the
  // reminder was scheduled (no cancelReminders wiring needed — the send checks
  // live state at fire time). Applies to guests too ("send unless cancelled").
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });
  if (!booking || booking.status === 'CANCELLED' || booking.status === 'CASCADE_EXHAUSTED') {
    return;
  }

  // Push and email are gated independently (A11) — a disabled push channel must
  // not suppress an allowed email, and vice-versa. Push is account-holders only
  // (guests have no userId/subscription). All reminder types are category REMINDER.
  if (recipientId && (await shouldSend(recipientId, 'REMINDER', 'PUSH'))) {
    const copy = (reminderType && REMINDER_COPY[reminderType]) || {
      title: 'Reminder',
      body: 'You have an upcoming booking.',
    };
    const pushHandler = jobHandlers.get('SEND_EMAIL');
    if (pushHandler) {
      await pushHandler({
        action: 'PUSH_NOTIFICATION',
        userId: recipientId,
        title: copy.title,
        body: copy.body,
        data: { bookingId, reminderType },
      });
    }
  }

  // Branded email for the email-eligible types (customer 24h, cleaner 12h,
  // review request; guest 24h via the guest path). Arrival alert stays
  // push-only. sendReminderEmail gates on the EMAIL preference internally for
  // account-holders; guest sends are transactional.
  await BookingReminderService.sendReminderEmail(reminderType, bookingId, recipientId).catch(
    () => {}
  );
});

registerJobHandler('PROCESS_PAYMENT', async (payload) => {
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Processing payment:', payload);
});

// A13-Xero-c: post bank transactions to Xero (gated + idempotent inside the handler).
registerJobHandler('XERO_PUSH', async (payload) => {
  await processXeroPush(payload as unknown as XeroPushPayload);
});

registerJobHandler('REQUEST_REVIEW', async (payload) => {
  // Send review request via push notification
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Requesting review:', payload);

  const userId = payload.userId as string;
  if (userId) {
    const pushHandler = jobHandlers.get('SEND_EMAIL');
    if (pushHandler) {
      await pushHandler({
        action: 'PUSH_NOTIFICATION',
        userId,
        title: 'How was your cleaning?',
        body: (payload.body as string) || 'Please leave a review for your recent cleaning',
        data: payload.data as Record<string, unknown> | undefined,
      });
    }
  }
});
