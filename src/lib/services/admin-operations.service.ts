import type { BookingStatus, PropertySize } from '@prisma/client';

import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';
import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import type { CancellationResult, RefundDirective } from './cancellation.service';
import { executeCancellation } from './cancellation.service';
import { cascadeTeardownFields, enterAdminReassignProvisional } from './cascade.service';
import { PRICE_ABSORPTION_THRESHOLD, pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';
import { updateStoredRating } from './rating.service';
import { releaseBookingFunds, resumePausedRelease } from './transfer.service';

export type ReassignPriceCase = 'EQUAL' | 'CHEAPER' | 'PRICIER';

export interface ReassignResult {
  outcome: 'REASSIGNED' | 'PROVISIONAL';
  priceCase: ReassignPriceCase;
  refundAmount?: number;
  topupAmount?: number;
  approvalExpiresAt?: Date;
  warning?: string;
}

const REASSIGN_ELIGIBLE: BookingStatus[] = [
  'AWAITING_CLEANER',
  'ACCEPTED',
  'CONFIRMED',
  'CASCADE_EXHAUSTED',
];

export interface DisputeResolveResult {
  outcome: 'release-to-cleaner' | 'refund-customer' | 'split';
  refundedAmount: number;
  refundStatus?: string;
  releaseStatus?: string;
}

export class AdminOperationsService {
  /**
   * Manually assign a cleaner to a booking
   */
  static async assignCleaner(bookingId: string, cleanerId: string, adminId?: string) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { cleanerId, status: 'AWAITING_CLEANER', adminNotes: `Manually assigned by admin` },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_ASSIGN_CLEANER',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { cleanerId },
    });

    return booking;
  }

  /**
   * Reassign a booking to a different cleaner.
   *
   * Never force-charges the customer. Three price cases vs the price paid:
   *   EQUAL   (|diff| <= threshold) → direct swap, adjust earnings split.
   *   CHEAPER (diff < -threshold)   → swap (earnings/fee set in the atomic
   *                                   claim so they're correct regardless of
   *                                   refund outcome) + refund the difference
   *                                   (totalPrice via bookingDataOverride, set
   *                                   on refund success).
   *   PRICIER (diff >  threshold)   → guest: reject; auth: send the customer a
   *                                   top-up approval (same A5.3 provisional
   *                                   flow). On decline/expiry → revert to the
   *                                   prior cleaner/state (not the cascade).
   *
   * Guards: eligible status, money-not-in-flight (hard-block post-release in
   * v1), valid non-suspended cleaner. Atomic claim (updateMany + count check).
   */
  static async reassignBooking(
    bookingId: string,
    newCleanerId: string,
    reason: string,
    adminId?: string
  ): Promise<ReassignResult> {
    // Shared guard + quote path — identical to previewReassign so the preview
    // can never diverge from what execution does.
    const { booking, quote, originalTotal, diff, priceCase } =
      await AdminOperationsService.validateAndQuote(bookingId, newCleanerId);

    // Best-effort: expire any pending top-up on a booking we're taking over
    await prisma.topupRecord
      .updateMany({
        where: { bookingId, status: { in: ['PENDING', 'UNKNOWN'] } },
        data: { status: 'EXPIRED', failureReason: 'Superseded by admin reassign' },
      })
      .catch(() => {});

    // ── PRICIER → customer approval (never force-charge) ──
    if (priceCase === 'PRICIER') {
      if (!booking.clientId) {
        throw new Error(
          'Cannot reassign a guest booking to a pricier cleaner — guests cannot approve top-ups'
        );
      }
      const topupAmount = Math.round(diff * 100) / 100;
      const result = await enterAdminReassignProvisional({
        bookingId,
        newCleanerId,
        provisionalPrice: quote.customerTotal,
        topupAmount,
        originalPrice: originalTotal,
        previousStatus: booking.status,
        previousCleanerId: booking.cleanerId,
        eligibleStatuses: REASSIGN_ELIGIBLE,
        bookingDate: booking.date,
        startTime: booking.startTime,
        customerEmail: booking.client?.email ?? null,
        customerName: booking.client?.name ?? null,
      });
      if (!result.success) throw new Error(result.reason || 'Reassign failed');

      await AuditService.log({
        userId: adminId,
        action: 'ADMIN_REASSIGN_BOOKING',
        entityType: 'Booking',
        entityId: bookingId,
        metadata: {
          previousCleanerId: booking.cleanerId,
          newCleanerId,
          reason,
          priceCase: 'PRICIER',
          topupAmount,
          provisional: true,
        },
      });
      return {
        outcome: 'PROVISIONAL',
        priceCase: 'PRICIER',
        topupAmount,
        approvalExpiresAt: result.approvalExpiresAt,
      };
    }

    // ── EQUAL (|diff| <= threshold) → direct swap, adjust split, no refund ──
    if (priceCase === 'EQUAL') {
      const claim = await prisma.booking.updateMany({
        where: {
          id: bookingId,
          status: { in: REASSIGN_ELIGIBLE },
          transferStatus: { in: ['PENDING', 'FAILED'] },
        },
        data: {
          cleanerId: newCleanerId,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          cleanerEarnings: quote.cleanerPayout,
          platformFee: quote.customerPlatformFee,
          ...cascadeTeardownFields(),
          adminNotes: `Reassigned (equal price): ${reason}. Previous cleaner: ${booking.cleanerId}`,
        },
      });
      if (claim.count === 0) throw new Error('Booking changed state — reassign aborted');

      await AdminOperationsService.notifyReassign(booking, newCleanerId);
      await AuditService.log({
        userId: adminId,
        action: 'ADMIN_REASSIGN_BOOKING',
        entityType: 'Booking',
        entityId: bookingId,
        metadata: {
          previousCleanerId: booking.cleanerId,
          newCleanerId,
          reason,
          priceCase: 'EQUAL',
        },
      });
      return { outcome: 'REASSIGNED', priceCase: 'EQUAL' };
    }

    // ── CHEAPER (diff < -threshold) → swap + refund (mirror reconciliation) ──
    // Earnings/fee set in the atomic claim so the assigned cleaner's pricing is
    // correct even if the refund later fails. totalPrice is set via the refund
    // override on success; on refund failure it stays at the old (paid) value —
    // the correct refundable base for an admin retry, not a strand.
    const claim = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: { in: REASSIGN_ELIGIBLE },
        transferStatus: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        cleanerId: newCleanerId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        cleanerEarnings: quote.cleanerPayout,
        platformFee: quote.customerPlatformFee,
        ...cascadeTeardownFields(),
        adminNotes: `Reassigned (cheaper): ${reason}. Previous cleaner: ${booking.cleanerId}`,
      },
    });
    if (claim.count === 0) throw new Error('Booking changed state — reassign aborted');

    const refundAmount = Math.round(Math.abs(diff) * 100) / 100;
    const { refundBooking } = await import('./refund.service');
    const refundResult = await refundBooking(
      bookingId,
      refundAmount,
      `Admin reassign to cheaper cleaner: ${reason}`,
      {
        triggeredBy: adminId,
        adjustEarnings: false,
        bookingDataOverride: { totalPrice: quote.customerTotal },
      }
    );

    await AdminOperationsService.notifyReassign(booking, newCleanerId);
    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_REASSIGN_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        previousCleanerId: booking.cleanerId,
        newCleanerId,
        reason,
        priceCase: 'CHEAPER',
        refundAmount,
        refundStatus: refundResult.status,
      },
    });

    if (refundResult.status === 'FAILED') {
      // Swap stands; refund failed — admin must investigate (same posture as
      // reconciliation's cheaper path). Earnings/fee already correct; totalPrice
      // stays at the paid value for retry-refund.
      return {
        outcome: 'REASSIGNED',
        priceCase: 'CHEAPER',
        refundAmount,
        warning: `Swap OK, refund failed: ${refundResult.reason}`,
      };
    }
    return { outcome: 'REASSIGNED', priceCase: 'CHEAPER', refundAmount };
  }

  /**
   * Read-only preview of a reassign: runs the SAME guards + quote as
   * reassignBooking (via the shared validateAndQuote helper) and reports the
   * price case + amounts so an admin can review before committing. Throws the
   * same guard errors as execution. Mutates nothing.
   */
  static async previewReassign(
    bookingId: string,
    newCleanerId: string
  ): Promise<{
    priceCase: ReassignPriceCase;
    originalTotal: number;
    newTotal: number;
    diff: number;
    topupAmount?: number;
    refundAmount?: number;
    newCleanerName: string;
    isGuest: boolean;
  }> {
    const { booking, quote, originalTotal, diff, priceCase, newCleanerName } =
      await AdminOperationsService.validateAndQuote(bookingId, newCleanerId);

    if (priceCase === 'PRICIER' && !booking.clientId) {
      throw new Error(
        'Cannot reassign a guest booking to a pricier cleaner — guests cannot approve top-ups'
      );
    }

    return {
      priceCase,
      originalTotal,
      newTotal: quote.customerTotal,
      diff: Math.round(diff * 100) / 100,
      topupAmount: priceCase === 'PRICIER' ? Math.round(diff * 100) / 100 : undefined,
      refundAmount: priceCase === 'CHEAPER' ? Math.round(Math.abs(diff) * 100) / 100 : undefined,
      newCleanerName,
      isGuest: !booking.clientId,
    };
  }

  /**
   * Shared guard + quote path for reassign. Loads the booking, applies all
   * guards (eligible status, money-not-in-flight, valid non-suspended cleaner),
   * quotes the new cleaner, and derives the price case. Read-only — both
   * reassignBooking and previewReassign route through it so they cannot drift.
   */
  private static async validateAndQuote(bookingId: string, newCleanerId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        transferStatus: true,
        cleanerId: true,
        clientId: true,
        serviceType: true,
        propertySize: true,
        duration: true,
        extras: true,
        totalPrice: true,
        date: true,
        startTime: true,
        client: { select: { email: true, name: true } },
      },
    });
    if (!booking) throw new Error('Booking not found');

    // Guard: eligible status
    if (!REASSIGN_ELIGIBLE.includes(booking.status)) {
      throw new Error(`Cannot reassign a ${booking.status} booking`);
    }

    // Guard: money in flight — hard-block post-release (James decision 2)
    if (booking.transferStatus !== 'PENDING' && booking.transferStatus !== 'FAILED') {
      if (booking.transferStatus === 'RELEASED' || booking.transferStatus === 'RELEASING') {
        throw new Error("Funds already released; handle the old cleaner's payout first.");
      }
      throw new Error(`Cannot reassign — transfer status is ${booking.transferStatus}`);
    }

    // Guard: new cleaner valid, not suspended, has a cleaner profile
    if (newCleanerId === booking.cleanerId) {
      throw new Error('Booking is already assigned to this cleaner');
    }
    const newCleaner = await prisma.user.findUnique({
      where: { id: newCleanerId },
      select: {
        id: true,
        name: true,
        role: true,
        isSuspended: true,
        cleanerProfile: { select: { id: true } },
      },
    });
    if (!newCleaner || newCleaner.role !== 'CLEANER' || !newCleaner.cleanerProfile) {
      throw new Error('New cleaner is not a valid cleaner');
    }
    if (newCleaner.isSuspended) throw new Error('New cleaner is suspended');

    // Quote the new cleaner — same fn reconciliation uses (no parallel calc)
    let pricingSlug: ReturnType<typeof normalizeToPricingSlug>;
    try {
      pricingSlug = normalizeToPricingSlug(booking.serviceType);
    } catch {
      throw new Error(`Unknown service type: ${booking.serviceType}`);
    }
    const propertySize = booking.propertySize
      ? propertySizeEnumToSlug(booking.propertySize as PropertySize)
      : undefined;
    const quote = await pricingService.calculateQuote({
      cleanerId: newCleanerId,
      serviceSlug: pricingSlug as ServiceSlug,
      hours: Number(booking.duration),
      propertySize,
      addons: booking.extras,
    });

    const originalTotal = Number(booking.totalPrice);
    const diff = quote.customerTotal - originalTotal;
    const priceCase: ReassignPriceCase =
      diff > PRICE_ABSORPTION_THRESHOLD
        ? 'PRICIER'
        : diff < -PRICE_ABSORPTION_THRESHOLD
          ? 'CHEAPER'
          : 'EQUAL';

    return {
      booking,
      newCleanerName: newCleaner.name ?? newCleanerId,
      quote,
      originalTotal,
      diff,
      priceCase,
    };
  }

  /** Best-effort notifications for an immediate (equal/cheaper) reassign. */
  private static async notifyReassign(
    booking: { id: string; cleanerId: string; clientId: string | null },
    newCleanerId: string
  ): Promise<void> {
    await prisma.notification
      .create({
        data: {
          userId: booking.cleanerId,
          type: 'SYSTEM',
          title: 'Booking reassigned',
          body: 'This booking has been reassigned to another cleaner by our team.',
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
    await prisma.notification
      .create({
        data: {
          userId: newCleanerId,
          type: 'BOOKING_CONFIRMED',
          title: 'New booking assigned',
          body: 'You have been assigned a booking by our team.',
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
    if (booking.clientId) {
      await prisma.notification
        .create({
          data: {
            userId: booking.clientId,
            type: 'SYSTEM',
            title: 'Your cleaner has changed',
            body: 'We have assigned a different cleaner to your booking.',
            data: { bookingId: booking.id },
          },
        })
        .catch(() => {});
    }
  }

  /**
   * Cancel a booking as an admin. Routes through the shared cancellation path
   * (status + money-state guards, atomic claim, cascade teardown, refund, email,
   * notifications, audit). Refund defaults to 100% of the remainder; pass
   * refundAmount to override with an explicit amount (capped at the remainder).
   */
  static async adminCancelBooking(
    bookingId: string,
    reason: string,
    adminId?: string,
    refundAmount?: number
  ): Promise<CancellationResult> {
    const refund: RefundDirective =
      refundAmount !== undefined ? { kind: 'amount', amount: refundAmount } : { kind: 'full' };

    const result = await executeCancellation({
      bookingId,
      cancelledBy: 'admin',
      reason,
      adminId,
      refund,
    });

    if (!result.ok) throw new Error(result.error || 'Cancel failed');
    return result;
  }

  /**
   * Issue refund for a booking
   */
  static async issueRefund(bookingId: string, amount: number, reason: string, adminId?: string) {
    const { refundBooking } = await import('./refund.service');
    const result = await refundBooking(bookingId, amount, reason, { triggeredBy: adminId });
    if (result.status === 'FAILED') {
      throw new Error(result.reason || 'Refund failed');
    }
    return result;
  }

  /**
   * Suspend a cleaner
   */
  static async suspendCleaner(userId: string, reason: string, adminId?: string) {
    const result = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isSuspended: true, accountStatus: 'SUSPENDED' },
      }),
      prisma.cleanerProfile.update({
        where: { userId },
        data: { availableNow: false },
      }),
    ]);

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_SUSPEND_USER',
      entityType: 'User',
      entityId: userId,
      metadata: { reason },
    });

    return result;
  }

  /**
   * Reactivate a suspended cleaner
   */
  static async reactivateCleaner(userId: string, adminId?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, accountStatus: 'ACTIVE' },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_REACTIVATE_USER',
      entityType: 'User',
      entityId: userId,
    });

    return user;
  }

  /**
   * Moderate a review
   */
  static async moderateReview(
    reviewId: string,
    action: 'VISIBLE' | 'HIDDEN' | 'FLAGGED',
    adminId?: string
  ) {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { visibility: action, isModerated: true },
    });

    // Recompute stored rating — visibility change affects the blended average.
    // Without this, hiding a review would leave the stored rating inflated.
    await updateStoredRating(review.cleanerId);

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_MODERATE_REVIEW',
      entityType: 'Review',
      entityId: reviewId,
      metadata: { moderationAction: action },
    });

    return review;
  }

  /**
   * Resolve a dispute — three outcomes:
   *
   * release-to-cleaner: cleaner did their job → dispute RESOLVED, booking back
   *   to COMPLETED, PAUSED → PENDING → release (full earnings to cleaner).
   *
   * refund-customer: cleaner failed → dispute RESOLVED, refundBooking(full),
   *   booking → CANCELLED, transferStatus → REFUNDED (terminal).
   *
   * split: partial fault → dispute RESOLVED, refundBooking(partial),
   *   transferStatus → PENDING (release reduced earnings), booking → COMPLETED.
   *
   * STATUS-FIRST ORDERING (mirrors cancellation): the atomic $transaction
   * transitions the dispute + booking OUT of DISPUTED *before* any money
   * movement. This ensures refundBooking sees a non-DISPUTED booking (passing
   * the DISPUTED guard), and releaseBookingFunds can claim PENDING.
   */
  static async resolveDispute(params: {
    disputeId: string;
    outcome: 'release-to-cleaner' | 'refund-customer' | 'split';
    resolution: string;
    refundAmount?: number;
    adminId: string;
  }): Promise<DisputeResolveResult> {
    const { disputeId, outcome, resolution, adminId } = params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            transferStatus: true,
            totalAmountCharged: true,
            totalPrice: true,
            cleanerId: true,
            clientId: true,
            date: true,
            completedAt: true,
            refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
          },
        },
      },
    });
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error(`Dispute is already ${dispute.status.toLowerCase()}`);
    }
    if (dispute.booking.status !== 'DISPUTED') {
      throw new Error(`Booking is ${dispute.booking.status}, not DISPUTED`);
    }

    const bookingId = dispute.bookingId;
    const totalPaid = Number(dispute.booking.totalAmountCharged ?? dispute.booking.totalPrice);
    const alreadyRefunded = dispute.booking.refundRecords.reduce((s, r) => s + Number(r.amount), 0);
    const remainder = Math.max(0, totalPaid - alreadyRefunded);

    if (outcome === 'split' || outcome === 'refund-customer') {
      const refundAmount = outcome === 'refund-customer' ? remainder : params.refundAmount;
      if (refundAmount === undefined || refundAmount <= 0) {
        throw new Error('A refund amount is required for this outcome');
      }
      if (refundAmount > remainder + 0.01) {
        throw new Error(
          `Refund £${refundAmount.toFixed(2)} exceeds refundable remainder £${remainder.toFixed(2)}`
        );
      }
    }

    // Atomic status-first: resolve the dispute + transition booking out of
    // DISPUTED *before* any money movement. The guarded updateMany prevents a
    // concurrent resolve from double-acting.
    const nextBookingStatus: BookingStatus =
      outcome === 'refund-customer' ? 'CANCELLED' : 'COMPLETED';

    const claim = await prisma.$transaction([
      prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'RESOLVED', resolution, resolvedAt: new Date() },
      }),
      prisma.booking.updateMany({
        where: { id: bookingId, status: 'DISPUTED' },
        data: {
          status: nextBookingStatus,
          ...(outcome === 'refund-customer'
            ? { cancelledAt: new Date(), cancellationReason: `Dispute resolved: ${resolution}` }
            : {}),
          // H81: a booking disputed straight from IN_PROGRESS never had
          // completedAt written — landing it in COMPLETED with a null
          // completedAt made it invisible on every completedAt-keyed earnings
          // surface (page, dashboard, statement). Stamp resolution time only
          // when no true completion time exists.
          ...(nextBookingStatus === 'COMPLETED' && !dispute.booking.completedAt
            ? { completedAt: new Date() }
            : {}),
        },
      }),
    ]);

    if (claim[1].count === 0) {
      throw new Error('Booking changed state — resolve aborted');
    }

    // Money movement (best-effort — booking already transitioned).
    let refundStatus: string | undefined;
    let refundedAmount = 0;
    let releaseStatus: string | undefined;

    if (outcome === 'refund-customer') {
      const { refundBooking } = await import('./refund.service');
      const result = await refundBooking(bookingId, remainder, `Dispute resolved: ${resolution}`, {
        triggeredBy: adminId,
        bookingDataOverride: {
          cancelledAt: new Date(),
          cancellationReason: `Dispute resolved: ${resolution}`,
        },
      });
      refundStatus = result.status;
      refundedAmount = result.amountRefunded ?? 0;
    } else if (outcome === 'split') {
      // Safe: the guard above already rejected split without a positive refundAmount.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const refundAmount = params.refundAmount!;
      const { refundBooking } = await import('./refund.service');
      const result = await refundBooking(
        bookingId,
        refundAmount,
        `Dispute resolved (split): ${resolution}`,
        { triggeredBy: adminId }
      );
      refundStatus = result.status;
      refundedAmount = result.amountRefunded ?? 0;

      // After a successful partial refund, transferStatus is already PENDING
      // (writeRefundSuccess: partial pre-release → PENDING). Call release
      // directly — resumePausedRelease would find PENDING, not PAUSED.
      if (result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED') {
        const release = await releaseBookingFunds(bookingId, {
          trigger: 'DISPUTE_RESOLUTION',
          actorId: adminId,
        }).catch(() => ({
          status: 'FAILED' as const,
          reason: 'Release after split refund failed — admin retry needed',
        }));
        releaseStatus = release.status;
      }
    } else {
      // release-to-cleaner: un-pause and release full earnings. H68: caught
      // like the split leg — the booking is already resolved (claim-first), so
      // an unexpected release throw must NOT swallow the notifications below;
      // a FAILED release is admin-retryable, silent parties are not.
      const release = await resumePausedRelease(bookingId, {
        trigger: 'DISPUTE_RESOLUTION',
        actorId: adminId,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[Dispute] release-to-cleaner release threw for ${bookingId}:`, err);
        return {
          status: 'FAILED' as const,
          reason: 'Release threw during dispute resolution — admin retry needed',
        };
      });
      releaseStatus = release.status;
    }

    // Notify both parties (best-effort): bell rows AND emails (H62 — the rule:
    // every resolution emails both parties with outcome + money + timeline; a
    // successful refund adds the standard refund confirmation).
    await notifyDisputeResolved(dispute.booking, outcome, resolution).catch(() => {});
    {
      const { sendDisputeResolutionEmails } = await import('./email.service');
      const approvedRefund =
        outcome === 'refund-customer'
          ? remainder
          : outcome === 'split'
            ? params.refundAmount
            : undefined;
      // H68: a resolution email dying SILENTLY is the H62 disease one layer
      // down — failures log loudly (recoverable from prod logs).
      await sendDisputeResolutionEmails({
        bookingId,
        outcome,
        refundAmount: refundedAmount > 0 ? refundedAmount : approvedRefund,
        refundSucceeded: refundStatus === 'REFUNDED' || refundStatus === 'PARTIALLY_REFUNDED',
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[DisputeEmail] resolution emails FAILED for ${bookingId}:`, err);
      });
    }

    // Audit.
    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_RESOLVE_DISPUTE',
      entityType: 'Dispute',
      entityId: disputeId,
      metadata: {
        bookingId,
        outcome,
        resolution,
        refundedAmount,
        refundStatus,
        releaseStatus,
      },
    }).catch(() => {});

    return { outcome, refundedAmount, refundStatus, releaseStatus };
  }
}

