import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendPaymentFailureNotification,
} from '@/lib/services/email.service';
import { verifyWebhookSignature } from '@/lib/services/stripe-payment.service';

/**
 * POST /api/payments/webhook
 *
 * Handles Stripe payment webhooks. On successful payment:
 * 1. Updates payment and booking status in database
 * 2. For queued bookings: escrow is now held — cleaners can start accepting
 * 3. For direct bookings: confirms the booking
 * 4. Sends confirmation emails
 *
 * Also handles refund webhooks for escrow difference refunds.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    // Verify webhook signature (skip in dev if no secret configured)
    if (process.env.STRIPE_WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      // eslint-disable-next-line no-console
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;

    // eslint-disable-next-line no-console
    console.log(`[Webhook] Received event: ${eventType}`);

    // ── Payment succeeded ─────────────────────────────────────
    if (eventType === 'payment_intent.succeeded') {
      const paymentIntent = event.data?.object || {};
      const metadata = paymentIntent.metadata || {};
      const bookingId = metadata.bookingId;
      const customerName = metadata.customerName || 'Customer';
      const customerEmail = paymentIntent.receipt_email;
      const stripePaymentId = paymentIntent.id;

      if (!bookingId) {
        // eslint-disable-next-line no-console
        console.error('[Webhook] No bookingId in metadata');
        return NextResponse.json({ received: true });
      }

      // eslint-disable-next-line no-console
      console.log(`[Webhook] Payment succeeded for booking ${bookingId}`);

      // Update payment record
      if (stripePaymentId) {
        await prisma.payment
          .upsert({
            where: { bookingId },
            update: { status: 'SUCCEEDED', stripePaymentId },
            create: {
              bookingId,
              stripePaymentId,
              amount: (paymentIntent.amount || 0) / 100,
              status: 'SUCCEEDED',
            },
          })
          .catch(() => {});
      }

      // Check if this is a queued booking
      const booking = await prisma.booking
        .findUnique({
          where: { id: bookingId },
          select: { isQueuedBooking: true, status: true },
        })
        .catch(() => null);

      if (booking?.isQueuedBooking) {
        // eslint-disable-next-line no-console
        console.log(
          `[Webhook] Escrow captured for queued booking ${bookingId} — awaiting cleaner acceptance`
        );
      } else {
        await prisma.booking
          .update({
            where: { id: bookingId },
            data: { status: 'CONFIRMED' },
          })
          .catch(() => {});
      }

      // Send confirmation emails
      if (customerEmail) {
        const bookingData = {
          id: bookingId,
          customerName,
          date: metadata.date || 'TBC',
          time: metadata.time || 'TBC',
          address: metadata.address || '',
          serviceType: metadata.serviceType || 'Cleaning',
          totalPrice: (paymentIntent.amount || 0) / 100,
        };

        await sendBookingConfirmation(bookingData, {
          name: customerName,
          email: customerEmail,
        }).catch(() => {});

        if (metadata.cleanerEmail && metadata.cleanerName) {
          await sendCleanerAssignment(bookingData, {
            name: metadata.cleanerName,
            email: metadata.cleanerEmail,
          }).catch(() => {});
        }
      }
    }

    // ── Refund processed (escrow difference) ──────────────────────
    if (eventType === 'charge.refunded') {
      const charge = event.data?.object || {};
      const metadata = charge.metadata || {};
      const bookingId = metadata.bookingId;
      const refundAmount = (charge.amount_refunded || 0) / 100;

      if (bookingId) {
        // eslint-disable-next-line no-console
        console.log(`[Webhook] Refund of £${refundAmount} processed for booking ${bookingId}`);

        await prisma.payment
          .update({
            where: { bookingId },
            data: {
              status: refundAmount > 0 ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
              refundAmount,
            },
          })
          .catch(() => {});
      }
    }

    // ── Payment failed ──────────────────────────────────────
    if (eventType === 'payment_intent.payment_failed') {
      const paymentIntent = event.data?.object || {};
      const metadata = paymentIntent.metadata || {};
      const bookingId = metadata.bookingId;
      const customerEmail = paymentIntent.receipt_email;
      const customerName = metadata.customerName || 'Customer';
      const failureReason =
        paymentIntent.last_payment_error?.message || 'Payment could not be processed';

      if (bookingId) {
        // eslint-disable-next-line no-console
        console.log(`[Webhook] Payment failed for booking ${bookingId}: ${failureReason}`);

        await prisma.payment
          .update({
            where: { bookingId },
            data: { status: 'FAILED' },
          })
          .catch(() => {});

        await prisma.booking
          .update({
            where: { id: bookingId },
            data: { status: 'CANCELLED', cancellationReason: `Payment failed: ${failureReason}` },
          })
          .catch(() => {});

        if (customerEmail) {
          await sendPaymentFailureNotification(
            { bookingId, customerName, reason: failureReason },
            { name: customerName, email: customerEmail }
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
