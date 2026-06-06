import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { paymentIntentId, savePaymentMethod } = body;

  if (!paymentIntentId || typeof savePaymentMethod !== 'boolean') {
    return NextResponse.json(
      { error: 'paymentIntentId and savePaymentMethod are required' },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { clientId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.clientId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await stripe.paymentIntents.update(paymentIntentId, {
    setup_future_usage: savePaymentMethod ? 'off_session' : null,
  });

  return NextResponse.json({ updated: true });
}
