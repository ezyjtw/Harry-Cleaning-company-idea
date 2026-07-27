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

import { serviceLabelFromSlug } from '@/lib/constants/services';
import { prisma } from '@/lib/db/prisma';
import { computeCascadeWindows } from '@/lib/services/cascade.service';
import {
  sendBackupOfferEmails,
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

  // ── R1-B: OCCURRENCE branch — a paid SCHEDULED occurrence becomes the
  // cleaner's confirmed job directly (SCHEDULED→ACCEPTED). No cascade, no
  // offer emails: the agreement's cleaner already owns the slot. Everything
  // else (Xero push, receipt, lifecycle, payout-on-completion) rides the same
  // laws as any paid booking.
  if (booking.agreementId && booking.status === 'SCHEDULED') {
    const claimed = await prisma.booking.updateMany({
      where: { id: bookingId, status: 'SCHEDULED' },
      data: {
        paymentStatus: 'SUCCEEDED',
        status: 'ACCEPTED',
        ...(pi.chargeId ? { stripeChargeId: pi.chargeId } : {}),
      },
    });
    if (claimed.count === 0) {
      // Cancelled between our read and the claim — the same cancel/pay race
      // as below; route it to the refund handler rather than dropping it.
      return handleLateOccurrencePayment(bookingId, pi);
    }

    await enqueueXeroPush({
      bookingId,
      event: 'PAYMENT_RECEIVED',
      // pi.created robustness (the ledgered nit, defended here): a malformed
      // event must never crash the claim-winner's side-effects.
      occurredAt: new Date(
        (Number.isFinite(pi.created) ? pi.created : Math.floor(Date.now() / 1000)) * 1000
      ).toISOString(),
      stripeChargeId: pi.chargeId ?? undefined,
    }).catch(() => {});

    const dateStr = booking.date.toISOString().split('T')[0];
    // Customer: the existing receipt template — money left their card
    // off-session, so the movement is never silent.
    const { sendPaymentReceipt } = await import('@/lib/services/email.service');
    const recipientEmail = booking.client?.email ?? booking.guestEmail;
    if (recipientEmail) {
      await sendPaymentReceipt(
        {
          id: pi.id,
          bookingId,
          amount: Number(booking.totalAmountCharged ?? booking.totalPrice),
          date: dateStr,
          method: 'Saved card',
        },
        {
          name: booking.client?.name || booking.guestName || 'Customer',
          email: recipientEmail,
        }
      ).catch(() => {});
    }
    // Cleaner: their regular clean is now a confirmed job — the F8 accepted
    // email (with the .ics) is exactly that moment.
    const { sendCleanerJobAccepted } = await import('@/lib/services/email.service');
    await sendCleanerJobAccepted(bookingId).catch(() => {});
    await prisma.notification
      .create({
        data: {
          userId: booking.cleanerId,
          type: 'BOOKING_CONFIRMED',
          title: 'Regular clean confirmed',
          body: `Your regular clean on ${dateStr} is paid and confirmed.`,
          data: { bookingId },
        },
      })
      .catch(() => {});

    // eslint-disable-next-line no-console
    console.log(`[RecurringCharge] occurrence ${bookingId} paid → ACCEPTED (${dateStr})`);
    return 'PROCESSED';
  }

  // ── R1-B (James-ruled race fix): the T-24h sweep cancelled this occurrence
  // and the payment success arrived AFTER — money is never silently kept
  // against a cancelled clean. Full automatic refund + honest email.
  if (
    booking.agreementId &&
    booking.status === 'CANCELLED' &&
    booking.paymentStatus === 'CANCELED'
  ) {
    return handleLateOccurrencePayment(bookingId, pi);
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

  // A13-Xero-c: mirror the gross customer payment into Xero as Receive Money
  // (gated — no-op unless connected + mapped + flag on). Never blocks
  // processing. XERO-F1: the processing fee is no longer read here — the push
  // handler resolves it from the charge id per attempt, so a failed read
  // retries with the job instead of freezing an incomplete payload.
  await enqueueXeroPush({
    bookingId,
    event: 'PAYMENT_RECEIVED',
    occurredAt: new Date(pi.created * 1000).toISOString(),
    stripeChargeId: pi.chargeId ?? undefined,
  }).catch(() => {});

  // R1-A: first occurrence paid → the agreement gains its anchor; mint the
  // rolling window of SCHEDULED occurrences (fire-and-forget, idempotent).
  if (booking.agreementId) {
    const { mintOccurrences } = await import('@/lib/services/recurring.service');
    void mintOccurrences(booking.agreementId).catch(() => {});
  }

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
    // F9: the confirmation email fires here (pre-accept) — give the template
    // the booking's ACTUAL net so the reassurance clause never overpromises.
    hasBackups: (booking.backupCleanerIds ?? []).length > 0,
    autoAssignBackup: !!booking.autoAssignBackup,
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
    // F1: the cleaner's offer email is SANITISED — area only (city + postcode),
    // never the street address, plus their own net figure. The full emailData
    // address stays customer-side only.
    const { getTransferAmountPence } = await import('@/lib/services/transfer-amount');
    await sendCleanerAssignment(
      {
        ...emailData,
        area: [booking.addressCity, booking.addressPostcode].filter(Boolean).join(' '),
        cleanerEarnings: getTransferAmountPence(Number(booking.cleanerEarnings)) / 100,
        suppliesProvided: booking.suppliesProvided,
      },
      {
        name: booking.cleaner.name || '',
        email: booking.cleaner.email,
      }
    ).catch(() => {});
  }

  // Notify primary cleaner (and backups in COMBINED_OFFER)
  if (booking.cleaner) {
    await prisma.notification
      .create({
        data: {
          userId: booking.cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'New booking request',
          body: `New ${serviceLabelFromSlug(booking.serviceType)} booking on ${booking.date.toISOString().split('T')[0]} — please accept or decline.`,
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
            body: `A ${serviceLabelFromSlug(booking.serviceType)} job is available — first to accept gets it.`,
            data: { bookingId },
          },
        })
        .catch(() => {});
    }
    // F13 (James-ruled): the bell alone was the hole HERE too — F11 wired the
    // offer email into every cascade advance but not this fourth entry path,
    // so short-runway (COMBINED_OFFER) bookings offered their backups by bell
    // only. Same list the bells use, same F11 sanitised email (now carrying
    // F12's Accept/Decline row). Zero new cascade logic.
    await sendBackupOfferEmails(bookingId, booking.backupCleanerIds).catch(() => {});
  }

  return 'PROCESSED';
}

