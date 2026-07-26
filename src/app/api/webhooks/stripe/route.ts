import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import prisma from '@/lib/db/prisma';
import { sendPaymentFailureNotification } from '@/lib/services/email.service';
import { processPaymentSuccess } from '@/lib/services/payment-success.service';
import { handleTopupPiFailed, handleTopupPiSucceeded } from '@/lib/services/topup.service';
import { enqueueStripePayout } from '@/lib/services/xero-push.service';
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

  // M4 TWO-PHASE idempotency: the row records RECEIPT (processed=false); only
  // after every handler below completes is it marked processed=true. A retry of
  // a received-but-unprocessed event RE-RUNS the handlers (all verified
  // re-run-safe — see per-event notes at each block) instead of being swallowed
  // by a short-circuit, so a mid-handler crash can no longer strand a paid
  // booking behind a poisoned idempotency row.
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });

  if (existing?.processed) {
    return NextResponse.json({ received: true });
  }

  if (!existing) {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payload: JSON.parse(rawBody),
        processed: false,
      },
    });
  }

  const markProcessed = async () => {
    await prisma.stripeWebhookEvent
      .update({ where: { id: event.id }, data: { processed: true } })
      .catch((e) => {
        // Non-fatal: the event simply re-runs on the next retry (handlers are
        // re-run-safe); log so a stuck-unprocessed event is visible.
        // eslint-disable-next-line no-console
        console.warn('[Stripe Webhook] could not mark processed', event.id, e);
      });
  };

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

    await markProcessed();
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

      // Two-stage flow: Stripe completion may be the LAST go-live input —
      // fire the exactly-once live email check (fire-and-forget).
      if (account.charges_enabled && account.payouts_enabled) {
        const { maybeMarkLive } = await import('@/lib/services/go-live.service');
        void maybeMarkLive(profile.userId);
      }
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
      // M4: all processing lives in processPaymentSuccess — the SAME path the
      // scheduler's stranded-payment sweep uses. Re-run safe: the status flip is
      // an atomic claim (only one caller ever runs the side-effects), so a
      // webhook retry after a mid-handler crash re-runs to completion instead of
      // stranding the booking. A throw here leaves the event unprocessed → 500 →
      // Stripe retries.
      const chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : (pi.latest_charge as Stripe.Charge)?.id;
      await processPaymentSuccess({
        bookingId,
        pi: {
          id: pi.id,
          created: pi.created,
          currency: pi.currency,
          amountReceived: pi.amount_received,
          chargeId: chargeId ?? null,
        },
      });
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.bookingId;

    if (bookingId) {
      // R1-B: SCHEDULED occurrences are the recurring-charge service's
      // problem, not this handler's — it already sent the specific "pay now to
      // keep your slot" email on the single failed attempt, and the T-24h
      // sweep owns the cancellation. The generic failure email and the
      // PENDING-teardown below must not fire for them.
      const failedBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, agreementId: true },
      });
      if (failedBooking?.agreementId && failedBooking.status === 'SCHEDULED') {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: 'FAILED' },
        });
        // eslint-disable-next-line no-console
        console.log(
          `[RecurringCharge] payment_failed webhook for occurrence ${bookingId} — marked FAILED, messaging owned by the charge service`
        );
        return NextResponse.json({ received: true });
      }

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

      // F5: guests hear about failed payments too — same email, guest recipient
      // ("you have NOT been charged" is in the template for both audiences).
      const failureMessage = pi.last_payment_error?.message || 'Payment could not be processed';
      if (booking && !booking.client && booking.guestEmail) {
        await sendPaymentFailureNotification(
          {
            bookingId,
            customerName: booking.guestName || 'there',
            reason: failureMessage,
          },
          { name: booking.guestName || 'there', email: booking.guestEmail }
        ).catch(() => {});
      }
      if (booking?.client) {
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

  // B1.3 dispute early-warning: a new chargeback alerts the admin immediately —
  // email with the evidence deadline + the dashboard banner (which reads the
  // stored webhook events, so receipt alone is enough to surface it). Alerting
  // ONLY — the money legs stay with the XERO-F2 handler below. Re-run safe:
  // resending one email on a webhook retry is acceptable for an alert.
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    const booking = chargeId
      ? await prisma.booking.findUnique({
          where: { stripeChargeId: chargeId },
          include: { client: { select: { name: true } } },
        })
      : null;
    const dueBy = dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    const bookingRef = booking
      ? booking.id.substring(0, 8).toUpperCase()
      : `charge ${chargeId ?? 'unknown'}`;
    // eslint-disable-next-line no-console
    console.error(
      `[Dispute] OPENED ${dispute.id} on ${bookingRef} — £${(dispute.amount / 100).toFixed(2)}, respond by ${dueBy ?? 'UNKNOWN'}`
    );
    const { sendAdminDisputeOpened } = await import('@/lib/services/email.service');
    await sendAdminDisputeOpened({
      bookingRef,
      bookingId: booking?.id ?? null,
      customerName: booking?.client?.name || booking?.guestName || 'Unknown',
      amount: `£${(dispute.amount / 100).toFixed(2)}`,
      reason: dispute.reason || 'not given',
      evidenceDueBy: dueBy,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[Dispute] alert email FAILED for ${dispute.id} — banner still shows it`, e);
    });
  }

  // XERO-F2 (James-ruled): chargeback money movements. funds_withdrawn debits
  // the real Stripe balance (dispute amount + Stripe's dispute fee);
  // funds_reinstated (dispute won) credits it back. Mirror both through the
  // existing push pipeline against the booking's proportional splits — same
  // idempotency (dispute id as externalRef), same loudness, same retries.
  // NB: these events reach us only once added to the PLATFORM webhook
  // destination in the Stripe dashboard (James's step).
  if (
    event.type === 'charge.dispute.funds_withdrawn' ||
    event.type === 'charge.dispute.funds_reinstated'
  ) {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    const booking = chargeId
      ? await prisma.booking.findUnique({ where: { stripeChargeId: chargeId } })
      : null;
    if (!booking) {
      // eslint-disable-next-line no-console
      console.error(
        `[xero-push] dispute ${dispute.id} (${event.type}) has no matching booking for charge ${chargeId} — NOT booked to Xero`
      );
    } else {
      const withdrawn = event.type === 'charge.dispute.funds_withdrawn';
      const amountPounds = dispute.amount / 100;
      // Stripe's dispute fee rides the dispute's balance transactions; the
      // relevant txn for this event is the newest one. |fee| covers both the
      // charge (withdrawn) and the return (reinstated). If unreadable, the
      // payload goes out incomplete and the push handler REFUSES loudly
      // (XERO-F2 guard) — never posted short.
      const txns = dispute.balance_transactions ?? [];
      const latestTxn = txns.length > 0 ? txns[txns.length - 1] : null;
      const { calculateCleanerSharePence } = await import('@/lib/services/refund.service');
      const { enqueueXeroPush } = await import('@/lib/services/xero-push.service');
      await enqueueXeroPush({
        bookingId: booking.id,
        event: withdrawn ? 'DISPUTE_WITHDRAWN' : 'DISPUTE_REINSTATED',
        externalRef: `${dispute.id}:${event.type}`,
        occurredAt: new Date(event.created * 1000).toISOString(),
        disputeAmount: amountPounds,
        disputeFee: latestTxn ? Math.abs(latestTxn.fee) / 100 : undefined,
        cleanerRefundPortion: calculateCleanerSharePence(amountPounds, booking) / 100,
      }).catch(() => {});
    }
  }

  // A13-Xero reconciliation: the actual Stripe→bank deposit. Book it as a Xero bank
  // transfer (Stripe-balance → settlement bank) and record the balance-transaction
  // bundle it settles for the audit trail. PLATFORM payouts only — connected-account
  // payout events carry event.account and are ignored (cleaner transfers are booked
  // separately as PAYOUT). Gated + test-mode-blocked inside enqueueStripePayout.
  if (event.type === 'payout.paid' && !event.account) {
    const payout = event.data.object as Stripe.Payout;
    const occurredAt = new Date((payout.arrival_date ?? payout.created) * 1000).toISOString();

    // The balance transactions this payout bundles — the tie between the lump
    // deposit and its constituent charges/refunds/transfers.
    const items: { id: string; type: string; amount: number }[] = [];
    let bundleUnavailable = false;
    try {
      for await (const bt of stripe.balanceTransactions.list({ payout: payout.id, limit: 100 })) {
        items.push({ id: bt.id, type: bt.type, amount: bt.amount });
        if (items.length >= 2000) break; // safety cap on unusually large payouts
      }
    } catch {
      bundleUnavailable = true;
    }
    const bundle = JSON.stringify(
      bundleUnavailable
        ? { payoutId: payout.id, bundleUnavailable: true }
        : { payoutId: payout.id, count: items.length, items }
    );

    await enqueueStripePayout({
      payoutId: payout.id,
      amount: payout.amount / 100,
      occurredAt,
      bundle,
    }).catch(() => {});
  }

  await markProcessed();
  return NextResponse.json({ received: true });
}
