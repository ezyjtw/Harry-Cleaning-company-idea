// ─── M1: the ONE money-snapshot recalculation ────────────────────────────────
//
// When a booking's true price/cleaner changes after creation (price
// reconciliation: pricier top-up or cheaper reassign), every money snapshot
// field must be rewritten together, from the SAME quote, or surfaces diverge
// (the M1 bug: the pricier branch rewrote price+cleaner but not earnings, so
// the new cleaner was paid the old cleaner's amounts and their statement showed
// the old cleaner's figures).
//
// Field semantics (must mirror booking creation, src/app/api/bookings/route.ts):
//   totalPrice               — what the customer owes for the job (winner quote
//                              customerTotal, minus any promo discount)
//   platformFee              — the 6% customer service fee (customerPlatformFee)
//   cleanerEarnings          — cleaner's payout for the job (SACRED: a promo
//                              discount never reduces it — M2)
//   cleanerPayoutAmount      — statement snapshot of the same payout
//   platformCommissionAmount — Rena's commission, MINUS any promo discount
//                              (Rena funds promos — may go NEGATIVE, M2)
//   platformFeeAmount        — statement snapshot of the 6% fee
//   customerSubtotal         — the cleaner's listed price (pre-fee)
//   customerServiceFee       — statement snapshot of the 6% fee
//   renaEarns                — commission + fee − discount
//   totalAmountCharged       — sum of CAPTURED charges (original PI + top-up
//                              PIs). Never reduced by refunds — RefundRecords
//                              net against it.

import type { PricingServiceSlug } from '@/lib/constants/services';
import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';

import { pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';

export interface MoneySnapshot {
  totalPrice: number;
  platformFee: number;
  cleanerEarnings: number;
  cleanerPayoutAmount: number;
  platformCommissionAmount: number;
  platformFeeAmount: number;
  customerSubtotal: number;
  customerServiceFee: number;
  renaEarns: number;
  totalAmountCharged: number;
}

export interface SnapshotInput {
  cleanerId: string;
  serviceType: string;
  propertySize: string | null; // Prisma enum value or null
  duration: number;
  extras: string[];
  /** Promo discount already granted on this booking (£). Comes out of Rena's
   *  commission (M2) — cleaner earnings are never touched by it. */
  discountAmount?: number;
  /** Sum of captured charges for the booking (original + succeeded top-ups), £. */
  capturedTotal: number;
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Recompute the full money snapshot for a booking against a specific cleaner's
 * REAL rates. Both reconciliation branches (pricier top-up and cheaper
 * reassign) call this — they can never diverge again.
 */
export async function computeMoneySnapshot(input: SnapshotInput): Promise<MoneySnapshot> {
  const pricingSlug: PricingServiceSlug = normalizeToPricingSlug(input.serviceType);
  const propertySize = input.propertySize
    ? propertySizeEnumToSlug(input.propertySize as Parameters<typeof propertySizeEnumToSlug>[0])
    : undefined;

  const quote = await pricingService.calculateQuote({
    cleanerId: input.cleanerId,
    serviceSlug: pricingSlug as ServiceSlug,
    hours: input.duration,
    propertySize,
    addons: input.extras,
  });

  const discount = money(input.discountAmount ?? 0);

  return {
    totalPrice: money(quote.customerTotal - discount),
    platformFee: quote.customerPlatformFee,
    cleanerEarnings: quote.cleanerPayout, // sacred — never discounted
    cleanerPayoutAmount: quote.cleanerPayout,
    platformCommissionAmount: money(quote.cleanerCommission - discount), // may be negative (M2)
    platformFeeAmount: quote.customerPlatformFee,
    customerSubtotal: quote.cleanerListedPrice,
    customerServiceFee: quote.customerPlatformFee,
    renaEarns: money(quote.cleanerCommission + quote.customerPlatformFee - discount),
    totalAmountCharged: money(input.capturedTotal),
  };
}
