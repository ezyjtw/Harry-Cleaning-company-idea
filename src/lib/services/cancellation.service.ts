// ─── Stage 4 Part 1: Cancellation orchestrator ────────────────
//
// Single owner of the cancel money path. The authenticated customer endpoint,
// the guest cancel endpoint, and admin cancel all route through
// executeCancellation() so the guards, atomic claim, cascade teardown, refund
// orchestration, email and notifications can never drift between actors.
//
// Refund amount is decided by a RefundDirective:
//   - policy : timing-based percent of the remainder (customer/guest)
//   - full   : 100% of the remainder (admin default)
//   - amount : explicit £ override, capped at the remainder (admin override)
//
// ORDERING CONTRACT: the booking is set CANCELLED first via an atomic
// updateMany (status + transferStatus guards), then the refund is issued
// best-effort. A failed refund leaves a FAILED RefundRecord for admin retry —
// the booking stays cancelled either way. Refund money movement is owned by
// refundBooking(); this service never touches Stripe directly.

import type { BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { cascadeTeardownFields } from './cascade.service';
import { sendBookingCancellation } from './email.service';

// Statuses a booking may be cancelled from (mirrors canCancel()).
export const CANCELLABLE_STATUS: BookingStatus[] = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'CASCADE_EXHAUSTED',
];

// Transfer states where money is in flight or already released — cancel is
// blocked. Post-release (RELEASED) is hard-blocked in v1: clawing back a
// cleaner's already-paid share is the reversal path, deferred to a later stage.
export const CANCEL_BLOCKED_TRANSFER = ['RELEASING', 'UNKNOWN', 'REFUNDING', 'RELEASED'];

export type RefundDirective =
  | { kind: 'policy' }
  | { kind: 'full' }
  | { kind: 'amount'; amount: number };

export interface CancellationResult {
  ok: boolean;
  status: number; // HTTP status the route should return
  error?: string;
  refundPercent?: number;
  refundAmount?: number;
  refundStatus?: string;
}

export interface CancellationPreview {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason?: string;
}

// Refundable remainder = what's left of the captured charge after any prior
// partial refund. Anchored to the original charge (Part-3), never totalPrice
// drift. Shared by execute and preview so the two cannot diverge.
function refundableRemainder(booking: {
  totalAmountCharged: unknown;
  totalPrice: unknown;
  refundRecords: { amount: unknown }[];
}): number {
  const totalPaid = Number(booking.totalAmountCharged ?? booking.totalPrice);
  const alreadyRefunded = booking.refundRecords.reduce((s, r) => s + Number(r.amount), 0);
  return Math.max(0, totalPaid - alreadyRefunded);
}

/**
 * Read-only cancellation preview for the customer's timing policy. Runs the SAME
 * guards and the SAME canCancel() policy as executeCancellation but mutates
 * nothing — no CANCELLED write, no refund, no teardown. Authorization is the
 * caller's responsibility (ownership is checked in the route before this runs).
 */
export async function previewCancellation(bookingId: string): Promise<CancellationPreview> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      transferStatus: true,
      paymentStatus: true,
      date: true,
      totalAmountCharged: true,
      totalPrice: true,
      refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
    },
  });
  if (!booking) {
    return { canCancel: false, refundPercent: 0, refundAmount: 0, reason: 'Booking not found' };
  }

  if (!CANCELLABLE_STATUS.includes(booking.status)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: `Cannot cancel a ${booking.status} booking`,
    };
  }
  if (CANCEL_BLOCKED_TRANSFER.includes(booking.transferStatus)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      reason: `Cannot cancel — payment is currently ${booking.transferStatus.toLowerCase()}`,
    };
  }

  const policy = BookingLifecycleService.canCancel(booking.date, booking.status);
  if (!policy.canCancel) {
    return { canCancel: false, refundPercent: 0, refundAmount: 0, reason: policy.reason };
  }

  // Mirror execute: only paid bookings yield an actual refund amount.
  const isPaid =
    booking.paymentStatus === 'SUCCEEDED' || booking.paymentStatus === 'PARTIALLY_REFUNDED';
  const remainder = refundableRemainder(booking);
  const refundAmount = isPaid
    ? Math.round(remainder * (policy.refundPercent / 100) * 100) / 100
    : 0;

  return {
    canCancel: true,
    refundPercent: policy.refundPercent,
    refundAmount,
    reason: policy.reason,
  };
}

