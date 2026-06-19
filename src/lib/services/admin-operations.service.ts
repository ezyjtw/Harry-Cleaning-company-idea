import type { BookingStatus, PropertySize } from '@prisma/client';

import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';
import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { enterAdminReassignProvisional } from './cascade.service';
import { PRICE_ABSORPTION_THRESHOLD, pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';

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
          ...AdminOperationsService.cascadeTeardown(),
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
        ...AdminOperationsService.cascadeTeardown(),
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

  /** Cascade-state teardown written on a direct (equal/cheaper) reassign. */
  private static cascadeTeardown() {
    return {
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      provisionalCleanerId: null,
      provisionalPrice: null,
      topupAmount: null,
      approvalExpiresAt: null,
      topupApproved: false,
      reserveCleanerIds: [],
      provisionalSource: null,
      reassignPreviousStatus: null,
      reassignPreviousCleanerId: null,
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
   * Cancel booking with admin override
   */
  static async adminCancelBooking(bookingId: string, reason: string, adminId?: string) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        adminNotes: `Cancelled by admin: ${reason}`,
      },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_CANCEL_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason },
    });

    return booking;
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
   * Resolve a dispute
   */
  static async resolveDispute(
    disputeId: string,
    resolution: string,
    refundAction?: 'full' | 'partial' | 'none',
    refundAmount?: number
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { booking: { include: { payment: true } } },
    });
    if (!dispute) throw new Error('Dispute not found');

    await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'RESOLVED', resolution, resolvedAt: new Date() },
    });

    if (refundAction !== 'none' && refundAmount) {
      const { refundBooking } = await import('./refund.service');
      await refundBooking(dispute.bookingId, refundAmount, `Dispute resolved: ${resolution}`);
    }

    await AuditService.log({
      action: 'ADMIN_RESOLVE_DISPUTE',
      entityType: 'Dispute',
      entityId: disputeId,
      metadata: { resolution, refundAction, refundAmount },
    });
  }
}
