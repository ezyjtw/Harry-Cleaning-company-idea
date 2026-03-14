import { prisma } from '@/lib/db/prisma';

export class AdminOperationsService {
  /**
   * Manually assign a cleaner to a booking
   */
  static async assignCleaner(bookingId: string, cleanerId: string) {
    return prisma.booking.update({
      where: { id: bookingId },
      data: { cleanerId, status: 'CONFIRMED', adminNotes: `Manually assigned by admin` },
    });
  }

  /**
   * Reassign booking to a different cleaner
   */
  static async reassignBooking(bookingId: string, newCleanerId: string, reason: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');

    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        cleanerId: newCleanerId,
        adminNotes: `Reassigned: ${reason}. Previous cleaner: ${booking.cleanerId}`,
      },
    });
  }

  /**
   * Cancel booking with admin override
   */
  static async adminCancelBooking(bookingId: string, reason: string) {
    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        adminNotes: `Cancelled by admin: ${reason}`,
      },
    });
  }

  /**
   * Issue refund for a booking
   */
  static async issueRefund(bookingId: string, amount: number, _reason: string) {
    const payment = await prisma.payment.findUnique({ where: { bookingId } });
    if (!payment) throw new Error('Payment not found');

    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: amount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundAmount: amount,
      },
    });
  }

  /**
   * Suspend a cleaner
   */
  static async suspendCleaner(userId: string, _reason: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isSuspended: true, accountStatus: 'SUSPENDED' },
      }),
      prisma.cleanerProfile.update({
        where: { userId },
        data: { availableNow: false },
      }),
    ]);
  }

  /**
   * Reactivate a suspended cleaner
   */
  static async reactivateCleaner(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, accountStatus: 'ACTIVE' },
    });
  }

  /**
   * Moderate a review
   */
  static async moderateReview(reviewId: string, action: 'VISIBLE' | 'HIDDEN' | 'FLAGGED') {
    return prisma.review.update({
      where: { id: reviewId },
      data: { visibility: action, isModerated: true },
    });
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

    return prisma.$transaction(async (tx) => {
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
  }
}