/**
 * Cancel a booking on behalf of the customer, a guest, or an admin.
 * Authorization (session ownership / guest token / admin role) is the caller's
 * responsibility — this function trusts the bookingId and enforces only status +
 * money-state guards. The refund amount is chosen by the RefundDirective; if
 * omitted it defaults to timing policy for customer/guest and full for admin.
 */
export async function executeCancellation(params: {
  bookingId: string;
  cancelledBy: 'client' | 'guest' | 'admin';
  reason?: string;
  adminId?: string;
  refund?: RefundDirective;
}): Promise<CancellationResult> {
  const { bookingId, cancelledBy } = params;

  // 1. Load booking with the money, email and cascade fields we need.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      address: true,
      cleaner: { select: { name: true } },
      client: { select: { id: true, name: true, email: true } },
      refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
    },
  });
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };

  // 2. Status guard.
  if (!CANCELLABLE_STATUS.includes(booking.status)) {
    return { ok: false, status: 422, error: `Cannot cancel a ${booking.status} booking` };
  }

  // 3. Money-state guard — money in flight or already released.
  if (CANCEL_BLOCKED_TRANSFER.includes(booking.transferStatus)) {
    return {
      ok: false,
      status: 409,
      error: `Cannot cancel — payment is currently ${booking.transferStatus.toLowerCase()}`,
    };
  }

  // 4. Decide the refund — directive defaults to timing policy for the customer/
  //    guest, full for admin. Percent is always applied to the REMAINDER (what's
  //    left after any prior partial refund), not the original total.
  const remainder = refundableRemainder(booking);

  const directive: RefundDirective =
    params.refund ?? (cancelledBy === 'admin' ? { kind: 'full' } : { kind: 'policy' });

  let refundPercent: number;
  let plannedRefund: number;
  if (directive.kind === 'policy') {
    const policy = BookingLifecycleService.canCancel(booking.date, booking.status);
    if (!policy.canCancel) {
      return {
        ok: false,
        status: 422,
        error: policy.reason || 'Booking cannot be cancelled in current status',
      };
    }
    refundPercent = policy.refundPercent;
    plannedRefund = Math.round(remainder * (refundPercent / 100) * 100) / 100;
  } else if (directive.kind === 'full') {
    plannedRefund = remainder;
    refundPercent = 100;
  } else {
    plannedRefund = Math.round(Math.min(Math.max(0, directive.amount), remainder) * 100) / 100;
    refundPercent = remainder > 0 ? Math.round((plannedRefund / remainder) * 100) : 0;
  }

  const reason = params.reason?.trim() || `Cancelled by ${cancelledBy}`;

  // 5. Atomic claim — re-assert both guards so a concurrent accept/reassign/
  //    release that changed state since the read fails the cancel. Cascade
  //    fields are torn down in the same write.
  const claim = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: CANCELLABLE_STATUS },
      transferStatus: { notIn: CANCEL_BLOCKED_TRANSFER },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason,
      ...cascadeTeardownFields(),
    },
  });
  if (claim.count === 0) {
    return { ok: false, status: 409, error: 'Booking changed state — cancel aborted' };
  }

  // 6. Cascade teardown side-effects (best-effort) — expire any live top-up and
  //    let provisional / reserve cleaners know the booking is gone.
  await tearDownCascadeSideEffects({
    bookingId,
    provisionalCleanerId: booking.provisionalCleanerId,
    reserveCleanerIds: booking.reserveCleanerIds,
  });

  // 7. Refund (best-effort). Skip if nothing was actually captured — avoids a
  //    spurious FAILED record on unpaid bookings.
  let refundAmount = 0;
  let refundStatus: string | undefined;
  const isPaid =
    booking.paymentStatus === 'SUCCEEDED' || booking.paymentStatus === 'PARTIALLY_REFUNDED';
  if (plannedRefund > 0 && isPaid) {
    const { refundBooking } = await import('./refund.service');
    const result = await refundBooking(bookingId, plannedRefund, reason, {
      triggeredBy: params.adminId,
    });
    refundAmount = plannedRefund;
    refundStatus = result.status;
  }

  // 7b. If the cleaner is owed money after the cancel (partial or 0% refund on a
  //     paid booking), schedule immediate release. A cancelled booking has no
  //     dispute window — the scheduler releases on the next tick.
  //     Full refund → cleanerEarnings zeroed, transferStatus REFUNDED → nothing to release.
  //     Unpaid booking → no charge to release → skip.
  const isPartialOrNoRefund = isPaid && plannedRefund < remainder;
  if (isPartialOrNoRefund) {
    await prisma.booking
      .update({
        where: { id: bookingId },
        data: { releaseDueAt: new Date() },
      })
      .catch(() => {});
  }

  // 8. Email + notifications (best-effort, never block the cancel result).
  await sendCancellationEmail(booking, refundPercent, refundAmount).catch(() => {});
  await notifyCancellation(booking, cancelledBy).catch(() => {});

  // 9. Audit (admin-initiated cancels only).
  if (params.adminId) {
    await AuditService.log({
      userId: params.adminId,
      action: 'ADMIN_CANCEL_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason, refundAmount, refundPercent, refundStatus },
    }).catch(() => {});
  }

  return { ok: true, status: 200, refundPercent, refundAmount, refundStatus };
}

