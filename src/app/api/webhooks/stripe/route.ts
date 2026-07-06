import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import prisma from '@/lib/db/prisma';
import { computeCascadeWindows } from '@/lib/services/cascade.service';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendGuestBookingConfirmation,
  sendPaymentFailureNotification,
} from '@/lib/services/email.service';
import { handleTopupPiFailed, handleTopupPiSucceeded } from '@/lib/services/topup.service';
import { enqueueXeroPush } from '@/lib/services/xero-push.service';
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

  // ── Topup PI guard (A5.3) ──────────────────────────────────────
  // Topup PIs carry metadata.type = 'price_reconciliation_topup'.
  // Handle them here and return early so they never fall through to
  // the existing booking PI handlers below.

  if (
    (event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.requires_action' ||
      event.type === 'payment_intent.canceled') &&
    (event.data.object as Stripe.PaymentIntent).metadata?.type === 'price_reconciliation_topup'
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (event.type === 'payment_intent.succeeded' && bookingId) {
      await handleTopupPiSucceeded(pi.id, bookingId);
    } else if (event.type === 'payment_intent.payment_failed') {
      await handleTopupPiFailed(pi.id);
    }
    // requires_action and canceled: no action needed for topup PIs

    return NextResponse.json({ received: true });
  }

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

      // SECURITY (defence-in-depth): confirm this PaymentIntent actually belongs to
      // the booking before marking it paid. A validly-signed succeeded event whose
      // metadata.bookingId points at a booking it didn't pay for must NOT flip that
      // booking to paid. Gated on stripePaymentIntentId being present to avoid
      // stranding a legitimate payment if the id wasn't persisted yet.
      if (booking) {
        if (booking.stripePaymentIntentId && pi.id !== booking.stripePaymentIntentId) {
          // eslint-disable-next-line no-console
          console.error('[stripe webhook] payment_intent.succeeded PI/booking mismatch', {
            bookingId,
            piId: pi.id,
            expectedPiId: booking.stripePaymentIntentId,
          });
          return NextResponse.json({ received: true, ignored: 'pi_mismatch' });
        }
        if (pi.currency && pi.currency.toLowerCase() !== 'gbp') {
          // eslint-disable-next-line no-console
          console.error('[stripe webhook] payment_intent.succeeded unexpected currency', {
            bookingId,
            currency: pi.currency,
          });
          return NextResponse.json({ received: true, ignored: 'currency' });
        }
        // Amount check is alert-only (not blocking) so top-up/rounding edge cases
        // can't strand a real payment; a shortfall here signals a bug or tampering.
        const expectedPence = Math.round(
          Number(booking.totalAmountCharged ?? booking.totalPrice) * 100
        );
        if (typeof pi.amount_received === 'number' && pi.amount_received < expectedPence) {
          // eslint-disable-next-line no-console
          console.error('[stripe webhook] payment_intent.succeeded amount below booking total', {
            bookingId,
            amountReceived: pi.amount_received,
            expectedPence,
          });
        }
      }

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

      // A13-Xero-c: mirror the gross customer payment into Xero as Receive Money
      // (gated — no-op unless connected + mapped + flag on). Never blocks the webhook.
      await enqueueXeroPush({
        bookingId,
        event: 'PAYMENT_RECEIVED',
        occurredAt: new Date(pi.created * 1000).toISOString(),
      }).catch(() => {});

      // Confirmation + cleaner-offer emails fire HERE, on payment success — not at
      // booking creation — so an abandoned/unpaid booking never triggers a
      // "you're booked" email. (Resequenced from POST /api/bookings; also kills
      // the previous double-fire for registered users.)
      if (booking) {
        const emailData = {
          id: booking.id,
          customerName: booking.client?.name || booking.guestName || 'Customer',
          cleanerName: booking.cleaner?.name || 'Your cleaner',
          date: booking.date.toISOString().split('T')[0],
          time: booking.startTime,
          address: [
            booking.addressLine1,
            booking.addressLine2,
            booking.addressCity,
            booking.addressPostcode,
          ]
            .filter(Boolean)
            .join(', '),
          serviceType: booking.serviceType,
          totalPrice: Number(booking.totalPrice),
        };

        if (booking.client) {
          await sendBookingConfirmation(emailData, {
            name: booking.client.name || 'Customer',
            email: booking.client.email,
          }).catch(() => {});
        } else if (booking.guestEmail) {
          await sendGuestBookingConfirmation(
            emailData,
            booking.guestEmail,
            booking.guestName || 'there',
            booking.guestToken || ''
          ).catch(() => {});
        }

        if (booking.cleaner?.email) {
          await sendCleanerAssignment(emailData, {
            name: booking.cleaner.name || '',
            email: booking.cleaner.email,
          }).catch(() => {});
        }
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

      // Teardown: a payment that failed before the booking went live cancels it,
      // so the cleaner's slot frees immediately and it leaves their job list.
      // Guarded on PENDING so a failure event for an already-live booking can't
      // cancel confirmed work.
      await prisma.booking.updateMany({
        where: { id: bookingId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
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
      // Teardown (see payment_failed) — free the slot for a booking that never
      // went live. Guarded on PENDING.
      await prisma.booking.updateMany({
        where: { id: bookingId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
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

      // Best-effort backup: confirm RefundRecords that the synchronous
      // writeRefundSuccess may not have written yet (webhook can race ahead).
      // Match on bookingId + amount since stripeRefundId isn't set until
      // writeRefundSuccess completes — a fast webhook finds no ID match.
      const stripeRefunds = charge.refunds?.data ?? [];
      for (const sr of stripeRefunds) {
        const amountPounds = sr.amount / 100;
        await prisma.refundRecord
          .updateMany({
            where: {
              bookingId: booking.id,
              amount: amountPounds,
              status: { in: ['PENDING', 'UNKNOWN'] },
            },
            data: { status: 'SUCCEEDED', stripeRefundId: sr.id },
          })
          .catch(() => {});
      }
    }
  }

  return NextResponse.json({ received: true });
}
