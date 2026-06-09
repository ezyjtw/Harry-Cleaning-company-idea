import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import prisma from '@/lib/db/prisma';
import { computeCascadeWindows } from '@/lib/services/cascade.service';
import {
  sendBookingConfirmation,
  sendPaymentFailureNotification,
} from '@/lib/services/email.service';
import stripe from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_PLATFORM,
  ].filter((s): s is string => !!s);

  if (secrets.length === 0) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event | undefined;
  for (let i = 0; i < secrets.length; i++) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secrets[i]);
      // eslint-disable-next-line no-console
      console.log(`[Stripe Webhook] Verified with secret ${i + 1} of ${secrets.length}`);
      break;
    } catch {
      // Try next secret
    }
  }

  if (!event) {
    // eslint-disable-next-line no-console
    console.error('[Stripe Webhook] Signature verification failed against all configured secrets');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });

  if (existing) {
    return NextResponse.json({ received: true });
  }

  await prisma.stripeWebhookEvent.create({
    data: {
      id: event.id,
      type: event.type,
      payload: JSON.parse(rawBody),
    },
  });

  // ── Connect account events (PR 2) ─────────────────────────────

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;

    const profile = await prisma.cleanerProfile.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (profile) {
      const updateData: {
        stripeChargesEnabled: boolean;
        stripePayoutsEnabled: boolean;
        stripeOnboardedAt?: Date;
      } = {
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
      };

      if (account.charges_enabled && account.payouts_enabled && !profile.stripeOnboardedAt) {
        updateData.stripeOnboardedAt = new Date();
      }

      await prisma.cleanerProfile.update({
        where: { stripeAccountId: account.id },
        data: updateData,
      });
    }
  }

  if (event.type === 'account.application.deauthorized') {
    const stripeAccountId = event.account;
    if (stripeAccountId) {
      await prisma.cleanerProfile.updateMany({
        where: { stripeAccountId },
        data: {
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      });
    }
  }

  // ── Payment events (PR 3) ─────────────────────────────────────

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (bookingId) {
      const chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : (pi.latest_charge as Stripe.Charge)?.id;

      // Read booking FIRST for cascade window computation + emails
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          client: { select: { name: true, email: true } },
          cleaner: { select: { name: true, email: true } },
        },
      });

      // Compute cascade windows (safe — falls back to COMBINED_OFFER on parse failure)
      const now = new Date();
      const cascadeData = booking
        ? computeCascadeWindows(booking.date, booking.startTime, now)
        : null;

      // Single update: payment + status + cascade fields (#2)
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'SUCCEEDED',
          status: 'AWAITING_CLEANER',
          ...(chargeId ? { stripeChargeId: chargeId } : {}),
          ...(cascadeData
            ? {
                cascadePhase: cascadeData.initialPhase,
                cascadeExpiresAt: cascadeData.cascadeExpiresAt,
                cascadeBackupExpiresAt: cascadeData.cascadeBackupExpiresAt,
              }
            : {}),
        },
      });

      if (booking?.client) {
        await sendBookingConfirmation(
          {
            id: booking.id,
            customerName: booking.client.name || 'Customer',
            cleanerName: booking.cleaner?.name || 'Your cleaner',
            date: booking.date.toISOString().split('T')[0],
            time: booking.startTime,
            address: '',
            serviceType: booking.serviceType,
            totalPrice: Number(booking.totalPrice),
          },
          { name: booking.client.name || 'Customer', email: booking.client.email }
        ).catch(() => {});
      }

      // Notify primary cleaner (and backups in COMBINED_OFFER)
      if (booking?.cleaner) {
        await prisma.notification
          .create({
            data: {
              userId: booking.cleanerId,
              type: 'BOOKING_REQUEST',
              title: 'New booking request',
              body: `New ${booking.serviceType} booking on ${booking.date.toISOString().split('T')[0]} — please accept or decline.`,
              data: { bookingId },
            },
          })
          .catch(() => {});
      }

      if (cascadeData?.initialPhase === 'COMBINED_OFFER' && booking) {
        for (const backupId of booking.backupCleanerIds) {
          await prisma.notification
            .create({
              data: {
                userId: backupId,
                type: 'BOOKING_REQUEST',
                title: 'Cleaning job available',
                body: `A ${booking.serviceType} job is available — first to accept gets it.`,
                data: { bookingId },
              },
            })
            .catch(() => {});
        }
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (bookingId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'FAILED' },
      });

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { client: { select: { name: true, email: true } } },
      });

      if (booking?.client) {
        const failureMessage = pi.last_payment_error?.message || 'Payment could not be processed';
        await sendPaymentFailureNotification(
          {
            bookingId,
            customerName: booking.client.name || 'Customer',
            reason: failureMessage,
          },
          { name: booking.client.name || 'Customer', email: booking.client.email }
        ).catch(() => {});
      }
    }
  }

  if (event.type === 'payment_intent.requires_action') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (bookingId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'REQUIRES_ACTION' },
      });
    }
  }

  if (event.type === 'payment_intent.canceled') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (bookingId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'CANCELED' },
      });
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const booking = await prisma.booking.findUnique({
      where: { stripeChargeId: charge.id },
    });

    if (booking) {
      const isFullRefund = charge.amount_refunded >= charge.amount;
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
