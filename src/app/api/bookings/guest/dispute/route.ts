import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { fileDispute } from '@/lib/services/dispute.service';

// H41 (James-ruled guest parity): the tokened "Report a problem" door.
// Guests get the SAME dispute filing account-holders get — the guest token IS
// the authorization, exactly as on the guest cancel routes. All status/payment/
// money-state guards live in fileDispute and apply identically; raisedById is
// null for a true guest (no account), or the client account when the tokened
// booking belongs to one.

function isValidToken(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

export async function POST(request: NextRequest) {
  let body: { token?: unknown; reason?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = typeof body?.token === 'string' ? body.token : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }
  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'Please describe the problem.' }, { status: 400 });
  }
  if (description.length > 2000) {
    return NextResponse.json(
      { error: 'Description is too long (max 2000 characters).' },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
    select: { id: true, clientId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const result = await fileDispute({
    bookingId: booking.id,
    raisedById: booking.clientId,
    reason,
    description,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { message: 'Problem reported', disputeId: result.disputeId },
    { status: 201 }
  );
}
