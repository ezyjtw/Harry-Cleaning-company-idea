/**
 * Background job processor.
 * Processes jobs from the BackgroundJob table.
 * In production, this would run as a separate worker process.
 */

import { prisma } from '@/lib/db/prisma';

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const jobHandlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  jobHandlers.set(type, handler);
}

export async function processNextBatch(batchSize: number = 10): Promise<number> {
  const now = new Date();

  const jobs = await prisma.backgroundJob.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: batchSize,
  });

  let processedCount = 0;

  for (const job of jobs) {
    const handler = jobHandlers.get(job.type);
    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(`[JobProcessor] No handler for job type: ${job.type}`);
      continue;
    }

    try {
      // Mark as processing
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
      });

      // Execute handler
      await handler(job.payload as Record<string, unknown>);

      // Mark as completed
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      processedCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if max attempts reached
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
          `mailto:${process.env.SUPPORT_EMAIL || 'support@rena.com'}`,
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
            await webpush.sendNotification(
              JSON.parse(sub.subscription),
              pushPayload
            );
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
  // Send reminder via email and/or push notification
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Sending reminder:', payload);

  // Queue a push notification for the reminder
  const userId = payload.userId as string;
  if (userId) {
    const pushHandler = jobHandlers.get('SEND_EMAIL');
    if (pushHandler) {
      await pushHandler({
        action: 'PUSH_NOTIFICATION',
        userId,
        title: (payload.title as string) || 'Reminder',
        body: (payload.body as string) || 'You have an upcoming booking',
        data: payload.data as Record<string, unknown> | undefined,
      });
    }
  }
});

registerJobHandler('PROCESS_PAYMENT', async (payload) => {
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Processing payment:', payload);
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
