// ─── A5.3 Top-Up Service ──────────────────────────────────────────
//
// Handles charging the customer the price difference when a pricier
// backup cleaner is provisionally accepted.
//
// Never auto-charges. Only runs after customer sets topupApproved = true.
// Uses the original PI's payment_method if reusable (attached to customer),
// otherwise returns client_secret for on-session card entry.
//
// TopupRecord statuses: PENDING, SUCCEEDED, FAILED, UNKNOWN, EXPIRED, DECLINED

import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';
import { handleProvisionalFailure } from './cascade.service';
import { computeMoneySnapshot } from './money-snapshot.service';

// ─── Error Classification (mirrors refund.service.ts) ─────────

function isUnknownOutcome(err: unknown): boolean {
  if (err && typeof err === 'object' && 'type' in err) {
    const stripeErr = err as { type: string };
    return stripeErr.type === 'StripeConnectionError' || stripeErr.type === 'StripeAPIError';
  }
  return false;
}

// ─── Types ────────────────────────────────────────────────────

export type TopupOutcome = 'SUCCEEDED' | 'REQUIRES_ACTION' | 'REQUIRES_CARD' | 'FAILED' | 'UNKNOWN';

export interface TopupResult {
  outcome: TopupOutcome;
  clientSecret?: string;
  topupRecordId?: string;
  reason?: string;
}

// ─── Service ──────────────────────────────────────────────────

export async function executeTopup(bookingId: string): Promise<TopupResult> {
  // 1. Load booking with guards
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      topupApproved: true,
      topupAmount: true,
      provisionalCleanerId: true,
      provisionalPrice: true,
      cascadePhase: true,
      status: true,
      stripePaymentIntentId: true,
      clientId: true,
      client: { select: { stripeCustomerId: true } },
      topupRecords: { where: { status: 'SUCCEEDED' }, select: { id: true } },
    },
  });

  if (!booking) return { outcome: 'FAILED', reason: 'Booking not found' };

  // Structural guard: never charge without explicit approval
  if (!booking.topupApproved) {
    return { outcome: 'FAILED', reason: 'Top-up not approved by customer' };
  }

  if (booking.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    return { outcome: 'FAILED', reason: 'Booking is not in provisional state' };
  }

  if (!booking.topupAmount || Number(booking.topupAmount) <= 0) {
    return { outcome: 'FAILED', reason: 'No top-up amount set' };
  }

  // Idempotency: already succeeded
  if (booking.topupRecords.length > 0) {
    return { outcome: 'SUCCEEDED', reason: 'Top-up already completed' };
  }

  if (!booking.stripePaymentIntentId) {
    return { outcome: 'FAILED', reason: 'No original payment intent' };
  }

  // F5: guests have no Stripe customer — they take the ON-SESSION path below
  // (a fresh PI without `customer`; the tokened approval page collects the card
  // for the difference). Registered customers keep the saved-card fast path.
  const stripeCustomerId = booking.client?.stripeCustomerId ?? null;

  const topupAmountPounds = Number(booking.topupAmount);
  const topupAmountPence = Math.round(topupAmountPounds * 100);

  // 2. Create TopupRecord (PENDING)
  const topupRecord = await prisma.topupRecord.create({
    data: {
      bookingId,
      amount: topupAmountPounds,
      reason: 'Price reconciliation top-up',
    },
  });

  // 3. Check reusability of original payment method (Fix B)
  const originalPi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
  const savedMethodId =
    typeof originalPi.payment_method === 'string'
      ? originalPi.payment_method
      : originalPi.payment_method?.id;

  let methodIsReusable = false;
  if (savedMethodId && stripeCustomerId) {
    try {
      const method = await stripe.paymentMethods.retrieve(savedMethodId);
      methodIsReusable = method.customer === stripeCustomerId;
    } catch {
      // Method not retrievable — treat as not reusable
    }
  }

  // 4. Attempt charge
  const attempt = topupRecord.attempt + 1;
  const idempotencyKey = `topup_${topupRecord.id}_v${attempt}`;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- savedMethodId is set when methodIsReusable is true
  if (methodIsReusable && savedMethodId && stripeCustomerId) {
    return executeOffSessionTopup(
      booking,
      topupRecord,
      topupAmountPence,
      topupAmountPounds,
      stripeCustomerId,
      savedMethodId,
      idempotencyKey,
      attempt
    );
  }

  // No reusable method — create unconfirmed PI for on-session card entry
  return createOnSessionTopup(
    booking,
    topupRecord,
    topupAmountPence,
    topupAmountPounds,
    stripeCustomerId,
    idempotencyKey,
    attempt
  );
}

// ─── Off-session charge (saved card) ──────────────────────────

