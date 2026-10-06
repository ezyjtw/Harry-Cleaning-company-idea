import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

// RENA-014 (remediation register, B0): scheduler lease, cadence debounce and
// success-aware heartbeat, all on the single 'scheduler' row.
//
// Two guards, kept separate on purpose (James-ruled amendment):
//   running lock  lockedUntil: set to now + RUN_LOCK_MS on claim and to now on
//                 finish, so a run in progress is never overlapped and a run
//                 that crashed mid-way is recovered after ten minutes;
//   cadence       lastStartedAt: a claim needs the previous start to be older
//                 than CADENCE_MS (four minutes), so the second of the two
//                 production callers (8 to 60 s behind the first, after the
//                 first run has already finished) is refused. The rig proved
//                 a release-clears-the-lock draft wrong on exactly that case.
// Both conditions sit in one conditional update, which Postgres serialises,
// so simultaneous callers cannot both win either (ten at once in the test).
//
// Heartbeat: lastSucceededAt advances only when runScheduledJobs completed;
// a failure records lastFailedAt and a short lastError (message only, never a
// stack or job internals). /api/health/scheduler is healthy only while
// lastSucceededAt is within STALE_AFTER_MS, so repeated failing ticks go
// unhealthy and the next success restores it.

export const SCHEDULER_LEASE_ID = 'scheduler';
export const RUN_LOCK_MS = 10 * 60 * 1000;
export const CADENCE_MS = 4 * 60 * 1000;
export const STALE_AFTER_MS = 15 * 60 * 1000;
const CALLER_MAX = 120;
const ERROR_MAX = 300;

export interface LeaseClaim {
  claimed: boolean;
  /** Why a claim was refused: a run is in progress, or the cadence window has not elapsed. */
  reason?: 'running' | 'cadence';
  now: Date;
  lockedUntil: Date | null;
  lastStartedAt: Date | null;
}

export type SchedulerHealthStatus = 'healthy' | 'stale' | 'failing';

export interface SchedulerHeartbeat {
  status: SchedulerHealthStatus;
  lastStartedAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lockedUntil: string | null;
  /** Seconds since the last successful run, null when there has never been one. */
  ageSeconds: number | null;
}

/** Trim the caller identity to a short, non-personal label (a user agent). */
export function callerLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, CALLER_MAX);
}

/** A short error summary for the row: the message only, no stack. */
export function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0].slice(0, ERROR_MAX);
}

async function ensureRow(): Promise<void> {
  try {
    await prisma.schedulerLease.upsert({
      where: { id: SCHEDULER_LEASE_ID },
      create: { id: SCHEDULER_LEASE_ID },
      update: {},
    });
  } catch {
    // A concurrent first caller may have created it; the claim decides.
  }
}

function claimWhere(now: Date): Prisma.SchedulerLeaseWhereInput {
  const cadenceBefore = new Date(now.getTime() - CADENCE_MS);
  return {
    id: SCHEDULER_LEASE_ID,
    AND: [
      { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      { OR: [{ lastStartedAt: null }, { lastStartedAt: { lt: cadenceBefore } }] },
    ],
  };
}

export async function claimSchedulerLease(caller: string | null): Promise<LeaseClaim> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + RUN_LOCK_MS);
  const data = { lockedUntil, lastStartedAt: now, lastCaller: caller };

  let result = await prisma.schedulerLease.updateMany({ where: claimWhere(now), data });

  if (result.count === 0) {
    const row = await prisma.schedulerLease.findUnique({ where: { id: SCHEDULER_LEASE_ID } });
    if (!row) {
      await ensureRow();
      result = await prisma.schedulerLease.updateMany({ where: claimWhere(now), data });
    } else {
      const running = !!row.lockedUntil && row.lockedUntil.getTime() >= now.getTime();
      return {
        claimed: false,
        reason: running ? 'running' : 'cadence',
        now,
        lockedUntil: row.lockedUntil,
        lastStartedAt: row.lastStartedAt,
      };
    }
  }

  return { claimed: result.count === 1, now, lockedUntil, lastStartedAt: now };
}

export async function releaseSchedulerLease(
  outcome: { summary: object } | { error: unknown }
): Promise<void> {
  const finishedAt = new Date();
  await prisma.schedulerLease.update({
    where: { id: SCHEDULER_LEASE_ID },
    data:
      'summary' in outcome
        ? {
            lockedUntil: finishedAt,
            lastSucceededAt: finishedAt,
            // The scheduler summary is plain data (strings and counts); the
            // round trip strips anything a JSON column cannot hold.
            lastSummary: JSON.parse(JSON.stringify(outcome.summary)) as Prisma.InputJsonValue,
            lastError: null,
          }
        : {
            lockedUntil: finishedAt,
            lastFailedAt: finishedAt,
            lastError: errorSummary(outcome.error),
          },
  });
}

export function heartbeatStatus(
  row: { lastSucceededAt: Date | null; lastFailedAt: Date | null } | null,
  now: Date
): SchedulerHealthStatus {
  const succeeded = row?.lastSucceededAt ?? null;
  const failed = row?.lastFailedAt ?? null;
  if (succeeded && now.getTime() - succeeded.getTime() <= STALE_AFTER_MS) return 'healthy';
  if (failed && (!succeeded || failed.getTime() > succeeded.getTime())) return 'failing';
  return 'stale';
}

export async function getSchedulerHeartbeat(now = new Date()): Promise<SchedulerHeartbeat> {
  const row = await prisma.schedulerLease.findUnique({ where: { id: SCHEDULER_LEASE_ID } });
  const succeeded = row?.lastSucceededAt ?? null;
  return {
    status: heartbeatStatus(row, now),
    lastStartedAt: row?.lastStartedAt?.toISOString() ?? null,
    lastSucceededAt: succeeded?.toISOString() ?? null,
    lastFailedAt: row?.lastFailedAt?.toISOString() ?? null,
    lockedUntil: row?.lockedUntil?.toISOString() ?? null,
    ageSeconds: succeeded ? Math.round((now.getTime() - succeeded.getTime()) / 1000) : null,
  };
}
