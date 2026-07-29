import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { notOwnBookingWhere, paidVisibleWhere } from '@/lib/booking/own-booking';
import prisma from '@/lib/db/prisma';
import { atomicAccept } from '@/lib/services/cascade.service';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';
import { getTransferAmountPence } from '@/lib/services/transfer-amount';
import { bookingFullAddress, bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';
import { haversineDistance, lookupPostcode } from '@/lib/utils/postcode';

type BookingStatus =
  | 'PENDING'
  | 'AWAITING_CLEANER'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CANCELLED'
  | 'DISPUTED';

// 4.6 (James-ruled): the cleaner flow is Accept → EN_ROUTE ("On my way") →
// COMPLETED ("Mark complete"). EN_ROUTE→COMPLETED is now legal; the
// EN_ROUTE→IN_PROGRESS and IN_PROGRESS→COMPLETED legs stay legal so legacy
// in-flight bookings (and the admin override) keep working.
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CANCELLED'],
  AWAITING_CLEANER: ['ACCEPTED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REVIEWED: [],
  CANCELLED: [],
  DISPUTED: [],
};

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      // H53: no payment → no visibility. A cleaner can't open an unpaid booking.
      ...paidVisibleWhere(),
      // H38: own customer purchase never opens through the job door.
      AND: [
        notOwnBookingWhere(user.id),
        {
          OR: [
            { cleanerId: user.id },
            {
              backupCleanerIds: { has: user.id },
              cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'RENA_FIND'] },
            },
          ],
        },
      ],
      NOT: { declinedCleanerIds: { has: user.id } },
    },
    include: {
      client: { select: { name: true, email: true } },
      address: true,
      // F24.1: occurrences must be visibly recurring on every surface.
      agreement: { select: { frequency: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // B3: offer context — "~25 min from home · your Tuesday is free".
  // Half 1: viewer's home point (CleanerProfile.latitude/longitude, dual-written
  // from homePostcode) → job postcode centroid (postcodes.io, 24h-cached) →
  // haversine miles at the crow-flies 25 mph convention → minutes. Null if
  // either point is unavailable (the UI simply omits that half).
  // Half 2: the viewer's other ACTIVE jobs on the offer's date (count).
  let travelMinutes: number | null = null;
  let sameDayJobs = 0;
  if (booking.status === 'AWAITING_CLEANER') {
    try {
      const [profile, geo, dayCount] = await Promise.all([
        prisma.cleanerProfile.findFirst({
          where: { userId: user.id },
          select: { latitude: true, longitude: true },
        }),
        lookupPostcode(bookingPostcode(booking) || ''),
        prisma.booking.count({
          where: {
            cleanerId: user.id,
            date: booking.date,
            status: { in: ['ACCEPTED', 'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS'] },
          },
        }),
      ]);
      sameDayJobs = dayCount;
      if (
        profile?.latitude !== null &&
        profile?.latitude !== undefined &&
        profile?.longitude !== null &&
        profile?.longitude !== undefined &&
        geo
      ) {
        const miles = haversineDistance(
          profile.latitude,
          profile.longitude,
          geo.latitude,
          geo.longitude
        );
        travelMinutes = Math.max(5, Math.round((miles / 25) * 60));
      }
    } catch {
      /* context is decorative — never block the offer on it */
    }
  }

  return NextResponse.json({
    job: {
      id: booking.id,
      status: booking.status,
      // H104: server-side authz truth — full guidance renders only for the
      // ASSIGNED cleaner post-accept; offered cleaners get the sanitised view.
      assigned:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED',
      // Offer-cascade fields (Rena Pro Offer screen: window countdown + accept routing).
      cascadePhase: booking.cascadePhase,
      cascadeExpiresAt: booking.cascadeExpiresAt ? booking.cascadeExpiresAt.toISOString() : null,
      clientName: booking.client?.name || booking.guestName || 'Guest',
      clientEmail: booking.client?.email || booking.guestEmail || '',
      // A12: read from booking columns (legacy relation fallback in helper).
      address:
        booking.status === 'PENDING' || booking.status === 'AWAITING_CLEANER'
          ? bookingPostcode(booking) || 'TBD'
          : `${bookingLine1(booking)}, ${bookingPostcode(booking)}`,
      fullAddress:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? bookingFullAddress(booking)
          : undefined,
      postcode: bookingPostcode(booking),
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      duration: Number(booking.duration),
      serviceType: booking.serviceType,
      // F24.1: non-null frequency marks a recurring occurrence.
      recurringFrequency: booking.agreement?.frequency ?? null,
      // F24.3: the customer total (6%-inclusive) is not the cleaner's business
      // and no longer rides this payload.
      // H104 money law: the figure shown is THE payout function's figure —
      // getTransferAmountPence is the single source of the transfer amount.
      cleanerEarnings: getTransferAmountPence(Number(booking.cleanerEarnings)) / 100,
      paymentStatus: booking.paymentStatus,
      // H104: customer guidance is assigned-cleaner-only — SERVER-side, not UI
      // hiding. Pre-accept offer recipients get none of it.
      notes:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? booking.notes
          : undefined,
      keyAccess:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? ((booking.rooms as Record<string, unknown>)?.keyAccess as string | undefined)
          : undefined,
      keyAccessNote:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? ((booking.rooms as Record<string, unknown>)?.keyAccessNote as string | undefined)
          : undefined,
      cleanerNotes: booking.cleanerNotes,
      // F12: cascade-state copy for the decline confirm ("offered to backups"
      // vs "we'll find the customer another cleaner"). A boolean, no ids.
      hasBackups: booking.backupCleanerIds.length > 0,
      // LB-7: supplies is DECISION-relevant, not sensitive — a cleaner without
      // a kit can't take a bring-your-own job. Unlike address/notes it is in
      // the sanitised PRE-ACCEPT safe set, alongside date/time/area/pay.
      suppliesProvided: booking.suppliesProvided,
      bedrooms: (booking.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
      extras: booking.extras,
      createdAt: booking.createdAt.toISOString(),
      context: { travelMinutes, sameDayJobs },
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { status, notes, cancellationReason } = body;

  const booking = await prisma.booking.findFirst({
    where: { id, cleanerId: user.id },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (!status || typeof status !== 'string') {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const allowed = VALID_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid transition from ${booking.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      },
      { status: 400 }
    );
  }

  // ANTI-FRAUD: a job may not be marked COMPLETED before the day it is scheduled.
  // Self-completion sets releaseDueAt and triggers auto-release of funds; without
  // this guard a cleaner could complete a FUTURE-DATED booking the instant the
  // customer pays and be paid for work never performed.
  //
  // We deliberately compare against the START OF THE BOOKING DAY, not date+startTime:
  // an exact start-time comparison would wrongly block legitimate same-day cases
  // (early arrival, a short job finished a little early, or timezone skew between
  // the stored UTC date and the local startTime — e.g. BST shifts it by an hour).
  // Same-day-but-early completion remains allowed here; the stronger control —
  // gating release on explicit customer confirmation — is the separately-flagged
  // follow-up (H1). This guard's job is purely to stop future-dating.
  if (status === 'COMPLETED') {
    const bookingDayStart = new Date(booking.date);
    bookingDayStart.setHours(0, 0, 0, 0);
    if (Date.now() < bookingDayStart.getTime()) {
      return NextResponse.json(
        { error: 'Cannot mark a job complete before its scheduled date.' },
        { status: 400 }
      );
    }
  }

  // M3 RESCUE: a cleaner cancelling a PAID job routes through the rescue flow —
  // the booking enters CLEANER_CANCELLED (holding state), the customer is
  // notified immediately with refund/rebook choices, and the timeout sweep
  // auto-refunds. The old path here flipped status to CANCELLED with no refund,
  // no email, and no re-offer — a paid customer was silently stranded.
  // Unpaid bookings keep the plain cancel below (nothing captured to protect).
  if (
    status === 'CANCELLED' &&
    (booking.paymentStatus === 'SUCCEEDED' || booking.paymentStatus === 'PARTIALLY_REFUNDED')
  ) {
    const { initiateCleanerCancelRescue } = await import('@/lib/services/rescue.service');
    const rescue = await initiateCleanerCancelRescue({
      bookingId: id,
      cleanerId: user.id,
      reason: cancellationReason,
    });
    if (!rescue.ok) {
      return NextResponse.json({ error: rescue.reason }, { status: 409 });
    }
    return NextResponse.json({
      success: true,
      job: { id, status: 'CLEANER_CANCELLED' },
      message:
        'Job cancelled. The customer has been offered a full refund or help rebooking — their payment stays protected.',
    });
  }

  // Superseded by POST /api/cleaner/jobs/[id]/accept — kept as fallback for direct PATCH callers
  // For ACCEPTED, use the atomic cascade-aware accept
  if (status === 'ACCEPTED') {
    const acceptResult = await atomicAccept(id, user.id);
    if (!acceptResult.success) {
      return NextResponse.json({ error: acceptResult.reason }, { status: 409 });
    }

    const accepted = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        cleaner: { select: { name: true } },
      },
    });

    if (accepted?.clientId) {
      await prisma.notification
        .create({
          data: {
            userId: accepted.clientId,
            type: 'BOOKING_CONFIRMED',
            title: 'Booking accepted',
            body: `Good news — ${accepted.cleaner?.name ?? 'your cleaner'} has taken your booking for ${accepted.date.toLocaleDateString('en-GB')}.`,
            data: { bookingId: accepted.id },
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      message: 'Job status updated to ACCEPTED',
      job: { id, status: 'ACCEPTED' },
    });
  }

  const updateData: Record<string, unknown> = {
    status: status as BookingStatus,
  };

  if (notes) updateData.cleanerNotes = notes;

  if (status === 'EN_ROUTE') updateData.arrivalConfirmed = true;
  if (status === 'IN_PROGRESS') updateData.checkedInAt = new Date();
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();

    const priorCompleted = await prisma.booking.count({
      where: {
        clientId: booking.clientId,
        cleanerId: booking.cleanerId,
        status: 'COMPLETED',
        id: { not: id },
      },
    });
    // X3 (James-ruled): repeat-customer self-completion hold is 6h (was 2h) —
    // widens the customer's dispute window. First booking stays 24h; instant
    // release on customer confirm is unchanged (confirm-complete sets
    // releaseDueAt to now in its own route). F16: a review never moves money —
    // this hold clock is the only auto-release timer.
    const holdHours = priorCompleted > 0 ? 6 : 24;
    updateData.releaseDueAt = new Date(Date.now() + holdHours * 3600_000);
  }
  if (status === 'CANCELLED') {
    updateData.cancelledAt = new Date();
    updateData.cancellationReason = cancellationReason || 'Cancelled by cleaner';
    // #6: null cascade fields on genuine cancellation (scheduler guards make them
    // harmless, but clean state is better)
    updateData.cascadePhase = null;
    updateData.cascadeExpiresAt = null;
    updateData.cascadeBackupExpiresAt = null;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true, email: true } },
    },
  });

  // ─── Post-transition side effects ────────────────────────

  // Notify customer of status changes
  if (updated.clientId) {
    const notificationMap: Record<
      string,
      {
        type: 'BOOKING_CONFIRMED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED';
        title: string;
        body: string;
      }
    > = {
      ACCEPTED: {
        type: 'BOOKING_CONFIRMED',
        title: 'Booking accepted',
        body: `Your cleaner has accepted your booking for ${updated.date.toLocaleDateString('en-GB')}.`,
      },
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

    const notif = notificationMap[status];
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

  // On completion: increment cleaner's completedJobs counter
  if (status === 'COMPLETED') {
    await prisma.cleanerProfile
      .updateMany({
        where: { userId: user.id },
        data: { completedJobs: { increment: 1 } },
      })
      .catch(() => {});

    // Create audit log
    await prisma.auditLog
      .create({
        data: {
          userId: user.id,
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

  return NextResponse.json({
    message: `Job status updated to ${status}`,
    job: { id: updated.id, status: updated.status },
  });
}
