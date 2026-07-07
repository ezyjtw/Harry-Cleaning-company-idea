// ─── M4: single owner of "a booking's payment succeeded" ─────────────────────
//
// Extracted from the Stripe webhook so the SAME path serves both:
//   • the webhook (payment_intent.succeeded), and
//   • the scheduler safety-net sweep for stranded paid bookings
//     (webhook received the event but crashed mid-processing).
//
// Re-run safety: the status flip is an ATOMIC CLAIM (updateMany gated on
// status=PENDING). Whoever wins the claim runs the side-effects exactly once;
// every other caller (webhook retry, sweep, races) gets SKIPPED_ALREADY and
// does nothing. This also prevents a hours-later retry from stomping a booking
// a cleaner has since accepted — the status is no longer PENDING.

import { prisma } from '@/lib/db/prisma';
import { computeCascadeWindows } from '@/lib/services/cascade.service';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendGuestBookingConfirmation,
} from '@/lib/services/email.service';
import { enqueueXeroPush } from '@/lib/services/xero-push.service';
import stripe from '@/lib/stripe';

export type PaymentSuccessOutcome =
  | 'PROCESSED'
  | 'SKIPPED_ALREADY'
  | 'IGNORED_PI_MISMATCH'
  | 'IGNORED_CURRENCY'
  | 'NOT_FOUND';

export interface PaymentSuccessInput {
  bookingId: string;
  /** Details of the succeeded PaymentIntent (from the webhook event, or a
   *  Stripe retrieve in the sweep). */
  pi: {
    id: string;
    created: number; // unix seconds
    currency?: string | null;
    amountReceived?: number | null; // pence
    chargeId?: string | null;
  };
}

