import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

// UUID-like format validation (accepts standard UUID v4 format)
function isValidToken(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
    include: { cleaner: { select: { name: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      guestToken: booking.guestToken,
      cleanerName: booking.cleaner.name || 'Assigned Cleaner',
      serviceType: booking.serviceType,
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      duration: Number(booking.duration),
      totalPrice: Number(booking.totalPrice),
      status: booking.status,
      guestEmail: booking.guestEmail || '',
      guestName: booking.guestName || '',
      notes: booking.notes || '',
      createdAt: booking.createdAt.toISOString(),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only allow cancellation if status is PENDING or CONFIRMED
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: 'Booking can only be cancelled when in PENDING or CONFIRMED status' },
      { status: 422 }
    );
  }

  const updated = await prisma.booking.update({
    where: { guestToken: token },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Cancelled by guest' },
  });

  return NextResponse.json({
    message: 'Booking cancelled successfully',
    booking: { id: updated.id, status: updated.status },
  });
}
