// ─── A5.3 Price Reconciliation (Stage 1) ─────────────────────────
//
// Entry point: acceptWithReconciliation(bookingId, cleanerId).
// Called by the cleaner accept endpoint instead of atomicAccept directly.
//
// Computes the winner's price BEFORE any atomic claim. Branches:
//   1. Primary cleaner (same as original) → atomicAccept, no reconciliation
//   2. ≤ PRICE_ABSORPTION_THRESHOLD or equal → atomicAccept → CONFIRMED
//   3. Cheaper > threshold → atomicAccept → refundBooking with bookingDataOverride
//   4. Pricier + guest → REJECT (never claim)
//   5. Pricier + auth + saved card → atomicProvisionalAccept → off-session topup
//   6. Pricier + auth + no saved card → atomicProvisionalAccept → on-session topup

import type { PricingServiceSlug } from '@/lib/constants/services';
import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';

import { atomicAccept, atomicProvisionalAccept } from './cascade.service';
import { sendTopupApprovalRequest } from './email.service';
import { PRICE_ABSORPTION_THRESHOLD, pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';
import { refundBooking } from './refund.service';

export type ReconciliationOutcome =
  | 'CONFIRMED'
  | 'CONFIRMED_WITH_REFUND'
  | 'PROVISIONAL'
  | 'REJECTED'
  | 'FAILED';

export interface ReconciliationResult {
  outcome: ReconciliationOutcome;
  reason?: string;
}

export async function acceptWithReconciliation(
  bookingId: string,
  cleanerId: string,
  booking: {
    cleanerId: string;
    clientId: string | null;
    serviceType: string;
    propertySize: string | null;
    duration: number;
    totalPrice: number;
    cleanerEarnings: number;
    platformFee: number;
    extras: string[];
    stripePaymentIntentId: string | null;
    date: Date;
    startTime: string;
    clientEmail: string | null;
    clientName: string | null;
    stripeCustomerId: string | null;
    cascadeExpiresAt: Date | null;
    cascadeBackupExpiresAt: Date | null;
  }
): Promise<ReconciliationResult> {
  // Primary cleaner — no price difference possible
  if (cleanerId === booking.cleanerId) {
    const result = await atomicAccept(bookingId, cleanerId);
    if (!result.success) return { outcome: 'FAILED', reason: result.reason };
    return { outcome: 'CONFIRMED' };
  }

  // Compute winner's price
  let pricingSlug: PricingServiceSlug;
  try {
    pricingSlug = normalizeToPricingSlug(booking.serviceType);
  } catch {
    return { outcome: 'FAILED', reason: `Unknown service type: ${booking.serviceType}` };
  }

  const propertySize = booking.propertySize
    ? propertySizeEnumToSlug(booking.propertySize as Parameters<typeof propertySizeEnumToSlug>[0])
    : undefined;

  let winnerQuote;
  try {
    winnerQuote = await pricingService.calculateQuote({
      cleanerId,
      serviceSlug: pricingSlug as ServiceSlug,
      hours: booking.duration,
      propertySize,
      addons: booking.extras,
    });
  } catch (err) {
    return {
      outcome: 'FAILED',
      reason: `Cannot quote winner: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }

  const originalTotal = booking.totalPrice;
  const winnerTotal = winnerQuote.customerTotal;
  const diff = winnerTotal - originalTotal;

  // Equal or within absorption threshold — straight accept
  if (diff <= PRICE_ABSORPTION_THRESHOLD) {
    if (diff >= 0) {
      // Equal or slightly pricier (within threshold) — absorb
      const result = await atomicAccept(bookingId, cleanerId);
      if (!result.success) return { outcome: 'FAILED', reason: result.reason };
      return { outcome: 'CONFIRMED' };
    }

    // Cheaper, but within absorption band — absorb (no refund)
    if (Math.abs(diff) <= PRICE_ABSORPTION_THRESHOLD) {
      const result = await atomicAccept(bookingId, cleanerId);
      if (!result.success) return { outcome: 'FAILED', reason: result.reason };
      return { outcome: 'CONFIRMED' };
    }
  }

  // Cheaper by more than threshold — accept + refund with atomic reprice
  if (diff < -PRICE_ABSORPTION_THRESHOLD) {
    const result = await atomicAccept(bookingId, cleanerId);
    if (!result.success) return { outcome: 'FAILED', reason: result.reason };

    const refundAmount = Math.round(Math.abs(diff) * 100) / 100;
    const refundResult = await refundBooking(
      bookingId,
      refundAmount,
      'Price reconciliation: cheaper backup cleaner',
      {
        adjustEarnings: false,
        bookingDataOverride: {
          totalPrice: winnerTotal,
          cleanerEarnings: winnerQuote.cleanerPayout,
          platformFee: winnerQuote.customerPlatformFee,
        },
      }
    );

    if (refundResult.status === 'FAILED') {
      // Accept succeeded but refund failed — booking stands at old price.
      // This is safer than reverting the accept. Admin should investigate.
      return { outcome: 'CONFIRMED', reason: `Accept OK, refund failed: ${refundResult.reason}` };
    }

    return { outcome: 'CONFIRMED_WITH_REFUND' };
  }

  // Pricier by more than threshold
  const topupAmount = Math.round(diff * 100) / 100;

  // Guest → never offer pricier
  if (!booking.clientId) {
    return { outcome: 'REJECTED', reason: 'Guest bookings cannot accept pricier cleaners' };
  }

  // Auth user → provisional accept
  const provResult = await atomicProvisionalAccept(bookingId, cleanerId, {
    provisionalPrice: winnerTotal,
    topupAmount,
    approvalExpiresAt:
      booking.cascadeBackupExpiresAt ??
      booking.cascadeExpiresAt ??
      new Date(Date.now() + 12 * 60 * 60 * 1000),
  });

  if (!provResult.success) {
    return { outcome: 'FAILED', reason: provResult.reason };
  }

  // Send approval request email (best-effort)
  if (booking.clientEmail) {
    await sendTopupApprovalRequest({
      bookingId,
      customerEmail: booking.clientEmail,
      customerName: booking.clientName || 'Customer',
      originalPrice: originalTotal,
      newPrice: winnerTotal,
      topupAmount,
      expiresAt: provResult.approvalExpiresAt ?? new Date(Date.now() + 12 * 60 * 60 * 1000),
    }).catch(() => {});
  }

  return { outcome: 'PROVISIONAL' };
}
