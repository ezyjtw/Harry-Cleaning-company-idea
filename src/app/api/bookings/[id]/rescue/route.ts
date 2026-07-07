import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { rescueChooseRefund, rescueRebook } from '@/lib/services/rescue.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/bookings/[id]/rescue — the customer's choice on a CLEANER_CANCELLED
// booking. Body: { choice: 'refund' } or
//               { choice: 'rebook', cleanerId, date, startTime }
// Auth: the booking's registered owner (session) OR its guest token
// (body.guestToken — the F5 pattern: every guest action works tokened end to
// end). Both actors reach the same service functions; races with the timeout
// sweep are settled by atomic claims inside them.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`rescue:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts — please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || (body.choice !== 'refund' && body.choice !== 'rebook')) {
    return NextResponse.json({ error: "choice must be 'refund' or 'rebook'" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, clientId: true, guestToken: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // ── Authorization: owner session OR matching guest token ──
  let actor: 'client' | 'guest' | null = null;
  const user = await getSessionUser();
  if (user && booking.clientId && user.id === booking.clientId) {
    actor = 'client';
  } else if (
    !booking.clientId &&
    typeof body.guestToken === 'string' &&
    UUID_RE.test(body.guestToken) &&
    booking.guestToken === body.guestToken
  ) {
    actor = 'guest';
  }
  if (!actor) {
    return NextResponse.json({ error: 'Not authorised for this booking' }, { status: 403 });
  }

  if (booking.status !== 'CLEANER_CANCELLED') {
    return NextResponse.json(
      { error: 'This booking is not awaiting a rescue choice', status: booking.status },
      { status: 422 }
    );
  }

  if (body.choice === 'refund') {
    const result = await rescueChooseRefund({ bookingId: id, actor });
    if (!result.ok) {
      // A lost race (sweep already refunded) reads as resolved, not an error.
      return NextResponse.json(
        { error: result.error, alreadyResolved: result.status === 409 || result.status === 422 },
        { status: result.status }
      );
    }
    return NextResponse.json({
      success: true,
      refunded: true,
      refundAmount: result.refundAmount,
      message: 'Your full refund is on its way back to your original payment method.',
    });
  }

  // rebook
  if (
    typeof body.cleanerId !== 'string' ||
    typeof body.date !== 'string' ||
    typeof body.startTime !== 'string'
  ) {
    return NextResponse.json(
      { error: 'cleanerId, date and startTime are required to rebook' },
      { status: 400 }
    );
  }
  const result = await rescueRebook({
    bookingId: id,
    newCleanerId: body.cleanerId,
    date: body.date,
    startTime: body.startTime,
    isGuest: actor === 'guest',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    rebooked: true,
    newCleanerName: result.newCleanerName,
    priceDelta: result.priceDelta,
    message:
      result.priceDelta && result.priceDelta > 0.01
        ? `Request sent to ${result.newCleanerName}. If they accept, we'll ask you to approve the £${result.priceDelta.toFixed(2)} difference before anything is charged.`
        : `Request sent to ${result.newCleanerName}. Your payment moves to the new booking automatically${result.priceDelta && result.priceDelta < -0.01 ? ` and we'll refund the £${Math.abs(result.priceDelta).toFixed(2)} difference` : ''}.`,
  });
}
