import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

// R1-B: the pay-now door for an occurrence whose single off-session attempt
// failed (or never ran — guests). Creates/reuses an ON-SESSION PaymentIntent
// for the occurrence and returns the client secret for the normal
// PaymentElement checkout — SCA is handled natively there (James-ruled: this
// page IS the SCA handling; no off-session plumbing exists).
// Auth: the booking's customer (session) or its guest token. Occurrence must
// still be SCHEDULED, unpaid, on an ACTIVE agreement, and before its start.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : null;
  const user = await getSessionUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      date: true,
      startTime: true,
      totalPrice: true,
      totalAmountCharged: true,
      clientId: true,
      guestToken: true,
      cleanerId: true,
      serviceType: true,
      agreement: { select: { status: true } },
      client: { select: { id: true, stripeCustomerId: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isClient = !!user && !!booking.clientId && user.id === booking.clientId;
  const isGuest = !booking.clientId && !!token && token === booking.guestToken;
  if (!isClient && !isGuest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (booking.status !== 'SCHEDULED' || booking.agreement?.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'This clean can no longer be paid for here.' },
      { status: 409 }
    );
  }
  if (booking.paymentStatus === 'SUCCEEDED') {
    return NextResponse.json({ error: 'This clean is already paid.' }, { status: 409 });
  }
  const [h, m] = booking.startTime.split(':').map(Number);
  const startMs = booking.date.getTime() + (h * 60 + m) * 60 * 1000;
  if (startMs < Date.now()) {
    return NextResponse.json({ error: 'This clean has already started.' }, { status: 409 });
  }

  const amountPence = Math.round(Number(booking.totalAmountCharged ?? booking.totalPrice) * 100);
  const stripeCustomerId = booking.client?.stripeCustomerId ?? null;

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountPence,
        currency: 'gbp',
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        metadata: {
          bookingId: booking.id,
          cleanerId: booking.cleanerId,
          serviceType: booking.serviceType,
          type: 'recurring_occurrence_paynow',
        },
        automatic_payment_methods: { enabled: true },
      },
      // One on-session PI per occurrence — a refreshed page reuses it.
      { idempotencyKey: `occurrence_paynow_${booking.id}` }
    );
    // The success webhook's PI/booking guard matches on the stored id — point
    // it at the pay-now PI (replacing the failed off-session one, if any).
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripePaymentIntentId: pi.id },
    });

    // F7: authed customers get their saved-card tile; guests structurally not.
    let customerSessionClientSecret: string | null = null;
    if (stripeCustomerId) {
      try {
        const session = await stripe.customerSessions.create({
          customer: stripeCustomerId,
          components: {
            payment_element: {
              enabled: true,
              features: {
                payment_method_redisplay: 'enabled',
                payment_method_save: 'disabled',
                payment_method_remove: 'disabled',
              },
            },
          },
        });
        customerSessionClientSecret = session.client_secret;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[stripe] CustomerSession mint failed: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    return NextResponse.json({
      clientSecret: pi.client_secret,
      stripePaymentIntentId: pi.id,
      amount: amountPence / 100,
      ...(customerSessionClientSecret ? { customerSessionClientSecret } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[RecurringCharge] pay-now PI creation failed for ${booking.id}:`, err);
    return NextResponse.json(
      { error: 'Payment could not be started. Please try again.' },
      { status: 500 }
    );
  }
}
