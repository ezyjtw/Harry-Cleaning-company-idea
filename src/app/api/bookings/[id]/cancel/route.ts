import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { executeCancellation, previewCancellation } from '@/lib/services/cancellation.service';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/bookings/[id]/cancel
//   { dryRun: true }   → read-only preview { canCancel, refundPercent, refundAmount, reason? }
//   { reason? }        → perform the cancellation
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id } = await context.params;

  // Authorization: only the booking's owner may cancel (or preview) via this endpoint.
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

  let body: { reason?: unknown; dryRun?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // No / invalid body — both reason and dryRun are optional.
  }

  // Read-only preview — no mutation, no refund.
  if (body?.dryRun === true) {
    const preview = await previewCancellation(id);
    return NextResponse.json({ preview });
  }

  const reason = typeof body?.reason === 'string' ? body.reason : undefined;
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
