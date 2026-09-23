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
      stripePaymentIntentId: true,
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
        // James-ruled pinning (same list as the main checkout): card, Apple
        // Pay, Google Pay (riding 'card') and Link.
        payment_method_types: ['card', 'link'],
      },
      // One on-session PI per occurrence — a refreshed page reuses it.
      { idempotencyKey: `occurrence_paynow_${booking.id}` }
    );
    // R1-B hardening (James-ruled): the old failed off-session intent dies at
    // Stripe before the customer pays the replacement — no second live intent.
    // Cancel AFTER the idempotent create, gated on the ids differing: on a
    // refreshed page the stored id already IS the pay-now intent (idempotency
    // returns the same one), and cancel-first would kill the live checkout.
    // Fail-soft: a cancel error logs loud and never blocks the new payment.
    if (booking.stripePaymentIntentId && booking.stripePaymentIntentId !== pi.id) {
      try {
        await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
      } catch (cancelErr) {
        // RECORD-TRUTH Gate 2 (James-ruled): the fence's succeeded-abort,
        // mirrored. Learn WHY the old intent refused to die: if it already
        // SUCCEEDED the customer has paid — cancel the NEW unconfirmed
        // intent, do NOT repoint the stored id (it stays on the paid intent,
        // so the success webhook's identity guards all match), route the paid
        // intent through processPaymentSuccess, and answer honestly. Any
        // other retrieve outcome falls through to the unchanged fail-soft leg.
        try {
          const oldPi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
          if (oldPi.status === 'succeeded') {
            // eslint-disable-next-line no-console
            console.log(
              `[RecurringCharge] pay-now FENCE: old intent ${oldPi.id} for ${booking.id} already SUCCEEDED — aborting pay-now, routing the payment through`
            );
            await stripe.paymentIntents.cancel(pi.id).catch((newCancelErr) => {
              // eslint-disable-next-line no-console
              console.error(
                `[RecurringCharge] pay-now FENCE: could not cancel unconfirmed replacement ${pi.id} for ${booking.id} — harmless (never confirmed), logged for the record:`,
                newCancelErr instanceof Error ? newCancelErr.message : newCancelErr
              );
            });
            const oldChargeId =
              typeof oldPi.latest_charge === 'string'
                ? oldPi.latest_charge
                : (oldPi.latest_charge?.id ?? null);
            const { processPaymentSuccess } =
              await import('@/lib/services/payment-success.service');
            await processPaymentSuccess({
              bookingId: booking.id,
              pi: {
                id: oldPi.id,
                created: oldPi.created,
                currency: oldPi.currency,
                amountReceived: oldPi.amount_received,
                chargeId: oldChargeId,
              },
            }).catch((procErr) => {
              // eslint-disable-next-line no-console
              console.error(
                `[RecurringCharge] pay-now FENCE: processPaymentSuccess failed for ${booking.id} — the webhook/sweep completes it:`,
                procErr
              );
            });
            return NextResponse.json({ error: 'This clean has just been paid.' }, { status: 409 });
          }
        } catch {
          // Retrieve failed — the unchanged fail-soft leg below handles it.
        }
        // eslint-disable-next-line no-console
        console.error(
          `[RecurringCharge] pay-now old-PI cancel FAILED for booking ${booking.id} ` +
            `(old PI ${booking.stripePaymentIntentId}, new PI ${pi.id}) — continuing:`,
          cancelErr instanceof Error ? cancelErr.message : cancelErr
        );
      }
    }
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
