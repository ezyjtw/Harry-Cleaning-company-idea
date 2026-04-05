import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, rating, thoroughness, punctuality, communication, text } = body;

    if (!bookingId || !rating) {
      return NextResponse.json(
        { error: 'Booking ID and rating are required.' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5.' },
        { status: 400 }
      );
    }

    // Verify booking exists and belongs to this user
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, clientId: true, cleanerId: true, status: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (booking.clientId !== user.id) {
      return NextResponse.json({ error: 'You can only review your own bookings.' }, { status: 403 });
    }

    if (booking.status !== 'COMPLETED' && booking.status !== 'REVIEWED') {
      return NextResponse.json(
        { error: 'You can only review completed bookings.' },
        { status: 400 }
      );
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: { bookingId },
    });

    if (existingReview) {
      return NextResponse.json({ error: 'This booking has already been reviewed.' }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        bookingId,
        clientId: user.id,
        cleanerId: booking.cleanerId,
        rating,
        thoroughness: thoroughness || null,
        punctuality: punctuality || null,
        communication: communication || null,
        text: text || null,
      },
    });

    // Update booking status to REVIEWED
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'REVIEWED' },
    });

    // Update cleaner's average rating
    const avgRating = await prisma.review.aggregate({
      where: { cleanerId: booking.cleanerId },
      _avg: { rating: true },
    });

    if (avgRating._avg.rating) {
      await prisma.cleanerProfile.updateMany({
        where: { userId: booking.cleanerId },
        data: { rating: avgRating._avg.rating },
      });
    }

    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
