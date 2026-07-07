import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// GET /api/messages/compose?bookingId=<id>
// Bootstraps a booking-scoped conversation pane for the "Message" buttons on
// bookings. The counterparty and send-eligibility are DERIVED SERVER-SIDE from the
// booking — never trusted from the client — and the requester must be the
// booking's client or cleaner.
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const bookingId = new URL(request.url).searchParams.get('bookingId');
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required.' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, cleanerId: true, transferStatus: true, status: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const isClient = booking.clientId === user.id;
  const isCleaner = booking.cleanerId === user.id;
  if (!isClient && !isCleaner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const partnerId = isClient ? booking.cleanerId : booking.clientId;
  if (!partnerId) {
    return NextResponse.json(
      { error: 'This booking has no counterparty to message.' },
      { status: 400 }
    );
  }

  const [partner, block] = await Promise.all([
    prisma.user.findUnique({ where: { id: partnerId }, select: { name: true, role: true } }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: partnerId },
          { blockerId: partnerId, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    }),
  ]);

  // Same release-gate predicate as the gated sendMessage.
  const isSettled = booking.transferStatus === 'RELEASED' || booking.transferStatus === 'REFUNDED';
  const isDead =
    booking.status === 'CANCELLED' ||
    booking.status === 'CASCADE_EXHAUSTED' ||
    booking.status === 'CLEANER_CANCELLED'; // M3: the cleaner has left the booking
  const eitherBlocked = !!block;

  return NextResponse.json({
    bookingId,
    partnerId,
    partnerName: partner?.name ?? 'User',
    partnerRole: partner?.role === 'CLEANER' ? 'cleaner' : 'customer',
    canSend: !isSettled && !isDead && !eitherBlocked,
    blockedByMe: block?.blockerId === user.id,
  });
}
