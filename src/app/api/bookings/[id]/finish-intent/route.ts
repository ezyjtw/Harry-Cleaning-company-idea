import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

// Finish door (James-ruled, phantom follow-up Change 2 → build order):
// the resume path for a ONE-OFF booking abandoned at checkout. Option (a),
// the designed shape: retrieve the ORIGINAL PaymentIntent and reuse it when
// Stripe reports it still confirmable — zero double-charge by construction.
// This endpoint NEVER creates, mutates or cancels a PaymentIntent, and never
// writes to the booking: it is a guarded read that hands back the original
// client secret. If the intent is cancelled (the reaper got there) or
// otherwise unusable, the answer is the honest "expired" — never a
// replacement intent (ruled: no minting in this build).
//
// Guards, all mandatory (ruled): the customer's own booking · status PENDING
// · unpaid · before start time · not reaped (any other state → expired).
// Success then runs the untouched normal machinery: the customer confirms on
// Stripe's element, payment_intent.succeeded → processPaymentSuccess → the
// cascade, exactly as a first-time payment.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Recovery Lane B row 3 (James-ruled): guests receive the failure/recovery
  // emails too, so the Finish door takes the same guest-token auth as the
  // R1-B pay-now route — the booking's customer (session) or its guest token.
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
      clientId: true,
      serviceType: true,
      stripePaymentIntentId: true,
      guestToken: true,
    },
  });
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Ownership reads as not-found — same shape as the other booking routes.
  const isClient = !!user && !!booking.clientId && user.id === booking.clientId;
  const isGuest = !booking.clientId && !!token && token === booking.guestToken;
  if (!isClient && !isGuest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (booking.paymentStatus === 'SUCCEEDED') {
    return NextResponse.json(
      { error: 'This clean is already paid.', reason: 'already_paid' },
      { status: 409 }
    );
  }
  // Not PENDING = reaped (ABANDONED), cancelled, or otherwise past the unpaid
  // window — the honest expired screen, never a resurrect.
  if (booking.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'This booking has expired.', reason: 'expired' },
      { status: 409 }
    );
  }
  const [h, m] = booking.startTime.split(':').map(Number);
  const startMs = booking.date.getTime() + (h * 60 + m) * 60 * 1000;
  if (startMs < Date.now()) {
    return NextResponse.json(
      { error: 'This booking has expired.', reason: 'expired' },
      { status: 409 }
    );
  }
  if (!booking.stripePaymentIntentId) {
    return NextResponse.json(
      { error: 'This booking has expired.', reason: 'expired' },
      { status: 409 }
    );
  }

  // Retrieve the ORIGINAL intent. A Stripe/network failure here is a
  // retryable error, never "expired" — expiry is only ever declared on
  // Stripe's own word about the intent's state.
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[finish-intent] PI retrieve failed for ${booking.id}:`, err);
    return NextResponse.json(
      { error: "We couldn't check your payment just now. Please try again.", reason: 'retry' },
      { status: 502 }
    );
  }

  if (pi.status === 'succeeded') {
    // Stranded-paid: the money is in; the webhook/sweep flips the booking.
    return NextResponse.json(
      { error: 'This clean is already paid.', reason: 'already_paid' },
      { status: 409 }
    );
  }
  if (pi.status === 'processing') {
    return NextResponse.json(
      {
        error: 'Your payment is still being processed — check back shortly.',
        reason: 'processing',
      },
      { status: 409 }
    );
  }
  const confirmable =
    pi.status === 'requires_payment_method' ||
    pi.status === 'requires_confirmation' ||
    pi.status === 'requires_action';
  if (!confirmable || !pi.client_secret) {
    // canceled (the reaper's cancel-at-Stripe-first), or any state we can't
    // hand to the element — the honest expired screen.
    return NextResponse.json(
      { error: 'This booking has expired.', reason: 'expired' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    clientSecret: pi.client_secret,
    stripePaymentIntentId: pi.id,
    amount: pi.amount / 100,
    serviceType: booking.serviceType,
    date: booking.date,
    startTime: booking.startTime,
  });
}
