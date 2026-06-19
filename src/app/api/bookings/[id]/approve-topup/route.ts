import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { handleProvisionalFailure } from '@/lib/services/cascade.service';
import { executeTopup } from '@/lib/services/topup.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      totalPrice: true,
      provisionalPrice: true,
      topupAmount: true,
      approvalExpiresAt: true,
      cascadePhase: true,
      topupApproved: true,
      serviceType: true,
      date: true,
      startTime: true,
      topupRecords: {
        where: { status: 'SUCCEEDED' },
        select: { id: true },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }

  if (booking.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    return NextResponse.json({ error: 'No pending approval' }, { status: 400 });
  }

  return NextResponse.json({
    bookingId: booking.id,
    originalPrice: Number(booking.totalPrice),
    newPrice: Number(booking.provisionalPrice),
    topupAmount: Number(booking.topupAmount),
    expiresAt: booking.approvalExpiresAt?.toISOString(),
    alreadyApproved: booking.topupApproved,
    alreadyPaid: booking.topupRecords.length > 0,
    serviceType: booking.serviceType,
    date: booking.date.toISOString().split('T')[0],
    time: booking.startTime,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { action } = body;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      cascadePhase: true,
      approvalExpiresAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }

  if (booking.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    return NextResponse.json({ error: 'No pending approval' }, { status: 400 });
  }

  if (booking.approvalExpiresAt && booking.approvalExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Approval window has expired' }, { status: 410 });
  }

  if (action === 'decline') {
    await handleProvisionalFailure(id, 'Customer declined');
    return NextResponse.json({ result: 'declined' });
  }

  if (action === 'approve') {
    // Atomic flag set — executeTopup checks this
    const claimed = await prisma.booking.updateMany({
      where: { id, cascadePhase: 'PROVISIONAL_APPROVAL', topupApproved: false },
      data: { topupApproved: true },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Already approved or no longer pending' }, { status: 409 });
    }

    const topupResult = await executeTopup(id);

    if (topupResult.outcome === 'SUCCEEDED') {
      return NextResponse.json({ result: 'paid', outcome: topupResult.outcome });
    }

    if (topupResult.outcome === 'REQUIRES_ACTION' || topupResult.outcome === 'REQUIRES_CARD') {
      return NextResponse.json({
        result: 'requires_payment',
        outcome: topupResult.outcome,
        clientSecret: topupResult.clientSecret,
      });
    }

    await handleProvisionalFailure(
      id,
      `Top-up charge failed: ${topupResult.reason || 'Payment failed'}`
    );
    return NextResponse.json(
      { error: topupResult.reason || 'Payment failed', outcome: topupResult.outcome },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
