import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

// RENA-014 (remediation register, B0): the scheduler lease and heartbeat.
//
// Claim = one conditional update on the single 'scheduler' row: it succeeds
// only when the lock is unset or older than LEASE_TTL_MS. Postgres serialises
// the updates, so callers inside the same window cannot both win, whether they
// arrive together (the integration test fires ten at once) or seconds apart
// (the production pair arrives 8 to 60 s apart). Release therefore does NOT
// clear the lock: it records the outcome and leaves lockedAt in place, so the
// window is "at most one run start per LEASE_TTL_MS", four minutes, which is
// longer than the two callers' spread and than any observed run (0.1 to 6 s)
// and shorter than the five-minute tick. The same TTL recovers a crashed run.
// The rig proved the first draft wrong: with release clearing the lock, a POST
// one second after a finished run ran the sweeps again.
//
// Heartbeat = lastFinishedAt. /api/health/scheduler answers 503 once it is
// older than STALE_AFTER_MS (three missed ticks), which the external monitor
// turns into an alert.

export const SCHEDULER_LEASE_ID = 'scheduler';
export const LEASE_TTL_MS = 4 * 60 * 1000;
export const STALE_AFTER_MS = 15 * 60 * 1000;
const CALLER_MAX = 120;

export interface LeaseClaim {
  claimed: boolean;
  now: Date;
  lockedAt: Date | null;
  lastStartedAt: Date | null;
}

export interface SchedulerHeartbeat {
  status: 'ok' | 'stale';
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lockedAt: string | null;
  lastCaller: string | null;
  ageSeconds: number | null;
  lastError: string | null;
}

/** Trim the caller identity to a short, non-personal label (a user agent). */
export function callerLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, CALLER_MAX);
}

async function ensureRow(): Promise<void> {
  try {
    await prisma.schedulerLease.upsert({
      where: { id: SCHEDULER_LEASE_ID },
      create: { id: SCHEDULER_LEASE_ID },
      update: {},
    });
  } catch {
    // A concurrent first caller may have created it; the claim below decides.
  }
}

export async function claimSchedulerLease(caller: string | null): Promise<LeaseClaim> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LEASE_TTL_MS);

  let result = await prisma.schedulerLease.updateMany({
    where: {
      id: SCHEDULER_LEASE_ID,
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    data: { lockedAt: now, lastStartedAt: now, lastCaller: caller },
  });

  if (result.count === 0) {
    const row = await prisma.schedulerLease.findUnique({ where: { id: SCHEDULER_LEASE_ID } });
    if (!row) {
      await ensureRow();
      result = await prisma.schedulerLease.updateMany({
        where: { id: SCHEDULER_LEASE_ID, lockedAt: null },
        data: { lockedAt: now, lastStartedAt: now, lastCaller: caller },
      });
    } else {
      return { claimed: false, now, lockedAt: row.lockedAt, lastStartedAt: row.lastStartedAt };
    }
  }

  return { claimed: result.count === 1, now, lockedAt: now, lastStartedAt: now };
}

export async function releaseSchedulerLease(
  outcome: { summary: object } | { error: string }
): Promise<void> {
  const finishedAt = new Date();
  await prisma.schedulerLease.update({
    where: { id: SCHEDULER_LEASE_ID },
    data:
      'summary' in outcome
        ? {
            lastFinishedAt: finishedAt,
            // The scheduler summary is plain data (strings and counts); the
            // round trip strips anything a JSON column cannot hold.
            lastSummary: JSON.parse(JSON.stringify(outcome.summary)) as Prisma.InputJsonValue,
            lastError: null,
          }
        : { lastFinishedAt: finishedAt, lastError: outcome.error.slice(0, 500) },
  });
}

export async function getSchedulerHeartbeat(now = new Date()): Promise<SchedulerHeartbeat> {
  const row = await prisma.schedulerLease.findUnique({ where: { id: SCHEDULER_LEASE_ID } });
  const lastFinishedAt = row?.lastFinishedAt ?? null;
  const ageSeconds = lastFinishedAt
    ? Math.round((now.getTime() - lastFinishedAt.getTime()) / 1000)
    : null;
  const stale = ageSeconds === null || ageSeconds * 1000 > STALE_AFTER_MS;
  return {
    status: stale ? 'stale' : 'ok',
    lastStartedAt: row?.lastStartedAt?.toISOString() ?? null,
    lastFinishedAt: lastFinishedAt?.toISOString() ?? null,
    lockedAt: row?.lockedAt?.toISOString() ?? null,
    lastCaller: row?.lastCaller ?? null,
    ageSeconds,
    lastError: row?.lastError ?? null,
  };
}
