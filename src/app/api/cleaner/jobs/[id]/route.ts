import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { atomicAccept } from '@/lib/services/cascade.service';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';
import { bookingFullAddress, bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';

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

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CANCELLED'],
  AWAITING_CLEANER: ['ACCEPTED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
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
      OR: [
        { cleanerId: user.id },
        {
          backupCleanerIds: { has: user.id },
          cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'RENA_FIND'] },
        },
      ],
      NOT: { declinedCleanerIds: { has: user.id } },
    },
    include: {
      client: { select: { name: true, email: true } },
      address: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    job: {
      id: booking.id,
      status: booking.status,
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
      totalPrice: Number(booking.totalPrice),
      cleanerEarnings: Number(booking.cleanerEarnings),
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
      cleanerNotes: booking.cleanerNotes,
      bedrooms: (booking.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
      extras: booking.extras,
      createdAt: booking.createdAt.toISOString(),
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

  // Superseded by POST /api/cleaner/jobs/[id]/accept — kept as fallback for direct PATCH callers
  // For ACCEPTED, use the atomic cascade-aware accept
  if (status === 'ACCEPTED') {
    const acceptResult = await atomicAccept(id, user.id);
    if (!acceptResult.success) {
      return NextResponse.json({ error: acceptResult.reason }, { status: 409 });
    }

    const accepted = await prisma.booking.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true, email: true } } },
    });

    if (accepted?.clientId) {
      await prisma.notification
        .create({
          data: {
            userId: accepted.clientId,
            type: 'BOOKING_CONFIRMED',
            title: 'Booking accepted',
            body: `Your cleaner has accepted your booking for ${accepted.date.toLocaleDateString('en-GB')}.`,
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
    const holdHours = priorCompleted > 0 ? 2 : 24;
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

    await EnhancedNotificationService.sendReviewRequest(updated.id).catch(() => {});
  }

  return NextResponse.json({
    message: `Job status updated to ${status}`,
    job: { id: updated.id, status: updated.status },
  });
}