async function executeOffSessionTopup(
  booking: { id: string; provisionalCleanerId: string | null; provisionalPrice: unknown },
  topupRecord: { id: string; attempt: number },
  amountPence: number,
  amountPounds: number,
  stripeCustomerId: string,
  paymentMethodId: string,
  idempotencyKey: string,
  attempt: number
): Promise<TopupResult> {
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountPence,
        currency: 'gbp',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          bookingId: booking.id,
          topupRecordId: topupRecord.id,
          type: 'price_reconciliation_topup',
        },
      },
      { idempotencyKey }
    );

    if (pi.status === 'succeeded') {
      await writeTopupSuccess(booking, topupRecord, pi.id, amountPounds, attempt, 'off_session');
      return { outcome: 'SUCCEEDED', topupRecordId: topupRecord.id };
    }

    if (pi.status === 'requires_action') {
      await prisma.topupRecord.update({
        where: { id: topupRecord.id },
        data: { stripePaymentIntentId: pi.id, paymentMethodType: 'off_session', attempt },
      });
      return {
        outcome: 'REQUIRES_ACTION',
        clientSecret: pi.client_secret ?? undefined,
        topupRecordId: topupRecord.id,
      };
    }

    await prisma.topupRecord.update({
      where: { id: topupRecord.id },
      data: {
        status: 'FAILED',
        paymentMethodType: 'off_session',
        attempt,
        failureReason: `Unexpected PI status: ${pi.status}`,
      },
    });
    return {
      outcome: 'FAILED',
      topupRecordId: topupRecord.id,
      reason: `Unexpected status: ${pi.status}`,
    };
  } catch (err: unknown) {
    // SCA required — return client_secret for 3DS
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'authentication_required'
    ) {
      const stripeErr = err as { payment_intent?: { id: string; client_secret: string } };
      if (stripeErr.payment_intent) {
        await prisma.topupRecord.update({
          where: { id: topupRecord.id },
          data: {
            stripePaymentIntentId: stripeErr.payment_intent.id,
            paymentMethodType: 'off_session',
            attempt,
          },
        });
        return {
          outcome: 'REQUIRES_ACTION',
          clientSecret: stripeErr.payment_intent.client_secret,
          topupRecordId: topupRecord.id,
        };
      }
    }

    if (isUnknownOutcome(err)) {
      await prisma.topupRecord.update({
        where: { id: topupRecord.id },
        data: {
          status: 'UNKNOWN',
          paymentMethodType: 'off_session',
          attempt,
          failureReason: 'Outcome unknown — manual check required',
        },
      });
      return { outcome: 'UNKNOWN', topupRecordId: topupRecord.id, reason: 'Unknown outcome' };
    }

    const failReason = err instanceof Error ? err.message : 'Stripe error';
    await prisma.topupRecord.update({
      where: { id: topupRecord.id },
      data: {
        status: 'FAILED',
        paymentMethodType: 'off_session',
        attempt,
        failureReason: failReason,
      },
    });
    return { outcome: 'FAILED', topupRecordId: topupRecord.id, reason: failReason };
  }
}

// ─── On-session (no saved card — customer enters card) ────────

async function createOnSessionTopup(
  booking: { id: string },
  topupRecord: { id: string; attempt: number },
  amountPence: number,
  _amountPounds: number,
  stripeCustomerId: string | null, // null for guests (F5) — PI created without customer
  idempotencyKey: string,
  attempt: number
): Promise<TopupResult> {
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountPence,
        currency: 'gbp',
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        metadata: {
          bookingId: booking.id,
          topupRecordId: topupRecord.id,
          type: 'price_reconciliation_topup',
        },
      },
      { idempotencyKey }
    );

    await prisma.topupRecord.update({
      where: { id: topupRecord.id },
      data: { stripePaymentIntentId: pi.id, paymentMethodType: 'on_session', attempt },
    });

    return {
      outcome: 'REQUIRES_CARD',
      clientSecret: pi.client_secret ?? undefined,
      topupRecordId: topupRecord.id,
    };
  } catch (err: unknown) {
    if (isUnknownOutcome(err)) {
      await prisma.topupRecord.update({
        where: { id: topupRecord.id },
        data: {
          status: 'UNKNOWN',
          paymentMethodType: 'on_session',
          attempt,
          failureReason: 'PI creation outcome unknown',
        },
      });
      return { outcome: 'UNKNOWN', topupRecordId: topupRecord.id };
    }

    const failReason = err instanceof Error ? err.message : 'Stripe error';
    await prisma.topupRecord.update({
      where: { id: topupRecord.id },
      data: {
        status: 'FAILED',
        paymentMethodType: 'on_session',
        attempt,
        failureReason: failReason,
      },
    });
    return { outcome: 'FAILED', topupRecordId: topupRecord.id, reason: failReason };
  }
}

// ─── Atomic success write ─────────────────────────────────────

