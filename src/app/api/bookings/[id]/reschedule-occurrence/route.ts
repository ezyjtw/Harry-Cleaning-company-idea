import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// R1-C: customer reschedules an UNPAID flagged occurrence with the SAME
// cleaner — it returns to SCHEDULED and charges at its new T-48h. Auth: the
// booking's customer (session) or its guest token.
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

  const date = String(body?.date ?? '');
  const time = String(body?.time ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: 'date (YYYY-MM-DD) and time (HH:mm) required' },
      { status: 400 }
    );
  }

  const { rescheduleUnpaidOccurrence } = await import('@/lib/services/occurrence-rescue.service');
  const result = await rescheduleUnpaidOccurrence({ bookingId: id, date, startTime: time });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    message: `Rescheduled — your clean now happens on ${date} at ${time} and is confirmed as normal closer to the date.`,
  });
}
