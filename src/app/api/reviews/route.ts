import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { sanitizeInput } from '@/lib/utils/validation';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, rating, thoroughness, punctuality, communication, text } = body;

    if (!bookingId || !rating) {
      return NextResponse.json({ error: 'Booking ID and rating are required.' }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5.' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        clientId: true,
        cleanerId: true,
        status: true,
        completionConfirmedAt: true,
        transferStatus: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.clientId !== user.id) {
      return NextResponse.json(
        { error: 'You can only review your own bookings.' },
        { status: 403 }
      );
    }

    if (booking.status === 'DISPUTED') {
      return NextResponse.json({ error: 'Cannot review a disputed booking.' }, { status: 400 });
    }

    if (booking.status !== 'COMPLETED' && booking.status !== 'REVIEWED') {
      return NextResponse.json(
        { error: 'You can only review completed bookings.' },
        { status: 400 }
      );
    }

    const openDispute = await prisma.dispute.findFirst({
      where: { bookingId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    });
    if (openDispute) {
      return NextResponse.json(
        { error: 'Cannot review a booking with an open dispute.' },
        { status: 400 }
      );
    }

    const sanitizedText = text ? sanitizeInput(String(text)).substring(0, 2000) : null;

    // Money-adjacent: the review-create, the satisfaction confirm/release-trigger
    // (completionConfirmedAt + releaseDueAt) and booking→REVIEWED must be ALL-OR-
    // NOTHING. A crash mid-sequence must never release funds without a review row,
    // nor leave a review without flipping the booking. One $transaction guarantees
    // that boundary. The `completionConfirmedAt: null` guard makes the release block
    // a no-op when "I'm satisfied" already confirmed (no double-set of releaseDueAt).
    let review;
    try {
      review = await prisma.$transaction(async (tx) => {
        if (!booking.completionConfirmedAt) {
          await tx.booking.updateMany({
            where: { id: bookingId, completionConfirmedAt: null },
            data: {
              completionConfirmedAt: new Date(),
              releaseDueAt: new Date(),
            },
          });
        }

        const created = await tx.review.create({
          data: {
            bookingId,
            clientId: user.id,
            cleanerId: booking.cleanerId,
            rating,
            thoroughness: thoroughness || null,
            punctuality: punctuality || null,
            communication: communication || null,
            text: sanitizedText,
          },
        });

        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'REVIEWED' },
        });

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'This booking has already been reviewed.' },
          { status: 400 }
        );
      }
      throw error;
    }

    // Derived display value — recomputed from VISIBLE reviews. Intentionally OUTSIDE
    // the transaction: if it lags, the next review (or recalc) self-heals it; it
    // touches no money and must not be able to roll back a committed review.
    const avgRating = await prisma.review.aggregate({
      where: { cleanerId: booking.cleanerId, visibility: 'VISIBLE' },
      _avg: { rating: true },
    });

    if (avgRating._avg.rating) {
      await prisma.cleanerProfile.updateMany({
        where: { userId: booking.cleanerId },
        data: { rating: avgRating._avg.rating },
      });
    }

    await AuditService.log({
      action: 'REVIEW_CREATED',
      userId: user.id,
      entityType: 'Review',
      entityId: review.id,
      metadata: { bookingId, rating, cleanerId: booking.cleanerId },
    }).catch(() => {});

    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
