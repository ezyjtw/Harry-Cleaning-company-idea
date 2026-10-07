// R1-B (James-ruled): the T-48h occurrence charge — SINGLE ATTEMPT, no retry
// ladder. The law, as amended:
//   · At T-48h, one off-session attempt against the customer's saved card
//     (the F7 Customer machinery — the method that paid the agreement's first
//     clean). Anything short of 'succeeded' — decline, SCA required, no saved
//     card, guest — is a FAILURE of the single attempt.
//   · Failure → immediate "pay now to keep your slot" email; the link lands on
//     the normal ON-SESSION checkout, where SCA is handled natively by the
//     PaymentElement. No off-session SCA plumbing exists here, by design.
//   · Still unpaid at T-24h → the occurrence auto-cancels with the honest
//     email; the cleaner is told the slot is free; the AGREEMENT SURVIVES —
//     one missed payment kills one occurrence, never the schedule.
//   · Three-consecutive-failures agreement pause: LEDGERED, not built.
// F23 (James-ruled): the SAME single attempt now also fires at cleaner-accept
// for the FIRST occurrence ("the first clean charges now") — one shared money
// path, attemptOccurrenceCharge(), never two. With no checkout first-clean
// any more, the saved-card anchor falls back to the agreement's TRIAL booking
// (the completed clean the proposal was made from — the F7 card that paid it).
// Occurrences are BOOKINGS: payment success rides processPaymentSuccess's
// occurrence claim (SCHEDULED→ACCEPTED), so Xero, receipts and lifecycle all
// ride the existing laws — no parallel money path.

import type Stripe from 'stripe';

import { RECURRING_AUTOCHARGE } from '@/lib/config/features';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { isUnknownStripeOutcome, nextRetryAt } from '@/lib/money/ledger';
import stripe from '@/lib/stripe';
import { bookingStartOrDayStartUtc } from '@/lib/time/booking-time';

export const CHARGE_WINDOW_HOURS = 48;
export const CANCEL_CUTOFF_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** Occurrence start as a real instant: London wall time on the stored day
 *  (B3 sweep, through the one helper). */
function occurrenceStart(date: Date, startTime: string): number {
  return bookingStartOrDayStartUtc(date, startTime).getTime();
}

