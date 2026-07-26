import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// R1-A (amended): offer eligibility for the booking detail surfaces. Customer
// of the booking only — session client, or the guest holding this booking's
// token. The offer is customer-facing; every other viewer gets 404-shaped
// nothing (no existence oracle).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('token');
  const user = await getSessionUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { clientId: true, guestToken: true, cleanerId: true },
  });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isClient = !!user && !!booking.clientId && user.id === booking.clientId;
  const isGuest = !booking.clientId && !!token && token === booking.guestToken;
  if (!isClient && !isGuest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { getRegularCleanOffer } = await import('@/lib/services/regular-offer.service');
  const offer = await getRegularCleanOffer(id);
  return NextResponse.json({
    eligible: offer.eligible,
    cleanerId: offer.cleanerId ?? booking.cleanerId,
    cleanerName: offer.cleanerName ?? null,
    slots: offer.slots ?? [],
    usualSlot: offer.usualSlot ?? null,
  });
}
