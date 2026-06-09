import type { BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['AWAITING_CLEANER', 'CANCELLED'],
  AWAITING_CLEANER: ['ACCEPTED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['REVIEWED'],
  REVIEWED: [],
  CANCELLED: [],
  CASCADE_EXHAUSTED: ['CANCELLED'],
};

export interface BookingTransitionResult {
  success: boolean;
  booking?: {
    id: string;
    status: string;
  };
  error?: string;
}

export class BookingLifecycleService {
  /**
   * Validate that a status transition is allowed
   */
  static isValidTransition(from: string, to: string): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Transition a booking to a new status with timestamp tracking
   */
  static async transition(
    bookingId: string,
    newStatus: BookingStatus,
    options?: {
      cancelledBy?: 'client' | 'cleaner' | 'admin';
      cancellationReason?: string;
      cleanerNotes?: string;
      adminNotes?: string;
    }
  ): Promise<BookingTransitionResult> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (!this.isValidTransition(booking.status, newStatus)) {
      return {
        success: false,
        error: `Cannot transition from ${booking.status} to ${newStatus}`,
      };
    }

    // Build update data with appropriate timestamps
    const updateData: Record<string, unknown> = { status: newStatus };
    const now = new Date();

    switch (newStatus) {
      case 'ACCEPTED':
        updateData.acceptedAt = now;
        break;
      case 'EN_ROUTE':
        break;
      case 'IN_PROGRESS':
        updateData.checkedInAt = now;
        updateData.arrivalConfirmed = true;
        break;
      case 'COMPLETED':
        updateData.completedAt = now;
        break;
      case 'CANCELLED':
        updateData.cancelledAt = now;
        if (options?.cancellationReason) {
          updateData.cancellationReason = options.cancellationReason;
        }
        break;
    }

    if (options?.cleanerNotes) updateData.cleanerNotes = options.cleanerNotes;
    if (options?.adminNotes) updateData.adminNotes = options.adminNotes;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    return { success: true, booking: { id: updated.id, status: updated.status } };
  }

  /**
   * Get the next valid statuses for a booking
   */
  static getNextStatuses(currentStatus: string): string[] {
    return VALID_TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Check if a booking can be cancelled (based on timing)
   */
  static canCancel(
    bookingDate: Date,
    status: string
  ): { canCancel: boolean; refundPercent: number; reason?: string } {
    if (
      !['PENDING', 'AWAITING_CLEANER', 'CONFIRMED', 'ACCEPTED', 'CASCADE_EXHAUSTED'].includes(
        status
      )
    ) {
      return {
        canCancel: false,
        refundPercent: 0,
        reason: 'Booking cannot be cancelled in current status',
      };
    }

    const hoursUntilBooking = (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilBooking > 48) {
      return { canCancel: true, refundPercent: 100 };
    } else if (hoursUntilBooking > 24) {
      return { canCancel: true, refundPercent: 75 };
    } else if (hoursUntilBooking > 6) {
      return { canCancel: true, refundPercent: 50 };
    } else {
      return { canCancel: true, refundPercent: 0, reason: 'Less than 6 hours notice — no refund' };
    }
  }

  /**
   * Get cancellation fee amount
   */
  static calculateCancellationRefund(
    totalPrice: number,
    bookingDate: Date,
    status: string
  ): number {
    const { refundPercent } = this.canCancel(bookingDate, status);
    return Math.round(((totalPrice * refundPercent) / 100) * 100) / 100;
  }

  /**
   * Mark booking checklist as completed
   */
  static async completeChecklist(bookingId: string): Promise<void> {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { checklistCompleted: true },
    });
  }

  /**
   * Confirm cleaner arrival
   */
  static async confirmArrival(bookingId: string): Promise<BookingTransitionResult> {
    return this.transition(bookingId, 'IN_PROGRESS' as BookingStatus);
  }
}
