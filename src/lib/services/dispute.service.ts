// ─── Stage 4 Part 2: Dispute filing ──────────────────────────
//
// Filing a "report a problem" dispute on a booking. A dispute PAUSES the release
// of funds so the cleaner can't be paid while the problem is open
// (transferStatus → PAUSED; releaseBookingFunds skips PAUSED). Resolution — and
// all money movement — is owned by AdminOperationsService.resolveDispute.
//
// A dispute is fileable only from COMPLETED or IN_PROGRESS: the work has
// happened or is happening. Pre-work issues are cancellations, not disputes.
//
// ATOMICITY: the Dispute row, the booking → DISPUTED transition and the
// transferStatus → PAUSED pause are written in ONE $transaction. The guarded
// updateMany re-asserts the status + money-state guards, so a concurrent change
// (already disputed, funds released) matches nothing and the whole transaction
// rolls back — no orphan dispute, no half-pause.

import type { BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';

// A dispute may be filed only when the work has happened or is happening.
// F9: REVIEWED included — problems can surface after the customer reviews
// (money-state guards below still block filing once funds are settled).
export const DISPUTABLE_STATUS: BookingStatus[] = ['COMPLETED', 'IN_PROGRESS', 'REVIEWED'];

// Transfer states where the cleaner's money is already gone or in flight —
// pausing is impossible or pointless, so filing is blocked. Only PENDING /
// FAILED (and the no-op PAUSED) can be paused.
export const DISPUTE_BLOCKED_TRANSFER = [
  'RELEASING',
  'RELEASED',
  'REFUNDING',
  'REFUNDED',
  'UNKNOWN',
];

export interface FileDisputeResult {
  ok: boolean;
  status: number; // HTTP status the route should return
  error?: string;
  disputeId?: string;
}

class DisputeConflict extends Error {}

/**
 * File a dispute on a booking on behalf of the authenticated customer.
 * Authorization (session ownership) is the caller's responsibility — this
 * function trusts the bookingId and enforces status, payment and money-state
 * guards, then atomically opens the dispute and pauses the release.
 */
export async function fileDispute(params: {
  bookingId: string;
  raisedById: string;
  reason: string;
  description: string;
}): Promise<FileDisputeResult> {
  const { bookingId, raisedById, reason, description } = params;

  // 1. Load booking + existing dispute for the guard checks.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      transferStatus: true,
      paymentStatus: true,
      cleanerId: true,
      date: true,
      dispute: { select: { id: true } },
    },
  });
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };

  // 2. Status guard — disputes are for work that happened / is happening.
  if (!DISPUTABLE_STATUS.includes(booking.status)) {
    return {
      ok: false,
      status: 422,
      error: `A problem can only be reported for in-progress or completed bookings (this one is ${booking.status.toLowerCase()}).`,
    };
  }

  // 3. Payment guard — there must be a captured payment to hold / refund.
  if (booking.paymentStatus !== 'SUCCEEDED' && booking.paymentStatus !== 'PARTIALLY_REFUNDED') {
    return { ok: false, status: 422, error: 'No captured payment to dispute on this booking.' };
  }

  // 4. Money-state guard — can't pause what's already released or in flight.
  if (DISPUTE_BLOCKED_TRANSFER.includes(booking.transferStatus)) {
    return {
      ok: false,
      status: 409,
      error: 'This booking can no longer be disputed — payment has already been processed.',
    };
  }

  // 5. Uniqueness — one dispute per booking (also enforced by @unique).
  if (booking.dispute) {
    return {
      ok: false,
      status: 409,
      error: 'A problem has already been reported for this booking.',
    };
  }

  // 6. Atomic: create the Dispute, flip the booking to DISPUTED and PAUSE the
  //    release in one transaction. The guarded updateMany re-asserts the status
  //    and money-state guards so a concurrent change aborts the whole filing.
  let disputeId: string;
  try {
    disputeId = await prisma.$transaction(async (tx) => {
      const claim = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: { in: DISPUTABLE_STATUS },
          transferStatus: { notIn: DISPUTE_BLOCKED_TRANSFER },
        },
        data: { status: 'DISPUTED', transferStatus: 'PAUSED' },
      });
      if (claim.count === 0) {
        throw new DisputeConflict('Booking changed state — dispute aborted.');
      }
      const created = await tx.dispute.create({
        data: { bookingId, raisedById, reason, description, status: 'OPEN' },
        select: { id: true },
      });
      return created.id;
    });
  } catch (err) {
    if (err instanceof DisputeConflict) {
      return { ok: false, status: 409, error: err.message };
    }
    // Unique-constraint backstop — a concurrent filing that slipped past step 5.
    return {
      ok: false,
      status: 409,
      error: 'A problem has already been reported for this booking.',
    };
  }

  // 7. Notify the cleaner + admins, and audit (best-effort — never block filing).
  await notifyDisputeOpened(booking, bookingId, reason).catch(() => {});
  await AuditService.log({
    userId: raisedById,
    action: 'DISPUTE_OPENED',
    entityType: 'Dispute',
    entityId: disputeId,
    metadata: { bookingId, reason },
  }).catch(() => {});

  return { ok: true, status: 201, disputeId };
}

// ─── Notifications (best-effort, fire-and-forget) ──────────────

async function notifyDisputeOpened(
  booking: { cleanerId: string; date: Date },
  bookingId: string,
  reason: string
): Promise<void> {
  const dateStr = booking.date.toLocaleDateString('en-GB');

  // Assigned cleaner — their payout is now on hold.
  await prisma.notification
    .create({
      data: {
        userId: booking.cleanerId,
        type: 'DISPUTE_OPENED',
        title: 'A problem was reported',
        body: `A customer reported a problem with the booking on ${dateStr}. Your payout is on hold until it is resolved.`,
        data: { bookingId },
      },
    })
    .catch(() => {});

  // Admins — someone needs to review and resolve.
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  for (const admin of admins) {
    await prisma.notification
      .create({
        data: {
          userId: admin.id,
          type: 'DISPUTE_OPENED',
          title: 'New dispute to review',
          body: `A dispute was raised on booking ${bookingId.substring(0, 8).toUpperCase()} (${dateStr}): ${reason}`,
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
}
