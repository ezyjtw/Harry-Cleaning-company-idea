import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

/**
 * H106 broom core + LB-3 auto-expiry sweep.
 *
 * An INCOMPLETE signup is a User with role CLEANER and NO CleanerProfile —
 * a step-0 account whose wizard never finished. It has no profile, no
 * bookings, no money, no documents. This is NOT account deletion (H103):
 * a completed cleaner can never pass the guard here.
 *
 * The guard is STRUCTURAL and lives in removeIncompleteSignup — the one
 * reusable core shared by the admin broom button and the 30-day sweep, so
 * the two doors can never drift apart on what "incomplete" means.
 */

const SWEEP_AGE_DAYS = 30;
const SWEEP_BATCH_LIMIT = 50;

export type RemoveIncompleteResult =
  | { ok: true; email: string }
  | { ok: false; error: string; status: number };

export async function removeIncompleteSignup(params: {
  userId: string;
  /** Admin pressing the broom button; undefined for the system sweep. */
  actorId?: string;
  /** True when the 30-day sweep removed it (recorded in the audit row). */
  swept?: boolean;
}): Promise<RemoveIncompleteResult> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      cleanerProfile: { select: { id: true } },
      _count: { select: { bookingsAsClient: true, bookingsAsCleaner: true } },
    },
  });

  if (!user) {
    return { ok: false, error: 'User not found.', status: 404 };
  }
  // Structural guard — every condition server-side, none of them UI trust.
  if (user.role !== 'CLEANER' || user.cleanerProfile) {
    return {
      ok: false,
      error: 'Only incomplete cleaner signups (no profile) can be removed here.',
      status: 400,
    };
  }
  if (user._count.bookingsAsClient > 0 || user._count.bookingsAsCleaner > 0) {
    return {
      ok: false,
      error: 'This account has bookings — not an incomplete signup.',
      status: 400,
    };
  }

  await prisma.$transaction([
    // Verify/reset tokens are keyed by email identifier, not relation.
    prisma.verificationToken.deleteMany({
      where: { identifier: { in: [user.email, `reset:${user.email}`] } },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  await AuditService.log({
    userId: params.actorId,
    action: 'INCOMPLETE_SIGNUP_REMOVED',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email, name: user.name, swept: params.swept ?? false },
  });

  return { ok: true, email: user.email };
}

/**
 * LB-3: auto-expiry sweep. Step-0 accounts older than 30 days are removed
 * through the SAME structural core as the admin broom — the age cutoff is the
 * only thing this adds. Idempotent and convergent: each removed row is gone;
 * overlapping cron ticks racing on the same row fail safe (second delete
 * throws, caught per-row). Audit rows carry swept:true to distinguish them
 * from admin-pressed removals.
 */
export async function sweepIncompleteSignups(): Promise<{ processed: number }> {
  const cutoff = new Date(Date.now() - SWEEP_AGE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.user.findMany({
    where: {
      role: 'CLEANER',
      cleanerProfile: { is: null },
      createdAt: { lt: cutoff },
      bookingsAsClient: { none: {} },
      bookingsAsCleaner: { none: {} },
    },
    select: { id: true },
    take: SWEEP_BATCH_LIMIT,
  });

  let processed = 0;
  for (const c of candidates) {
    try {
      // The core re-checks the full structural guard at removal time, so a row
      // that completed signup between the query and here refuses safely.
      const result = await removeIncompleteSignup({ userId: c.id, swept: true });
      if (result.ok) {
        processed++;
        // eslint-disable-next-line no-console
        console.log(`[IncompleteSweep] removed 30-day incomplete signup ${result.email}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[IncompleteSweep] failed removing ${c.id}:`, err);
    }
  }
  return { processed };
}