// ─── Dispute notification helper (best-effort) ──────────────

async function notifyDisputeResolved(
  booking: { cleanerId: string; clientId: string | null; date: Date },
  outcome: 'release-to-cleaner' | 'refund-customer' | 'split',
  resolution: string
): Promise<void> {
  const dateStr = booking.date.toLocaleDateString('en-GB');

  const outcomeMessages: Record<typeof outcome, { cleaner: string; customer: string }> = {
    'release-to-cleaner': {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved in your favour. Your payment will be released.`,
      customer: `The dispute on your booking (${dateStr}) has been reviewed and resolved. The cleaner will be paid as normal.`,
    },
    'refund-customer': {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved. The customer has been refunded.`,
      customer: `The dispute on your booking (${dateStr}) has been resolved in your favour. A full refund is being processed.`,
    },
    split: {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved with a partial adjustment. Your reduced payment will be released.`,
      customer: `The dispute on your booking (${dateStr}) has been resolved. A partial refund is being processed.`,
    },
  };

  const msgs = outcomeMessages[outcome];

  await prisma.notification
    .create({
      data: {
        userId: booking.cleanerId,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute resolved',
        body: msgs.cleaner,
        data: { resolution },
      },
    })
    .catch(() => {});

  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'DISPUTE_RESOLVED',
          title: 'Dispute resolved',
          body: msgs.customer,
          data: { resolution },
        },
      })
      .catch(() => {});
  }
}
