import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// R1-A: either side ends the agreement — no lock-in (James-ruled). Auth is
// strictly the two parties: the owning cleaner, the owning customer, or (guest
// parity law) the guest holding a tokened link to ANY occurrence of this
// agreement. endedBy is DERIVED from who the caller is, never taken from the
// payload.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const agreement = await prisma.recurringAgreement.findUnique({
    where: { id },
    select: { id: true, status: true, clientId: true, cleanerId: true, guestEmail: true },
  });
  if (!agreement) {
    return NextResponse.json({ error: 'Agreement not found.' }, { status: 404 });
  }

  let endedBy: 'CLEANER' | 'CUSTOMER' | null = null;
  if (user && user.id === agreement.cleanerId) {
    endedBy = 'CLEANER';
  } else if (user && agreement.clientId && user.id === agreement.clientId) {
    endedBy = 'CUSTOMER';
  } else if (!agreement.clientId && agreement.guestEmail) {
    // Guest agreement: the tokened-link door. The guest's identity is their
    // booking email — ANY of their tokened links works (the trial clean's
    // page, an occurrence email), not just bookings inside the agreement:
    // the end surface lives on the trial booking's tokened page.
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token : null;
    if (token) {
      const match = await prisma.booking.findFirst({
        where: {
          guestToken: token,
          guestEmail: { equals: agreement.guestEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (match) endedBy = 'CUSTOMER';
    }
  }
  if (!endedBy) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (agreement.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This agreement has already ended.' }, { status: 409 });
  }

  const { endAgreement } = await import('@/lib/services/recurring.service');
  const result = await endAgreement(id, endedBy);
  if (!result.ended) {
    return NextResponse.json({ error: 'This agreement has already ended.' }, { status: 409 });
  }
  return NextResponse.json({ success: true, voided: result.voided });
}
