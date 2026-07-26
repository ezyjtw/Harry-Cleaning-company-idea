import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// R1-C: customer skips an upcoming occurrence. Auth: the booking's customer
// (session) or its guest token. Policy lives in skipOccurrence — unpaid free
// at any distance; paid free before the 24h cutoff, charge stands inside it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : null;
  const user = await getSessionUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { clientId: true, guestToken: true, agreementId: true },
  });
  if (!booking || !booking.agreementId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const isClient = !!user && !!booking.clientId && user.id === booking.clientId;
  const isGuest = !booking.clientId && !!token && token === booking.guestToken;
  if (!isClient && !isGuest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { skipOccurrence } = await import('@/lib/services/occurrence-rescue.service');
  const result = await skipOccurrence({ bookingId: id, actor: isClient ? 'client' : 'guest' });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    refunded: result.refunded,
    message:
      result.variant === 'unpaid'
        ? 'Skipped — nothing was charged. Your regular arrangement continues as normal.'
        : result.refunded
          ? 'Skipped — your payment for this clean is being refunded in full. Your regular arrangement continues as normal.'
          : 'Skipped — as this was inside 24 hours, the charge stands. Your regular arrangement continues as normal.',
  });
}
