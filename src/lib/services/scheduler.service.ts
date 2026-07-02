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
  exhaustedRefunds: HandlerResult;
  backgroundJobs: HandlerResult;
}

import { processNextBatch } from '@/lib/infrastructure/job-processor';

import {
  processExpiredCascadeWindows as cascadeHandler,
  processExhaustedRefunds as exhaustedRefundHandler,
} from './cascade.service';
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

async function processExhaustedRefunds(): Promise<HandlerResult> {
  return exhaustedRefundHandler();
}

const JOB_BATCH_LIMIT = 50;

// Drain the generic BackgroundJob queue (XERO_PUSH and every other enqueued
// job type) via the registered handlers. Previously nothing called
// processNextBatch, so the whole queue dead-lettered; wiring it here is the
// single drain point. Atomic-claim inside processNextBatch keeps overlapping
// cron ticks from double-processing.
async function processBackgroundJobs(): Promise<HandlerResult> {
  const processed = await processNextBatch(JOB_BATCH_LIMIT);
  return { processed };
}

export async function runScheduledJobs(): Promise<SchedulerSummary> {
  const cascadeWindows = await processExpiredCascadeWindows();
  const releases = await processDueReleases();
  const exhaustedRefunds = await processExhaustedRefunds();
  const backgroundJobs = await processBackgroundJobs();

  return {
    timestamp: new Date().toISOString(),
    cascadeWindows,
    releases,
    exhaustedRefunds,
    backgroundJobs,
  };
}
