import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

import { MatchingService } from './matching.service';
import type { MatchingCriteria, CleanerMatch } from './matching.service';

export interface AssignmentResult {
  success: boolean;
  cleanerId?: string;
  cleanerName?: string;
  reason?: string;
  fallbackOptions?: CleanerMatch[];
}

export class AutoAssignmentService {
  /**
   * Automatically assign a cleaner to a booking
   */
  static async assignCleaner(
    bookingId: string,
    criteria: MatchingCriteria
  ): Promise<AssignmentResult> {
    const bestMatch = await MatchingService.autoAssign(criteria);

    if (!bestMatch) {
      // Get all matches including unavailable for fallback
      const allMatches = await MatchingService.findMatches(criteria);
      return {
        success: false,
        reason: 'No available cleaners match your criteria',
        fallbackOptions: allMatches.matches.slice(0, 5),
      };
    }

    // Update booking with assigned cleaner
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        cleanerId: bestMatch.userId,
        status: 'CONFIRMED',
      },
    });

    // Create notification for the cleaner
    await prisma.notification.create({
      data: {
        userId: bestMatch.userId,
        type: 'BOOKING_REQUEST',
        title: 'New Booking Assignment',
        body: `You have been assigned a new booking. Please review and accept.`,
        data: { bookingId } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      cleanerId: bestMatch.userId,
      cleanerName: bestMatch.name,
    };
  }

  /**
   * Handle cleaner rejecting an assignment — auto-reassign to next best
   */
  static async handleRejection(
    bookingId: string,
    rejectedCleanerId: string,
    criteria: MatchingCriteria
  ): Promise<AssignmentResult> {
    // Find next available cleaner (excluding rejected one)
    const result = await MatchingService.findMatches(criteria);
    const available = result.matches.filter((m) => m.isAvailable && m.userId !== rejectedCleanerId);

    if (available.length === 0) {
      // Move booking back to pending
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'PENDING' },
      });

      return {
        success: false,
        reason: 'No other available cleaners. Booking returned to pending.',
      };
    }

    const nextBest = available[0];

    // Reassign
    await prisma.booking.update({
      where: { id: bookingId },
      data: { cleanerId: nextBest.userId, status: 'CONFIRMED' },
    });

    // Notify new cleaner
    await prisma.notification.create({
      data: {
        userId: nextBest.userId,
        type: 'BOOKING_REQUEST',
        title: 'New Booking Assignment',
        body: 'You have been assigned a new booking. Please review and accept.',
        data: { bookingId } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      cleanerId: nextBest.userId,
      cleanerName: nextBest.name,
    };
  }

  /**
   * Notify assigned cleaner and start acceptance timer
   */
  static async notifyAndWaitForAcceptance(
    bookingId: string,
    cleanerId: string,
    timeoutMinutes: number = 30
  ): Promise<void> {
    // Schedule a timeout job — if cleaner doesn't accept, auto-reassign
    await prisma.backgroundJob.create({
      data: {
        type: 'SEND_REMINDER',
        payload: {
          bookingId,
          cleanerId,
          action: 'ACCEPTANCE_TIMEOUT',
        } as Prisma.InputJsonValue,
        scheduledAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
      },
    });
  }
}