async function sendPayNow(bookingId: string): Promise<void> {
  const { sendOccurrencePayNow } = await import('@/lib/services/email.service');
  await sendOccurrencePayNow(bookingId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[RecurringCharge] pay-now email failed for ${bookingId}:`, e);
  });
}

/** Mark the single attempt as failed and tell the customer to pay on-session.
 *  paymentStatus FAILED doubles as the attempt marker — the sweep never picks
 *  a FAILED occurrence again. */
async function failAttempt(bookingId: string, reason: string): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: 'FAILED' },
  });
  // eslint-disable-next-line no-console
  console.log(
    `[RecurringCharge] SINGLE ATTEMPT FAILED for ${bookingId}: ${reason} — pay-now email sent`
  );
  await sendPayNow(bookingId);
  // R10 Lane 1 (James-ruled): the hold-begin BELL rides the email — slot
  // held, payment needed, the deadline stated. Best-effort, never blocks.
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clientId: true, date: true, startTime: true },
    });
    if (b?.clientId) {
      const releaseAt = new Date(occurrenceStart(b.date, b.startTime) - 24 * HOUR_MS);
      const when = releaseAt.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      await prisma.notification.create({
        data: {
          userId: b.clientId,
          type: 'SYSTEM',
          title: 'Payment needed to keep your slot',
          body: `We could not take payment for your regular clean. Your slot is held until ${when}. Pay before then and everything carries on as planned.`,
          data: { bookingId, url: `/pay/${bookingId}` },
        },
      });
    }
  } catch {
    // comms are best-effort; the email already carries the message
  }
}

/**
 * THE single off-session attempt for one occurrence — shared by the T-48h
 * sweep and the F23 accept-time first charge. Loads the row fresh and guards
 * on SCHEDULED + paymentStatus PENDING, so both callers are idempotent against
 * each other (whichever runs second finds the attempt marker and skips).
 */
export async function attemptOccurrenceCharge(
  bookingId: string
): Promise<'succeeded' | 'failed' | 'skipped'> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { select: { id: true, stripeCustomerId: true } },
      agreement: {
        select: {
          id: true,
          trialBookingId: true,
          bookings: {
            where: { paymentStatus: 'SUCCEEDED', stripePaymentIntentId: { not: null } },
            select: { stripePaymentIntentId: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!b || !b.agreement) return 'skipped';
  if (b.status !== 'SCHEDULED' || b.paymentStatus !== 'PENDING') return 'skipped';
  // N9 (James-ruled): while an earlier attempt's outcome is unknown nothing
  // charges again; the sweep reconciles it from Stripe.
  if (b.chargeOutcomeUnknownAt) return 'skipped';

  try {
    // Guests structurally have no saved card — the single attempt is an
    // immediate failure into the pay-now flow (their tokened checkout).
    const stripeCustomerId = b.client?.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      await failAttempt(b.id, 'no Stripe customer (guest or never saved)');
      return 'failed';
    }

    // The saved method is the one that paid the agreement's first clean — or,
    // F23, the TRIAL clean the proposal was made from (no checkout first-clean
    // exists any more). Not reusable / missing → single attempt fails.
    let anchorPiId = b.agreement.bookings[0]?.stripePaymentIntentId ?? null;
    if (!anchorPiId && b.agreement.trialBookingId) {
      const trial = await prisma.booking.findUnique({
        where: { id: b.agreement.trialBookingId },
        select: { stripePaymentIntentId: true, paymentStatus: true },
      });
      if (trial?.paymentStatus === 'SUCCEEDED') anchorPiId = trial.stripePaymentIntentId;
    }
    if (!anchorPiId) {
      await failAttempt(b.id, 'no anchor payment intent on the agreement');
      return 'failed';
    }
    const anchorPi = await stripe.paymentIntents.retrieve(anchorPiId);
    const methodId =
      typeof anchorPi.payment_method === 'string'
        ? anchorPi.payment_method
        : anchorPi.payment_method?.id;
    let reusable = false;
    if (methodId) {
      try {
        const method = await stripe.paymentMethods.retrieve(methodId);
        reusable = method.customer === stripeCustomerId;
      } catch {
        reusable = false;
      }
    }
    if (!reusable || !methodId) {
      await failAttempt(b.id, 'saved card not reusable');
      return 'failed';
    }

    const amountPence = Math.round(Number(b.totalAmountCharged ?? b.totalPrice) * 100);
    // N9: the deterministic key, stored before the call so the reconciler
    // can always name the attempt.
    const idempotencyKey = `recurring_occurrence_${b.id}`;
    await prisma.booking.update({
      where: { id: b.id },
      data: { chargeIdempotencyKey: idempotencyKey },
    });
    const params = {
      amount: amountPence,
      currency: 'gbp' as const,
      customer: stripeCustomerId,
      payment_method: methodId,
      confirm: true,
      off_session: true,
      metadata: { bookingId: b.id, type: 'recurring_occurrence' },
    };
    // MONEY LAW: the try/catch around the CHARGE is exactly that wide — once
    // Stripe reports 'succeeded', no downstream error may ever mark the
    // attempt failed (a paid clean must never receive a pay-now email).
    let pi: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
    try {
      // Single attempt held at the Stripe layer too: a crash-and-rerun
      // resolves to the SAME PaymentIntent, never a second charge.
      pi = await stripe.paymentIntents.create(params, { idempotencyKey });
    } catch (chargeErr) {
      if (!isUnknownStripeOutcome(chargeErr)) {
        // Declines throw (card_error) — that IS the single failed attempt.
        const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
        await failAttempt(b.id, `charge attempt threw: ${msg}`).catch(() => {});
        return 'failed';
      }
      // N9: a connection or API error says nothing about the card. One
      // same-key retry (Stripe answers with the original if it landed).
      try {
        pi = await stripe.paymentIntents.create(params, { idempotencyKey });
      } catch (retryErr) {
        if (!isUnknownStripeOutcome(retryErr)) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          await failAttempt(b.id, `charge attempt threw: ${msg}`).catch(() => {});
          return 'failed';
        }
        await markChargeUnknown(b.id);
        // Not 'failed': no pay-now email while the card may have been charged.
        return 'skipped';
      }
    }
    await prisma.booking
      .update({ where: { id: b.id }, data: { stripePaymentIntentId: pi.id } })
      .catch(() => {});

    if (pi.status === 'succeeded') {
      // Post-success processing failures are LOUD but never flip the
      // outcome — the safety-net sweep / webhook replay completes them.
      try {
        const { processPaymentSuccess } = await import('@/lib/services/payment-success.service');
        const chargeId =
          typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
        const outcome = await processPaymentSuccess({
          bookingId: b.id,
          pi: {
            id: pi.id,
            created: Number.isFinite(pi.created) ? pi.created : Math.floor(Date.now() / 1000),
            currency: pi.currency,
            amountReceived: pi.amount_received,
            chargeId: chargeId ?? null,
          },
        });
        // eslint-disable-next-line no-console
        console.log(`[RecurringCharge] charge SUCCEEDED for occurrence ${b.id} (${outcome})`);
      } catch (postErr) {
        // eslint-disable-next-line no-console
        console.error(
          `[RecurringCharge] charge SUCCEEDED for ${b.id} but post-processing failed — sweep will complete it:`,
          postErr
        );
      }
      return 'succeeded';
    }
    // requires_action / processing / anything else: the single off-session
    // attempt did not complete — SCA and friends are handled natively at
    // the on-session pay-now checkout (James-ruled; no special handling).
    await failAttempt(b.id, `off-session PI status ${pi.status}`);
    return 'failed';
  } catch (err) {
    // Pre-charge resolution errors only (customer/method lookups) — the
    // charge itself has its own catch above.
    const msg = err instanceof Error ? err.message : String(err);
    await failAttempt(b.id, `attempt setup threw: ${msg}`).catch(() => {});
    return 'failed';
  }
}

/** N9: the attempt's outcome is unknown; the sweep reconciles it. */
async function markChargeUnknown(bookingId: string): Promise<void> {
  const now = new Date();
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      chargeOutcomeUnknownAt: now,
      chargeReconcileCount: 0,
      chargeNextReconcileAt: nextRetryAt(now, 0),
    },
  });
  const { AuditService } = await import('./audit.service');
  await AuditService.log({
    action: 'RECURRING_CHARGE_UNKNOWN',
    entityType: 'Booking',
    entityId: bookingId,
  }).catch(() => {});
  log.error('recurring_charge', 'charge_outcome_unknown', { bookingId });
}

const DAY_MS = 24 * HOUR_MS;

/**
 * N9 reconciliation (read only): list the customer's payment intents since
 * the unknown attempt and match metadata.bookingId. Succeeded → the normal
 * success path. Declined or canceled → the single failed attempt (pay-now).
 * None after 24 hours → the charge never reached Stripe: the failed attempt.
 * Otherwise back off and look again. Never creates a charge.
 */
export async function reconcileUnknownOccurrenceCharge(
  bookingId: string
): Promise<'SUCCEEDED' | 'FAILED' | 'PENDING' | 'NOT_UNKNOWN'> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      paymentStatus: true,
      chargeOutcomeUnknownAt: true,
      chargeReconcileCount: true,
      client: { select: { stripeCustomerId: true } },
    },
  });
  if (!b?.chargeOutcomeUnknownAt) return 'NOT_UNKNOWN';
  const since = b.chargeOutcomeUnknownAt;
  const clear = {
    chargeOutcomeUnknownAt: null,
    chargeNextReconcileAt: null,
  };
  // A webhook already settled it: clear the marker, send nothing twice.
  if (b.paymentStatus !== 'PENDING') {
    await prisma.booking.update({ where: { id: bookingId }, data: clear });
    return b.paymentStatus === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';
  }
  const backoff = async (result: string) => {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        chargeReconcileCount: b.chargeReconcileCount + 1,
        chargeNextReconcileAt: nextRetryAt(new Date(), b.chargeReconcileCount + 1),
      },
    });
    log.warn('recurring_charge', 'charge_reconcile_pending', { bookingId, result });
  };
  const customer = b.client?.stripeCustomerId;
  if (!customer) {
    await backoff('no customer');
    return 'PENDING';
  }
  let found: Stripe.PaymentIntent | null = null;
  try {
    const list = await stripe.paymentIntents.list({
      customer,
      created: { gte: Math.floor(since.getTime() / 1000) - 3600 },
      limit: 100,
    });
    found = list.data.find((p) => p.metadata?.bookingId === bookingId) ?? null;
  } catch {
    await backoff('stripe read failed');
    return 'PENDING';
  }
  const { AuditService } = await import('./audit.service');
  if (found?.status === 'succeeded') {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { ...clear, stripePaymentIntentId: found.id },
    });
    const { processPaymentSuccess } = await import('@/lib/services/payment-success.service');
    const chargeId =
      typeof found.latest_charge === 'string' ? found.latest_charge : found.latest_charge?.id;
    await processPaymentSuccess({
      bookingId,
      pi: {
        id: found.id,
        created: found.created,
        currency: found.currency,
        amountReceived: found.amount_received,
        chargeId: chargeId ?? null,
      },
    });
    await AuditService.log({
      action: 'RECURRING_CHARGE_RECONCILED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { outcome: 'SUCCEEDED', paymentIntentId: found.id },
    }).catch(() => {});
    return 'SUCCEEDED';
  }
  const declined =
    found &&
    (found.status === 'canceled' ||
      (found.status === 'requires_payment_method' && !!found.last_payment_error));
  const neverArrived = !found && Date.now() - since.getTime() > DAY_MS;
  if (declined || neverArrived || (found && found.status === 'requires_action')) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { ...clear, ...(found ? { stripePaymentIntentId: found.id } : {}) },
    });
    await AuditService.log({
      action: 'RECURRING_CHARGE_RECONCILED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { outcome: 'FAILED', paymentIntentId: found?.id ?? null },
    }).catch(() => {});
    await failAttempt(
      bookingId,
      found
        ? `reconciled: off-session PI status ${found.status}`
        : 'reconciled: no charge reached Stripe'
    );
    return 'FAILED';
  }
  await backoff(found ? `stripe status ${found.status}` : 'not found yet');
  return 'PENDING';
}

/** Sweep (rides sweepStrandedPayments): due unknown occurrence charges. */
export async function sweepUnknownOccurrenceCharges(): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.booking.findMany({
    where: {
      chargeOutcomeUnknownAt: { not: null },
      OR: [{ chargeNextReconcileAt: null }, { chargeNextReconcileAt: { lte: now } }],
    },
    select: { id: true },
    take: 20,
  });
  let processed = 0;
  for (const d of due) {
    try {
      const r = await reconcileUnknownOccurrenceCharge(d.id);
      if (r === 'SUCCEEDED' || r === 'FAILED') processed++;
    } catch (err) {
      log.error('recurring_charge', 'charge_reconcile_threw', { bookingId: d.id }, err);
    }
  }
  return { processed };
}

/** T-48h sweep: one off-session attempt per due occurrence. Idempotent — only
 *  paymentStatus PENDING occurrences are candidates; any outcome (SUCCEEDED /
 *  FAILED) removes them from the pool. Stripe-side idempotencyKey pins the
 *  attempt even across a crash mid-sweep. */
export async function processRecurringCharges(): Promise<{ processed: number }> {
  if (!RECURRING_AUTOCHARGE) return { processed: 0 };
  const now = Date.now();

  const due = await prisma.booking.findMany({
    where: {
      status: 'SCHEDULED',
      paymentStatus: 'PENDING',
      chargeOutcomeUnknownAt: null, // N9: reconciled, never re-attempted
      agreement: { status: 'ACTIVE' },
      // F22 (James-ruled): BOTH sweeps window on the occurrence's actual
      // startTime — this date filter is only an indexable prefilter (a day of
      // margin each side); the precise T-48h gate is occurrenceStart() below,
      // the SAME expression the cancel sweep cuts on. Charge and cancel can
      // never again read different clocks across a night.
      date: {
        lte: new Date(now + (CHARGE_WINDOW_HOURS + 24) * HOUR_MS),
        gte: new Date(now - 24 * HOUR_MS),
      },
    },
    select: { id: true, date: true, startTime: true },
    take: 20,
  });

  let processed = 0;
  for (const b of due) {
    const startMs = occurrenceStart(b.date, b.startTime);
    if (startMs < now) continue; // past — cancel sweep owns it
    // F22: the precise charge window — startTime-based, same clock as cancel.
    if (startMs - now > CHARGE_WINDOW_HOURS * HOUR_MS) continue; // not yet due
    processed++;
    await attemptOccurrenceCharge(b.id);
  }
  return { processed };
}

/** T-24h sweep: unpaid occurrences auto-cancel. The agreement SURVIVES — the
 *  next occurrence charges normally; the slot frees via the blocking clause. */
export async function cancelUnpaidOccurrences(): Promise<{ processed: number }> {
  if (!RECURRING_AUTOCHARGE) return { processed: 0 };
  const now = Date.now();

  const unpaid = await prisma.booking.findMany({
    where: {
      status: 'SCHEDULED',
      // RECORD-TRUTH (James-ruled): CANCELED joins the pool — an occurrence
      // whose intent died (pay-now opened then abandoned, or a legacy
      // canceled-webhook stomp) is still unpaid and must not escape the
      // T-24h cut. The claim below re-asserts the same unpaid set — the
      // safety beneath: SUCCEEDED can never be swept.
      paymentStatus: { in: ['PENDING', 'FAILED', 'REQUIRES_ACTION', 'CANCELED'] },
      // N9: an occurrence whose charge may have landed is never cancelled as
      // unpaid; it waits for the reconciler (and stuck-money shows it).
      chargeOutcomeUnknownAt: null,
      date: { lte: new Date(now + CANCEL_CUTOFF_HOURS * HOUR_MS) },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      cleanerId: true,
      clientId: true,
      stripePaymentIntentId: true,
      paymentStatus: true,
    },
    take: 20,
  });

  let processed = 0;
  for (const b of unpaid) {
    // F22: cancel cuts on the occurrence's actual startTime — the SAME
    // occurrenceStart() expression the charge sweep windows on.
    if (occurrenceStart(b.date, b.startTime) - now > CANCEL_CUTOFF_HOURS * HOUR_MS) continue;
    processed++;

    // F22 (James-ruled): the claim itself re-asserts UNPAID — a payment that
    // lands between the read above and this write makes the claim match zero
    // rows instead of cancelling a paid clean. A paid occurrence inside the
    // T-24h window is a confirmed clean, never a cancellation candidate.
    const claimed = await prisma.booking.updateMany({
      where: {
        id: b.id,
        status: 'SCHEDULED',
        paymentStatus: { in: ['PENDING', 'FAILED', 'REQUIRES_ACTION', 'CANCELED'] },
        chargeOutcomeUnknownAt: null,
      },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Payment not received for this occurrence',
      },
    });
    if (claimed.count === 0) {
      // Somebody changed the row under us. If it is now PAID, say so LOUDLY —
      // with the guard above this line firing is itself a finding to
      // investigate, never noise (F22 watched-log law).
      const nowRow = await prisma.booking.findUnique({
        where: { id: b.id },
        select: { paymentStatus: true, status: true },
      });
      if (nowRow?.paymentStatus === 'SUCCEEDED') {
        // eslint-disable-next-line no-console
        console.error(
          `[RecurringCharge] CANCEL SWEEP MET A PAID OCCURRENCE ${b.id} inside the T-24h window (status ${nowRow.status}) — skipped, INVESTIGATE how it got here`
        );
      }
      continue;
    }

    // Best-effort PI teardown (H53 spirit — no dangling authorizations).
    if (b.stripePaymentIntentId && b.paymentStatus !== 'SUCCEEDED') {
      await stripe.paymentIntents.cancel(b.stripePaymentIntentId).catch(() => {});
    }

    const dateStr = b.date.toISOString().split('T')[0];
    // eslint-disable-next-line no-console
    console.log(
      `[RecurringCharge] UNPAID AT T-24h — occurrence ${b.id} (${dateStr}) auto-cancelled; agreement untouched`
    );

    const { sendOccurrenceAutoCancelled } = await import('@/lib/services/email.service');
    await sendOccurrenceAutoCancelled(b.id).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[RecurringCharge] auto-cancel email failed for ${b.id}:`, e);
    });
    // R10 Lane 1 (James-ruled): the honest release notice reaches the
    // CUSTOMER as a bell too, not only the email. Best-effort.
    if (b.clientId) {
      await prisma.notification
        .create({
          data: {
            userId: b.clientId,
            type: 'SYSTEM',
            title: 'This week’s clean is cancelled',
            body: `Payment did not go through in time, so just the clean on ${b.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} has been cancelled. You have not been charged for it. Your regular arrangement carries on as normal.`,
            data: { bookingId: b.id },
          },
        })
        .catch(() => {});
    }
    await prisma.notification
      .create({
        data: {
          userId: b.cleanerId,
          type: 'SYSTEM',
          title: 'Regular clean not confirmed',
          body: `The regular clean on ${b.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} was not paid in time and has been cancelled, so that slot is free again. The standing arrangement continues as normal.`,
          data: { bookingId: b.id },
        },
      })
      .catch(() => {});
  }
  return { processed };
}
