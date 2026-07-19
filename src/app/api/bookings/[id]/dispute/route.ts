import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { fileDispute } from '@/lib/services/dispute.service';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/bookings/[id]/dispute
//   { reason, description }  → file a dispute (pauses the release of funds)
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id: rawRef } = await context.params;

  // H64: customers hold the DISPLAY reference (first 8 chars, uppercased —
  // what the bookings list, admin cards and emails all show), not the internal
  // id. Accept both: exact id first, else a case-insensitive prefix match
  // scoped to the CALLER'S OWN bookings (no enumeration surface — you can only
  // resolve references to bookings you already own).
  let booking = await prisma.booking.findUnique({
    where: { id: rawRef },
    select: { id: true, clientId: true },
  });
  if (!booking && /^[a-z0-9-]{6,25}$/i.test(rawRef)) {
    booking = await prisma.booking.findFirst({
      where: { clientId: user.id, id: { startsWith: rawRef.toLowerCase() } },
      select: { id: true, clientId: true },
    });
  }
  if (!booking) {
    return NextResponse.json(
      {
        error:
          'Booking reference not found. Use the reference from your confirmation email or bookings page (e.g. AB12CD34).',
      },
      { status: 404 }
    );
  }
  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }
  const id = booking.id;

  let body: { reason?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

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

  const result = await fileDispute({ bookingId: id, raisedById: user.id, reason, description });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { message: 'Problem reported', disputeId: result.disputeId },
    { status: 201 }
  );
}
