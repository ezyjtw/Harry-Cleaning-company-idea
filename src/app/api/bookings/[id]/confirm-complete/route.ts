import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id: bookingId } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true,
      status: true,
      transferStatus: true,
      completionConfirmedAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }

  if (booking.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Only completed bookings can be confirmed' },
      { status: 422 }
    );
  }

  if (booking.completionConfirmedAt) {
    return NextResponse.json({ message: 'Already confirmed' });
  }

  if (booking.transferStatus !== 'PENDING') {
    return NextResponse.json({ error: 'Funds have already been processed' }, { status: 409 });
  }

  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'COMPLETED',
      transferStatus: 'PENDING',
      completionConfirmedAt: null,
    },
    data: {
      completionConfirmedAt: new Date(),
      releaseDueAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Booking state changed — please refresh' }, { status: 409 });
  }

  // H74: never a silent catch — a thrown review-request must say so in prod.
  await EnhancedNotificationService.sendReviewRequest(bookingId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[ReviewRequest] Failed for booking ${bookingId}:`, e);
  });

  return NextResponse.json({ message: 'Completion confirmed — funds will be released shortly' });
}