// ─── Side-effect helpers ──────────────────────────────────────

async function tearDownCascadeSideEffects(args: {
  bookingId: string;
  provisionalCleanerId: string | null;
  reserveCleanerIds: string[];
}): Promise<void> {
  await prisma.topupRecord
    .updateMany({
      where: { bookingId: args.bookingId, status: { in: ['PENDING', 'UNKNOWN'] } },
      data: { status: 'EXPIRED', failureReason: 'Booking cancelled' },
    })
    .catch(() => {});

  const notifyIds = new Set<string>();
  if (args.provisionalCleanerId) notifyIds.add(args.provisionalCleanerId);
  for (const id of args.reserveCleanerIds) notifyIds.add(id);

  for (const userId of Array.from(notifyIds)) {
    await prisma.notification
      .create({
        data: {
          userId,
          type: 'BOOKING_CANCELLED',
          title: 'Booking cancelled',
          body: 'A booking you were being considered for has been cancelled by the customer.',
          data: { bookingId: args.bookingId },
        },
      })
      .catch(() => {});
  }
}

interface LoadedBooking {
  id: string;
  date: Date;
  startTime: string;
  serviceType: string;
  totalPrice: unknown;
  guestEmail: string | null;
  guestName: string | null;
  cleanerId: string;
  clientId: string | null;
  address: { line1: string; city: string; postcode: string } | null;
  cleaner: { name: string | null } | null;
  client: { id: string; name: string | null; email: string | null } | null;
}

async function sendCancellationEmail(
  booking: LoadedBooking,
  refundPercent: number,
  refundAmount: number
): Promise<void> {
  const email = booking.client?.email ?? booking.guestEmail;
  if (!email) return;
  const name = booking.client?.name ?? booking.guestName ?? 'there';
  const addressStr = booking.address
    ? [booking.address.line1, booking.address.city, booking.address.postcode]
        .filter(Boolean)
        .join(', ')
    : 'your address';

  await sendBookingCancellation(
    {
      id: booking.id,
      customerName: name,
      cleanerName: booking.cleaner?.name ?? undefined,
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      address: addressStr,
      serviceType: booking.serviceType,
      totalPrice: Number(booking.totalPrice),
    },
    { name, email },
    { refundAmount, refundPercent }
  );
}

async function notifyCancellation(
  booking: LoadedBooking,
  cancelledBy: 'client' | 'guest' | 'admin'
): Promise<void> {
  const dateStr = booking.date.toLocaleDateString('en-GB');
  const byTeam = cancelledBy === 'admin';

  // Assigned cleaner — the booking they hold is gone.
  await prisma.notification
    .create({
      data: {
        userId: booking.cleanerId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: `The booking on ${dateStr} has been cancelled${byTeam ? ' by our team' : ' by the customer'}.`,
        data: { bookingId: booking.id },
      },
    })
    .catch(() => {});

  // Registered customer — confirmation (their own action, or admin acting on it).
  // Guests have no userId, so they're informed by email only.
  if ((cancelledBy === 'client' || cancelledBy === 'admin') && booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'BOOKING_CANCELLED',
          title: 'Booking cancelled',
          body: `Your booking on ${dateStr} has been cancelled${byTeam ? ' by our team' : ''}.`,
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
  }
}