export async function processPaymentSuccess(
  input: PaymentSuccessInput
): Promise<PaymentSuccessOutcome> {
  const { bookingId, pi } = input;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true, email: true } },
    },
  });
  if (!booking) return 'NOT_FOUND';

  // SECURITY (defence-in-depth): confirm this PaymentIntent actually belongs to
  // the booking before marking it paid. A validly-signed succeeded event whose
  // metadata.bookingId points at a booking it didn't pay for must NOT flip that
  // booking to paid. Gated on stripePaymentIntentId being present to avoid
  // stranding a legitimate payment if the id wasn't persisted yet.
  if (booking.stripePaymentIntentId && pi.id !== booking.stripePaymentIntentId) {
    // eslint-disable-next-line no-console
    console.error('[payment-success] PI/booking mismatch', {
      bookingId,
      piId: pi.id,
      expectedPiId: booking.stripePaymentIntentId,
    });
    return 'IGNORED_PI_MISMATCH';
  }
  if (pi.currency && pi.currency.toLowerCase() !== 'gbp') {
    // eslint-disable-next-line no-console
    console.error('[payment-success] unexpected currency', { bookingId, currency: pi.currency });
    return 'IGNORED_CURRENCY';
  }
  // Amount check is alert-only (not blocking) so top-up/rounding edge cases
  // can't strand a real payment; a shortfall here signals a bug or tampering.
  const expectedPence = Math.round(Number(booking.totalAmountCharged ?? booking.totalPrice) * 100);
  if (typeof pi.amountReceived === 'number' && pi.amountReceived < expectedPence) {
    // eslint-disable-next-line no-console
    console.error('[payment-success] amount below booking total', {
      bookingId,
      amountReceived: pi.amountReceived,
      expectedPence,
    });
  }

  // Compute cascade windows (safe — falls back to COMBINED_OFFER on parse failure)
  const now = new Date();
  const cascadeData = computeCascadeWindows(booking.date, booking.startTime, now);

  // ── ATOMIC CLAIM: payment + status + cascade fields, only from PENDING ──
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'PENDING' },
    data: {
      paymentStatus: 'SUCCEEDED',
      status: 'AWAITING_CLEANER',
      ...(pi.chargeId ? { stripeChargeId: pi.chargeId } : {}),
      ...(cascadeData
        ? {
            cascadePhase: cascadeData.initialPhase,
            cascadeExpiresAt: cascadeData.cascadeExpiresAt,
            cascadeBackupExpiresAt: cascadeData.cascadeBackupExpiresAt,
          }
        : {}),
    },
  });
  if (claimed.count === 0) return 'SKIPPED_ALREADY';

  // ── Side-effects (claim winner only — never double-fired) ──

  // A13-Xero: pull the ACTUAL Stripe processing fee from the charge's balance
  // transaction so the Xero receive nets to what Stripe truly credited.
  // Best-effort: if unavailable the push simply omits the fee line.
  let stripeFeeAmount: number | undefined;
  if (pi.chargeId) {
    try {
      const ch = await stripe.charges.retrieve(pi.chargeId, {
        expand: ['balance_transaction'],
      });
      const bt = ch.balance_transaction;
      if (bt && typeof bt !== 'string') stripeFeeAmount = bt.fee / 100;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[payment-success] could not read Stripe fee for charge', pi.chargeId, e);
    }
  }

  // A13-Xero-c: mirror the gross customer payment into Xero as Receive Money
  // (gated — no-op unless connected + mapped + flag on). Never blocks processing.
  await enqueueXeroPush({
    bookingId,
    event: 'PAYMENT_RECEIVED',
    occurredAt: new Date(pi.created * 1000).toISOString(),
    stripeFeeAmount,
  }).catch(() => {});

  // Confirmation + cleaner-offer emails fire HERE, on payment success — not at
  // booking creation — so an abandoned/unpaid booking never triggers a
  // "you're booked" email.
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

  // Notify primary cleaner (and backups in COMBINED_OFFER)
  if (booking.cleaner) {
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

  if (cascadeData?.initialPhase === 'COMBINED_OFFER') {
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

  return 'PROCESSED';
}

// ─── The safety-net sweep (M4) ────────────────────────────────────────────────
//
// Catches paid bookings the webhook failed to process (crash mid-handler, event
// recorded but work incomplete, or the event never arrived). Two detectors:
//   (a) paymentStatus SUCCEEDED but status still PENDING — a partial write or a
//       claim that never completed its side-effects' precursor state;
//   (b) paymentStatus PENDING with a PaymentIntent that Stripe says SUCCEEDED —
//       the true webhook-stranded case. Verified against Stripe per candidate.
// Both older than 15 minutes (give the webhook its natural window) and loud.

export async function sweepStrandedPayments(): Promise<{ scanned: number; processed: number }> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  let processed = 0;

  // (a) SUCCEEDED + PENDING — process directly (claim gate makes this safe).
  const strandedA = await prisma.booking.findMany({
    where: { paymentStatus: 'SUCCEEDED', status: 'PENDING', updatedAt: { lte: cutoff } },
    select: { id: true, stripePaymentIntentId: true, stripeChargeId: true },
    take: 20,
  });

  // (b) still PENDING payment, PI on file, older than 15 min — ask Stripe.
  const strandedB = await prisma.booking.findMany({
    where: {
      paymentStatus: 'PENDING',
      status: 'PENDING',
      stripePaymentIntentId: { not: null },
      createdAt: { lte: cutoff },
    },
    select: { id: true, stripePaymentIntentId: true },
    take: 20,
  });

  const candidates: { id: string; piId: string }[] = [
    ...strandedA
      .filter((b) => b.stripePaymentIntentId)
      .map((b) => ({ id: b.id, piId: b.stripePaymentIntentId as string })),
    ...strandedB.map((b) => ({ id: b.id, piId: b.stripePaymentIntentId as string })),
  ];

  for (const c of candidates) {
    try {
      const pi = await stripe.paymentIntents.retrieve(c.piId, { expand: ['latest_charge'] });
      if (pi.status !== 'succeeded') continue; // not actually paid — reaper's problem

      // LOUD: this only happens when the webhook path failed. Surface it.
      // eslint-disable-next-line no-console
      console.error(
        `[PAYMENT-SWEEP] Stranded PAID booking ${c.id} (pi ${c.piId}) — webhook did not complete; processing via sweep. INVESTIGATE the webhook failure.`
      );

      const chargeId =
        typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
      const outcome = await processPaymentSuccess({
        bookingId: c.id,
        pi: {
          id: pi.id,
          created: pi.created,
          currency: pi.currency,
          amountReceived: pi.amount_received,
          chargeId: chargeId ?? null,
        },
      });
      if (outcome === 'PROCESSED') processed++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[PAYMENT-SWEEP] failed for booking ${c.id}:`, err);
    }
  }

  return { scanned: candidates.length, processed };
}
