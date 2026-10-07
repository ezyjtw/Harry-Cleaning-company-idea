// B3.2 (RENA-028, RENA-027, RENA-032): the cleaner jobs PATCH, as one
// function the route and the concurrency matrix both call. Every write is a
// CAS through transitionBooking or the shared accept; the side effects
// (customer bell, completedJobs, audit, review request) run only for the
// writer that won, so a double tap writes once and notifies once.

import type { BookingStatus } from '@prisma/client';

import prisma from '@/lib/db/prisma';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';
import { formatLondonClock } from '@/lib/time/booking-time';

import { acceptOfferAsCleaner } from './accept-offer';
import { CLEANER_TRANSITIONS, transitionBooking, type TransitionTarget } from './transition';

export interface TransitionReply {
  status: number;
  body: Record<string, unknown>;
}

const TARGET_WORDS: Record<string, string> = {
  EN_ROUTE: 'On my way',
  IN_PROGRESS: 'Start',
  COMPLETED: 'Mark complete',
};

export async function applyCleanerTransition(params: {
  bookingId: string;
  cleanerId: string;
  to: string;
  notes?: string;
  cancellationReason?: string;
  now?: Date;
}): Promise<TransitionReply> {
  const { bookingId: id, cleanerId, to } = params;

  const booking = await prisma.booking.findFirst({ where: { id, cleanerId } });
  if (!booking) return { status: 404, body: { error: 'Job not found' } };

  // A repeat of a move that already landed (a double tap, a retry) is the
  // stale-read case: answer as the losing CAS does, so the client refetches.
  if (booking.status === to) {
    return {
      status: 409,
      body: {
        error: 'STATE_CHANGED',
        hint: 'refetch',
        message: 'This job changed a moment ago. It has been refreshed.',
      },
    };
  }

  const allowed = CLEANER_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(to as BookingStatus)) {
    return {
      status: 400,
      body: {
        error: `Invalid transition from ${booking.status} to ${to}. Allowed: ${allowed.join(', ') || 'none'}`,
      },
    };
  }

  // M3 RESCUE: a cleaner cancelling a PAID job routes through the rescue flow
  // (already a guarded claim). Unpaid bookings take the CAS cancel below.
  if (
    to === 'CANCELLED' &&
    (booking.paymentStatus === 'SUCCEEDED' || booking.paymentStatus === 'PARTIALLY_REFUNDED')
  ) {
    const { initiateCleanerCancelRescue } = await import('@/lib/services/rescue.service');
    const rescue = await initiateCleanerCancelRescue({
      bookingId: id,
      cleanerId,
      reason: params.cancellationReason,
    });
    if (!rescue.ok) return { status: 409, body: { error: rescue.reason } };
    return {
      status: 200,
      body: {
        success: true,
        job: { id, status: 'CLEANER_CANCELLED' },
        message:
          'Job cancelled. The customer has been offered a full refund or help rebooking — their payment stays protected.',
      },
    };
  }

  // B3 (deviation 8, ruled): the legacy ACCEPTED branch is the accept route's
  // own function, price reconciliation included.
  if (to === 'ACCEPTED') {
    return acceptOfferAsCleaner(id, cleanerId);
  }

  const result = await transitionBooking({
    booking,
    cleanerId,
    to: to as TransitionTarget,
    now: params.now,
    actor: { kind: 'CLEANER', id: cleanerId },
    notes: params.notes,
    cancellationReason: params.cancellationReason,
  });

  if (!result.ok) {
    if (result.code === 'TOO_EARLY') {
      return {
        status: 422,
        body: {
          error: 'TOO_EARLY',
          target: to,
          opensAt: result.opensAt.toISOString(),
          message: `You can set ${TARGET_WORDS[to] ?? to} from ${formatLondonClock(result.opensAt)}.`,
        },
      };
    }
    if (result.code === 'NEEDS_START') {
      return {
        status: 400,
        body: {
          error: 'NEEDS_START',
          message: 'Start the clean before you mark it complete.',
        },
      };
    }
    if (result.code === 'STATE_CHANGED') {
      return {
        status: 409,
        body: {
          error: 'STATE_CHANGED',
          hint: 'refetch',
          message: 'This job changed a moment ago. It has been refreshed.',
        },
      };
    }
    return {
      status: 400,
      body: {
        error: `Invalid transition from ${booking.status} to ${to}. Allowed: ${result.allowed.join(', ') || 'none'}`,
      },
    };
  }

  const updated = result.booking;

  // ─── Post-transition side effects (the winning writer only) ────────
  if (updated.clientId) {
    const notificationMap: Record<
      string,
      {
        type: 'BOOKING_CONFIRMED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED';
        title: string;
        body: string;
      }
    > = {
      EN_ROUTE: {
        type: 'BOOKING_CONFIRMED',
        title: 'Cleaner on the way',
        body: 'Your cleaner is on their way to your address.',
      },
      COMPLETED: {
        type: 'BOOKING_COMPLETED',
        title: 'Cleaning completed',
        body: "Your cleaning is complete — confirm if you're satisfied to release payment, or report a problem within 24 hours.",
      },
      CANCELLED: {
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: `Your booking for ${updated.date.toLocaleDateString('en-GB')} has been cancelled by the cleaner.`,
      },
    };
    const notif = notificationMap[to];
    if (notif) {
      await prisma.notification
        .create({
          data: {
            userId: updated.clientId,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            data: { bookingId: updated.id },
          },
        })
        .catch(() => {}); // Don't fail the request if notification fails
    }
  }

  if (to === 'COMPLETED') {
    await prisma.cleanerProfile
      .updateMany({
        where: { userId: cleanerId },
        data: { completedJobs: { increment: 1 } },
      })
      .catch(() => {});

    await prisma.auditLog
      .create({
        data: {
          userId: cleanerId,
          action: 'BOOKING_COMPLETED',
          entityType: 'Booking',
          entityId: updated.id,
          metadata: {
            cleanerEarnings: Number(updated.cleanerEarnings),
            totalPrice: Number(updated.totalPrice),
          },
        },
      })
      .catch(() => {});

    // H74: never a silent catch — a thrown review-request must say so in prod.
    await EnhancedNotificationService.sendReviewRequest(updated.id).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[ReviewRequest] Failed for booking ${updated.id}:`, e);
    });

    // R1-A (amended): guests get no review request (parked ruling), so their
    // regular-clean offer travels in a dedicated completion email — sent only
    // when the pair is offer-eligible (the sender logs a named skip otherwise).
    const { sendGuestCompletionOffer } = await import('@/lib/services/email.service');
    await sendGuestCompletionOffer(updated.id).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[RegularOffer] Guest completion email failed for ${updated.id}:`, e);
    });
  }

  return {
    status: 200,
    body: {
      message: `Job status updated to ${to}`,
      job: { id: updated.id, status: updated.status },
    },
  };
}
