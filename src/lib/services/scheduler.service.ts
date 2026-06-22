/**
 * Scheduled job orchestrator.
 *
 * Called every 5 minutes by the Railway cron service via /api/cron/run-jobs.
 *
 * IDEMPOTENCY CONTRACT: Every handler called from runScheduledJobs() MUST be
 * safe to run concurrently and repeatedly. Cron ticks can overlap (previous
 * run still in-flight when next tick fires) and Railway may retry on timeout.
 * Handlers must claim work atomically (e.g. updateMany with a status guard)
 * before acting, so that two overlapping runs never process the same record.
 */

export interface HandlerResult {
  processed: number;
}

export interface SchedulerSummary {
  timestamp: string;
  cascadeWindows: HandlerResult;
  releases: HandlerResult;
}

import { processExpiredCascadeWindows as cascadeHandler } from './cascade.service';
import { releaseBookingFunds } from './transfer.service';

async function processExpiredCascadeWindows(): Promise<HandlerResult> {
  return cascadeHandler();
}

const RELEASE_BATCH_LIMIT = 50;

async function processDueReleases(): Promise<HandlerResult> {
  const { prisma } = await import('@/lib/db/prisma');
  const now = new Date();

  const due = await prisma.booking.findMany({
    where: {
      releaseDueAt: { lte: now },
      transferStatus: 'PENDING',
    },
    select: { id: true },
    take: RELEASE_BATCH_LIMIT,
  });

  let processed = 0;

  for (const booking of due) {
    try {
      const result = await releaseBookingFunds(booking.id);
      if (result.status === 'RELEASED' || result.status === 'ALREADY_RELEASED') {
        processed++;
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[Release] Booking ${booking.id}: ${result.status} — ${result.reason}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Release] Error processing booking ${booking.id}:`, error);
    }
  }

  if (due.length === RELEASE_BATCH_LIMIT) {
    // eslint-disable-next-line no-console
    console.warn(`[Release] Hit batch limit (${RELEASE_BATCH_LIMIT}) — more bookings next tick`);
  }

  return { processed };
}

export async function runScheduledJobs(): Promise<SchedulerSummary> {
  const cascadeWindows = await processExpiredCascadeWindows();
  const releases = await processDueReleases();

  return {
    timestamp: new Date().toISOString(),
    cascadeWindows,
    releases,
  };
}
