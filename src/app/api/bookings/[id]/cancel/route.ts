import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { executeCancellation } from '@/lib/services/cancellation.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id } = await context.params;

  // Authorization: only the booking's owner may cancel via this endpoint.
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { clientId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }
  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  let reason: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.reason === 'string') reason = body.reason;
  } catch {
    // No / invalid body — reason is optional.
  }

  const result = await executeCancellation({ bookingId: id, cancelledBy: 'client', reason });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    message: 'Booking cancelled',
    refundPercent: result.refundPercent,
    refundAmount: result.refundAmount,
    refundStatus: result.refundStatus,
  });
}
