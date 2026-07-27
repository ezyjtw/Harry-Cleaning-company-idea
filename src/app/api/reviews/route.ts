import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { updateStoredRating } from '@/lib/services/rating.service';
import { sanitizeInput } from '@/lib/utils/validation';

// Thrown inside the review transaction when a concurrent change (most importantly
// a dispute filed in the race window) makes the booking no longer reviewable.
// Caught below and surfaced as 409 so the whole transaction rolls back cleanly.
class ReviewConflict extends Error {}

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

    // F16 (James-ruled): review and release are INDEPENDENT — a review NEVER
    // releases or holds funds. This route used to set completionConfirmedAt +
    // releaseDueAt (instant release on review); that coupling paid the cleaner
    // at the exact moment a customer might be unhappy. Removed: the release
    // clock is armed at completion (Mark Complete → releaseDueAt = +hold) and
    // accelerated only by the explicit release button (confirm-complete). This
    // transaction touches no money fields.
    //
    // The review.create, the booking→REVIEWED flip AND the cleaner rating
    // recalc all commit or all roll back in ONE interactive transaction. No
    // crash-between-writes can leave a review without REVIEWED, or a review
    // uncounted in the stored rating.
    //
    // Race-safety vs. a concurrently-filed dispute: dispute-filing flips the booking
    // COMPLETED→DISPUTED via its own guarded updateMany on the same booking row. Our
    // flip below (status: 'COMPLETED' → 'REVIEWED', count-checked) is a compare-and-
    // swap on that same row, so the two transactions serialize on the row lock:
    //   • dispute commits first → our flip matches 0 rows → throw → the whole review
    //     tx (including the release-trigger) rolls back — no review slips through.
    //   • review commits first  → dispute's `status IN (COMPLETED,IN_PROGRESS)` guard
    //     matches 0 → the dispute filing aborts.
    // The in-tx dispute re-read is a belt-and-braces early abort for an already-
    // committed dispute; the count-checked flip is the actual race guard.
    let review;
    try {
      review = await prisma.$transaction(async (tx) => {
        // Re-assert no open dispute from inside the tx (catches a dispute committed
        // between the pre-tx check and here).
        const liveDispute = await tx.dispute.findFirst({
          where: { bookingId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          select: { id: true },
        });
        if (liveDispute) {
          throw new ReviewConflict('Cannot review a booking with an open dispute.');
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

        // Compare-and-swap on the booking row — THE serialization point against a
        // concurrent dispute. If the booking is no longer COMPLETED (e.g. disputed),
        // count is 0 and we abort the whole transaction.
        const flip = await tx.booking.updateMany({
          where: { id: bookingId, status: 'COMPLETED' },
          data: { status: 'REVIEWED' },
        });
        if (flip.count === 0) {
          throw new ReviewConflict('Booking is no longer reviewable — it may have been disputed.');
        }

        // Rating recalc INSIDE the tx, AFTER the create: the helper's aggregate
        // sees this tx's own just-created review (VISIBLE by default) because we
        // pass `tx` as the client. Stored rating reflects the new review and can
        // never be left stale by a partial commit.
        await updateStoredRating(booking.cleanerId, tx);

        return created;
      });
    } catch (error) {
      if (error instanceof ReviewConflict) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'This booking has already been reviewed.' },
          { status: 400 }
        );
      }
      throw error;
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
