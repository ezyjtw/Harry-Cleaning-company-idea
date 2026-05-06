import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';

export class AdminOperationsService {
  /**
   * Manually assign a cleaner to a booking
   */
  static async assignCleaner(bookingId: string, cleanerId: string, adminId?: string) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { cleanerId, status: 'CONFIRMED', adminNotes: `Manually assigned by admin` },
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
   * Reassign booking to a different cleaner
   */
  static async reassignBooking(
    bookingId: string,
    newCleanerId: string,
    reason: string,
    adminId?: string
  ) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        cleanerId: newCleanerId,
        adminNotes: `Reassigned: ${reason}. Previous cleaner: ${booking.cleanerId}`,
      },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_REASSIGN_BOOKING',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { previousCleanerId: booking.cleanerId, newCleanerId, reason },
    });

    return updated;
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
    const payment = await prisma.payment.findUnique({ where: { bookingId } });
    if (!payment) throw new Error('Payment not found');

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: amount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundAmount: amount,
      },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_ISSUE_REFUND',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { bookingId, amount, reason, originalAmount: Number(payment.amount) },
    });

    return updated;
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

    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'RESOLVED', resolution, resolvedAt: new Date() },
      });

      if (refundAction !== 'none' && dispute.booking.payment && refundAmount) {
        await tx.payment.update({
          where: { id: dispute.booking.payment.id },
          data: {
            status: refundAction === 'full' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundAmount,
          },
        });
      }
    });

    await AuditService.log({
      action: 'ADMIN_RESOLVE_DISPUTE',
      entityType: 'Dispute',
      entityId: disputeId,
      metadata: { resolution, refundAction, refundAmount },
    });
  }
}
