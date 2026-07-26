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
      // Window: start within 48h. Past-start stragglers are the cancel
      // sweep's problem, not a late charge.
      date: {
        lte: new Date(now + CHARGE_WINDOW_HOURS * HOUR_MS),
        gte: new Date(now - 24 * HOUR_MS),
      },
    },
    include: {
      client: { select: { id: true, stripeCustomerId: true } },
      agreement: {
        select: {
          id: true,
          bookings: {
            where: { paymentStatus: 'SUCCEEDED', stripePaymentIntentId: { not: null } },
            select: { stripePaymentIntentId: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
    take: 20,
  });

  let processed = 0;
  for (const b of due) {
    if (occurrenceStart(b.date, b.startTime) < now) continue; // past — cancel sweep owns it
    processed++;
    try {
      // Guests structurally have no saved card — the single attempt is an
      // immediate failure into the pay-now flow (their tokened checkout).
      const stripeCustomerId = b.client?.stripeCustomerId ?? null;
      if (!stripeCustomerId) {
        await failAttempt(b.id, 'no Stripe customer (guest or never saved)');
        continue;
      }

      // The saved method is the one that paid the agreement's FIRST clean —
      // the F7 machinery's card. Not reusable / missing → single attempt fails.
      const anchorPiId = b.agreement?.bookings[0]?.stripePaymentIntentId;
      if (!anchorPiId) {
        await failAttempt(b.id, 'no anchor payment intent on the agreement');
        continue;
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
        continue;
      }

      const amountPence = Math.round(Number(b.totalAmountCharged ?? b.totalPrice) * 100);
      const pi = await stripe.paymentIntents.create(
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
      await prisma.booking.update({
        where: { id: b.id },
        data: { stripePaymentIntentId: pi.id },
      });

      if (pi.status === 'succeeded') {
        const { processPaymentSuccess } = await import('@/lib/services/payment-success.service');
        const chargeId =
          typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
        const outcome = await processPaymentSuccess({
          bookingId: b.id,
          pi: {
            id: pi.id,
            created: pi.created,
            currency: pi.currency,
            amountReceived: pi.amount_received,
            chargeId: chargeId ?? null,
          },
        });
        // eslint-disable-next-line no-console
        console.log(`[RecurringCharge] T-48h charge SUCCEEDED for occurrence ${b.id} (${outcome})`);
      } else {
        // requires_action / processing / anything else: the single off-session
        // attempt did not complete — SCA and friends are handled natively at
        // the on-session pay-now checkout (James-ruled; no special handling).
        await failAttempt(b.id, `off-session PI status ${pi.status}`);
      }
    } catch (err) {
      // Declines throw (card_error) — that IS the single failed attempt.
      const msg = err instanceof Error ? err.message : String(err);
      await failAttempt(b.id, `charge attempt threw: ${msg}`).catch(() => {});
    }
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
    if (occurrenceStart(b.date, b.startTime) - now > CANCEL_CUTOFF_HOURS * HOUR_MS) continue;
    processed++;

    const claimed = await prisma.booking.updateMany({
      where: { id: b.id, status: 'SCHEDULED' },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Payment not received for this occurrence',
      },
    });
    if (claimed.count === 0) continue;

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
