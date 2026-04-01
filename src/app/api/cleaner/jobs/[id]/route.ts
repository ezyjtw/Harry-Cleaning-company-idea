import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CANCELLED'
  | 'DISPUTED';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
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
    where: { id, cleanerId: user.id },
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
      address:
        booking.status === 'PENDING'
          ? booking.address?.postcode || 'TBD'
          : `${booking.address?.line1 || ''}, ${booking.address?.postcode || ''}`,
      fullAddress: `${booking.address?.line1 || ''}, ${booking.address?.city || ''} ${booking.address?.postcode || ''}`,
      postcode: booking.address?.postcode || '',
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      duration: Number(booking.duration),
      serviceType: booking.serviceType,
      totalPrice: Number(booking.totalPrice),
      cleanerEarnings: Number(booking.cleanerEarnings),
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

  const updateData: Record<string, unknown> = {
    status: status as BookingStatus,
  };

  if (notes) updateData.cleanerNotes = notes;

  // Set timestamps based on transition
  if (status === 'ACCEPTED') updateData.acceptedAt = new Date();
  if (status === 'EN_ROUTE') updateData.arrivalConfirmed = true;
  if (status === 'IN_PROGRESS') updateData.checkedInAt = new Date();
  if (status === 'COMPLETED') updateData.completedAt = new Date();
  if (status === 'CANCELLED') {
    updateData.cancelledAt = new Date();
    updateData.cancellationReason = cancellationReason || 'Cancelled by cleaner';
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    message: `Job status updated to ${status}`,
    job: { id: updated.id, status: updated.status },
  });
}
