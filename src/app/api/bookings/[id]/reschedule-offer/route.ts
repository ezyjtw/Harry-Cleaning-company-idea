import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { mapBusy } from '@/lib/http/busy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// R10 Lane 2 (James-ruled): the customer answers a reschedule offer.
// Authorization mirrors approve-topup (F5 pattern): the booking's registered
// owner, or its guest token — guest parity end to end.
// B3 gate: a cleaner-lock wait past the transaction budget answers 503 BUSY.
export const POST = mapBusy(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action =
    body?.action === 'accept' ? 'accept' : body?.action === 'decline' ? 'decline' : null;
  if (!action)
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { clientId: true, guestToken: true },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  const user = await getSessionUser();
  const token =
    typeof body?.token === 'string' ? body.token : new URL(request.url).searchParams.get('token');
  const authorized =
    (user && booking.clientId && user.id === booking.clientId) ||
    (!booking.clientId && token && UUID_RE.test(token) && booking.guestToken === token);
  if (!authorized) {
    return NextResponse.json(
      booking.clientId && !user
        ? { error: 'Sign in to answer this offer.', reason: 'auth_required' }
        : { error: 'You are not authorised to answer this offer.', reason: 'wrong_account' },
      { status: booking.clientId && !user ? 401 : 403 }
    );
  }

  const offer = await prisma.rescheduleOffer.findFirst({
    where: { bookingId: id, status: 'offered' },
    select: { id: true },
  });
  if (!offer)
    return NextResponse.json({ error: 'No open offer on this booking.' }, { status: 404 });

  const { resolveRescheduleOffer } = await import('@/lib/services/reschedule-offer.service');
  const result = await resolveRescheduleOffer({ offerId: offer.id, action });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    success: true,
    action: result.action,
    message:
      result.action === 'accepted'
        ? 'Done. Just this visit moves to the new time. Everything else stays the same.'
        : 'Kept as it was. The visit stays at its original time.',
  });
});
