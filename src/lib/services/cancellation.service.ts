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
// refundBooking(); this service's only direct Stripe touch is THE FENCE below
// (killing an unpaid booking's live PaymentIntent before the booking dies).
//
// THE FENCE (James-ruled): no booking dies while its intent is alive. For an
// unpaid booking with a stored intent, the intent is cancelled at Stripe FIRST
// and the kill proceeds only on Stripe's confirmed answer. An intent that
// answers "already succeeded" aborts the unpaid kill and routes the cancel
// into the paid world with a FULL refund, always, regardless of notice period
// (ruled: she initiated the cancel while unpaid — the mid-gesture payment is
// the platform's race, never her notice-period problem). Any other unconfirmed
// outcome fails safe: kill aborted, honest retry message, loud log.

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
  // M3 rescue: the customer's "full refund" choice (and the timeout sweep)
  // cancel a cleaner-cancelled booking through this same proven path.
  'CLEANER_CANCELLED',
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
  /** THE FENCE: the payment landed mid-cancel — the booking was cancelled as
   *  a PAID cancellation with a full refund. Routes surface this honestly. */
  latePaid?: boolean;
}

export interface CancellationPreview {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason?: string;
  /** Short-notice grace deadline (ISO) — present while the grace window is live. */
  graceUntil?: string;
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
      createdAt: true,
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

  const policy = BookingLifecycleService.canCancel(booking.date, booking.status, booking.createdAt);
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
    graceUntil: policy.graceUntil?.toISOString(),
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

  // 4. THE FENCE — kill the intent BEFORE the booking. For an unpaid booking
  //    with a stored intent, cancel it at Stripe first; only Stripe's confirmed
  //    kill (cancelled now, or already dead) lets the unpaid cancel proceed.
  let isPaid =
    booking.paymentStatus === 'SUCCEEDED' || booking.paymentStatus === 'PARTIALLY_REFUNDED';
  let fenceLatePaid = false;
  if (!isPaid && booking.stripePaymentIntentId) {
    const { default: stripe } = await import('@/lib/stripe');
    try {
      await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
    } catch {
      // Cancel refused — learn WHY from Stripe before touching the booking.
      let piStatus: string | null = null;
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        piStatus = pi.status;
        if (pi.status === 'succeeded') {
          // The payment landed mid-gesture. Record the truth first (the refund
          // service's payment guard reads it), then route this cancel into the
          // paid world with a FULL refund (James-ruled: always, regardless of
          // notice period — the race is the platform's, not hers).
          const chargeId =
            typeof pi.latest_charge === 'string'
              ? pi.latest_charge
              : (pi.latest_charge?.id ?? null);
          await prisma.booking.update({
            where: { id: bookingId },
            data: { paymentStatus: 'SUCCEEDED', ...(chargeId ? { stripeChargeId: chargeId } : {}) },
          });
          isPaid = true;
          fenceLatePaid = true;
          // eslint-disable-next-line no-console
          console.log(
            `[Cancellation] FENCE: intent ${booking.stripePaymentIntentId} for ${bookingId} succeeded mid-cancel — routing to paid cancellation with FULL refund`
          );
        }
      } catch {
        // Retrieve failed too — piStatus stays null and we fail safe below.
      }
      if (!fenceLatePaid && piStatus !== 'canceled') {
        // Neither a confirmed kill nor a confirmed payment — the intent is in
        // an unknown or in-flight state (processing, network error). Fail safe:
        // the booking is NOT cancelled.
        // eslint-disable-next-line no-console
        console.error(
          `[Cancellation] FENCE: could not confirm intent kill for ${bookingId} (intent ${booking.stripePaymentIntentId}, status: ${piStatus ?? 'unknown'}) — cancel aborted`
        );
        return {
          ok: false,
          status: 409,
          error:
            'We could not confirm your payment state, so nothing has been cancelled. Please try again in a moment.',
        };
      }
      // piStatus === 'canceled': the intent was already dead — kill confirmed.
    }
  }

  // 5. Decide the refund — directive defaults to timing policy for the customer/
  //    guest, full for admin. Percent is always applied to the REMAINDER (what's
  //    left after any prior partial refund), not the original total. A fence
  //    late-payment overrides the directive: full refund, always. (Its
  //    remainder is the same computation — a just-paid booking has no prior
  //    SUCCEEDED refunds, so the remainder is the full charge.)
  const remainder = refundableRemainder(booking);

  const directive: RefundDirective = fenceLatePaid
    ? { kind: 'full' }
    : (params.refund ?? (cancelledBy === 'admin' ? { kind: 'full' } : { kind: 'policy' }));

  let refundPercent: number;
  let plannedRefund: number;
  if (directive.kind === 'policy') {
    const policy = BookingLifecycleService.canCancel(
      booking.date,
      booking.status,
      booking.createdAt
    );
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

  // 6. Atomic claim — re-assert both guards so a concurrent accept/reassign/
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

  // 7. Cascade teardown side-effects (best-effort) — expire any live top-up and
  //    let provisional / reserve cleaners know the booking is gone.
  await tearDownCascadeSideEffects({
    bookingId,
    provisionalCleanerId: booking.provisionalCleanerId,
    reserveCleanerIds: booking.reserveCleanerIds,
  });

  // 8. Refund (best-effort). Skip if nothing was actually captured — avoids a
  //    spurious FAILED record on unpaid bookings. isPaid was decided above:
  //    from the row's paymentStatus, or by the fence's confirmed late payment.
  let refundAmount = 0;
  let refundStatus: string | undefined;
  if (plannedRefund > 0 && isPaid) {
    const { refundBooking } = await import('./refund.service');
    const result = await refundBooking(
      bookingId,
      plannedRefund,
      fenceLatePaid ? 'Payment arrived mid-cancellation — automatic full refund' : reason,
      {
        triggeredBy: params.adminId,
      }
    );
    refundAmount = plannedRefund;
    refundStatus = result.status;
  }

  // 8b. If the cleaner is owed money after the cancel (partial or 0% refund on a
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

  // 9. Email + notifications (best-effort, never block the cancel result).
  await sendCancellationEmail(booking, refundPercent, refundAmount).catch(() => {});
  await notifyCancellation(booking, cancelledBy).catch(() => {});

  // 10. Audit (admin-initiated cancels only).
  if (params.adminId) {
    await AuditService.log({
      userId: params.adminId,
      action: 'ADMIN_CANCEL_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason, refundAmount, refundPercent, refundStatus },
    }).catch(() => {});
  }

  return {
    ok: true,
    status: 200,
    refundPercent,
    refundAmount,
    refundStatus,
    ...(fenceLatePaid ? { latePaid: true } : {}),
  };
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