// ─── R1-B cancel/pay race handler ─────────────────────────────────────────────
//
// The T-24h sweep cancelled the occurrence (status CANCELLED + paymentStatus
// CANCELED — its exact signature) and the payment's success landed afterwards.
// James-ruled: automatic FULL refund through the existing refund service, an
// honest email, and a loud log. Idempotent: once refunded the row's
// paymentStatus is no longer CANCELED, so a replayed success event falls
// through to the normal no-op paths.

async function handleLateOccurrencePayment(
  bookingId: string,
  pi: PaymentSuccessInput['pi']
): Promise<PaymentSuccessOutcome> {
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      paymentStatus: true,
      agreementId: true,
      totalAmountCharged: true,
      totalPrice: true,
      guestEmail: true,
      guestName: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
      date: true,
      refundRecords: { where: { status: 'SUCCEEDED' }, select: { id: true } },
    },
  });
  if (
    !row ||
    !row.agreementId ||
    row.status !== 'CANCELLED' ||
    row.paymentStatus !== 'CANCELED' ||
    row.refundRecords.length > 0
  ) {
    return 'SKIPPED_ALREADY';
  }

  // eslint-disable-next-line no-console
  console.log(
    `[RecurringCharge] LATE PAYMENT on cancelled occurrence ${bookingId} — auto-refunded`
  );

  // Record the truth first — the charge DID succeed — so the refund service's
  // payment guards see reality; then refund in full through the existing path.
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: 'SUCCEEDED',
      ...(pi.chargeId ? { stripeChargeId: pi.chargeId } : {}),
    },
  });
  const amount = Number(row.totalAmountCharged ?? row.totalPrice);
  const { refundBooking } = await import('@/lib/services/refund.service');
  const refund = await refundBooking(
    bookingId,
    amount,
    'Late payment on a cancelled occurrence — automatic full refund',
    { triggeredBy: 'system' }
  );
  if (refund.status !== 'REFUNDED' && refund.status !== 'PARTIALLY_REFUNDED') {
    // Money is sitting against a cancelled clean — the loudest line we have.
    // eslint-disable-next-line no-console
    console.error(
      `[RecurringCharge] LATE PAYMENT refund FAILED for ${bookingId} (${refund.reason ?? refund.status}) — customer money held against a cancelled clean, INVESTIGATE`
    );
    return 'SKIPPED_ALREADY';
  }

  const to = row.client?.email ?? row.guestEmail;
  if (to) {
    const { sendOccurrenceLatePaymentRefunded } = await import('@/lib/services/email.service');
    await sendOccurrenceLatePaymentRefunded(bookingId).catch(() => {});
  }
  return 'SKIPPED_ALREADY';
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