async function writeTopupSuccess(
  booking: { id: string; provisionalCleanerId: string | null; provisionalPrice: unknown },
  topupRecord: { id: string },
  stripePaymentIntentId: string,
  amountPounds: number,
  attempt: number,
  paymentMethodType: 'off_session' | 'on_session' = 'off_session'
): Promise<void> {
  // M1: the booking is being reassigned to the PRICIER cleaner — every money
  // snapshot field must be recomputed against THAT cleaner's real rates via the
  // shared helper (previously only price+cleaner were rewritten, so the new
  // cleaner inherited the old cleaner's earnings/commission and their statement
  // showed the old figures). The full booking is re-read here because both the
  // direct path and the webhook path pass a slim booking object.
  const full = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: {
      serviceType: true,
      propertySize: true,
      duration: true,
      extras: true,
      totalAmountCharged: true,
      totalPrice: true,
    },
  });
  if (!full) throw new Error(`writeTopupSuccess: booking ${booking.id} vanished`);
  if (!booking.provisionalCleanerId) {
    throw new Error(`writeTopupSuccess: booking ${booking.id} has no provisional cleaner`);
  }

  const capturedSoFar = Number(full.totalAmountCharged ?? full.totalPrice);
  // Captured total = everything actually charged: original PI + this top-up.
  // Because topupAmount was computed as (winnerTotal − discounted original),
  // the captured total equals the FULL winner price — any promo discount is
  // consumed by the reassignment, so discountAmount is 0 here (Rena no longer
  // funds it; the commission must not be reduced twice).
  const capturedTotal = Math.round((capturedSoFar + amountPounds) * 100) / 100;
  const snapshot = await computeMoneySnapshot({
    cleanerId: booking.provisionalCleanerId,
    serviceType: full.serviceType,
    propertySize: full.propertySize,
    duration: Number(full.duration),
    extras: full.extras,
    discountAmount: 0,
    capturedTotal,
  });
  // Anchor the price fields to the CHARGED truth (approved provisional price =
  // captured total), not the fresh quote — if the cleaner edited rates between
  // offer and approval, the quote could drift from what the customer actually
  // approved and paid. Earnings/commission/fee stay quote-derived.
  snapshot.totalPrice = capturedTotal;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'ACCEPTED',
        cleanerId: booking.provisionalCleanerId,
        acceptedAt: new Date(),
        // Full money snapshot for the NEW cleaner (M1). Note totalPrice comes
        // from the helper's fresh quote — same source the provisionalPrice was
        // derived from at offer time.
        ...snapshot,
        cascadePhase: null,
        cascadeExpiresAt: null,
        cascadeBackupExpiresAt: null,
        provisionalCleanerId: null,
        provisionalPrice: null,
        topupAmount: null,
        approvalExpiresAt: null,
        topupApproved: false,
        reserveCleanerIds: [],
        provisionalSource: null,
        reassignPreviousStatus: null,
        reassignPreviousCleanerId: null,
      },
    }),
    prisma.topupRecord.update({
      where: { id: topupRecord.id },
      data: {
        stripePaymentIntentId,
        status: 'SUCCEEDED',
        paymentMethodType,
        attempt,
        failureReason: null,
      },
    }),
  ]);

  await AuditService.log({
    action: 'TOPUP_SUCCEEDED',
    entityType: 'Booking',
    entityId: booking.id,
    metadata: {
      amount: amountPounds,
      topupRecordId: topupRecord.id,
      snapshot: JSON.stringify(snapshot),
    },
  }).catch(() => {});
}

// ─── Webhook handler for topup PI outcomes ────────────────────

export async function handleTopupPiSucceeded(piId: string, bookingId: string): Promise<void> {
  const topupRecord = await prisma.topupRecord.findFirst({
    where: { stripePaymentIntentId: piId },
  });
  if (!topupRecord) return;
  if (topupRecord.status === 'SUCCEEDED') return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, provisionalCleanerId: true, provisionalPrice: true },
  });
  if (!booking) return;

  await writeTopupSuccess(
    booking,
    topupRecord,
    piId,
    Number(topupRecord.amount),
    topupRecord.attempt
  );
}

export async function handleTopupPiFailed(piId: string): Promise<void> {
  const record = await prisma.topupRecord.findFirst({
    where: { stripePaymentIntentId: piId, status: { not: 'SUCCEEDED' } },
    select: { id: true, bookingId: true },
  });
  if (!record) return;

  await prisma.topupRecord.updateMany({
    where: { stripePaymentIntentId: piId, status: { not: 'SUCCEEDED' } },
    data: { status: 'FAILED', failureReason: 'Payment failed (webhook)' },
  });

  await handleProvisionalFailure(record.bookingId, 'Top-up payment failed (webhook)');
}
