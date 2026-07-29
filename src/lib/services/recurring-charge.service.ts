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

import { RECURRING_AUTOCHARGE } from '@/lib/config/features';
import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export const CHARGE_WINDOW_HOURS = 48;
export const CANCEL_CUTOFF_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** Occurrence start as a real instant: date (UTC midnight) + startTime. */
function occurrenceStart(date: Date, startTime: string): number {
  const [h, m] = startTime.split(':').map(Number);
  return date.getTime() + (h * 60 + m) * 60 * 1000;
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
    // MONEY LAW: the try/catch around the CHARGE is exactly that wide — once
    // Stripe reports 'succeeded', no downstream error may ever mark the
    // attempt failed (a paid clean must never receive a pay-now email).
    let pi: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
    try {
      pi = await stripe.paymentIntents.create(
        {
          amount: amountPence,
          currency: 'gbp',
          customer: stripeCustomerId,
          payment_method: methodId,
          confirm: true,
          off_session: true,
          metadata: { bookingId: b.id, type: 'recurring_occurrence' },
        },
        // Single attempt held at the Stripe layer too: a crash-and-rerun
        // resolves to the SAME PaymentIntent, never a second charge.
        { idempotencyKey: `recurring_occurrence_${b.id}` }
      );
    } catch (chargeErr) {
      // Declines throw (card_error) — that IS the single failed attempt.
      const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
      await failAttempt(b.id, `charge attempt threw: ${msg}`).catch(() => {});
      return 'failed';
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
      paymentStatus: { in: ['PENDING', 'FAILED', 'REQUIRES_ACTION'] },
      date: { lte: new Date(now + CANCEL_CUTOFF_HOURS * HOUR_MS) },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      cleanerId: true,
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
        paymentStatus: { in: ['PENDING', 'FAILED', 'REQUIRES_ACTION'] },
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
    await prisma.notification
      .create({
        data: {
          userId: b.cleanerId,
          type: 'SYSTEM',
          title: 'Regular clean not confirmed',
          body: `The regular clean on ${dateStr} was not paid in time and has been cancelled — that slot is free again. The standing arrangement continues as normal.`,
          data: { bookingId: b.id },
        },
      })
      .catch(() => {});
  }
  return { processed };
}
