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
  // Placeholder: integrate with email service
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Sending email:', payload);
});

registerJobHandler('SEND_SMS', async (payload) => {
  // Placeholder: integrate with SMS provider (Twilio, etc.)
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Sending SMS:', payload);
});

registerJobHandler('SEND_REMINDER', async (payload) => {
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Sending reminder:', payload);
});

registerJobHandler('PROCESS_PAYMENT', async (payload) => {
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Processing payment:', payload);
});

registerJobHandler('REQUEST_REVIEW', async (payload) => {
  // eslint-disable-next-line no-console
  console.log('[JobProcessor] Requesting review:', payload);
});
