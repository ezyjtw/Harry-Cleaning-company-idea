// B4 money ledger (RENA-010, 011, 087 to 089, 093): the pure derivations.
//
// Nothing here touches the database or Stripe. Every money service reads
// the ledger through these functions, so the refund state of a booking, the
// cleaner's share of a refund and the hold on a release are computed one way
// everywhere.
//
// Units are integer pence throughout.

export type RefundSliceStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'NEEDS_RECONCILE';
export type RefundRecordStatus = 'PENDING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'UNKNOWN';

export interface SliceLike {
  status: string;
  requestedPence: number;
  executedPence: number;
}

/** A slice whose outcome Stripe has not yet told us (never re-executed). */
export function isUnresolved(status: string): boolean {
  return status === 'UNKNOWN' || status === 'NEEDS_RECONCILE';
}

/**
 * RefundRecord status from its slices. UNKNOWN wins (money may have moved and
 * we do not know); then PENDING; then the executed total against the request.
 */
export function refundRecordStatus(
  slices: SliceLike[],
  requestedPence: number
): RefundRecordStatus {
  if (slices.some((s) => isUnresolved(s.status))) return 'UNKNOWN';
  if (slices.some((s) => s.status === 'PENDING')) return 'PENDING';
  const executed = executedPence(slices);
  if (executed > 0 && executed >= requestedPence) return 'SUCCEEDED';
  if (executed > 0) return 'PARTIAL';
  return 'FAILED';
}

/** Σ executedPence over SUCCEEDED slices. */
export function executedPence(slices: SliceLike[]): number {
  return slices
    .filter((s) => s.status === 'SUCCEEDED')
    .reduce((sum, s) => sum + s.executedPence, 0);
}

/** Requested pence still in flight (PENDING) or unknown: never refundable again. */
export function inFlightPence(slices: SliceLike[]): number {
  return slices
    .filter((s) => s.status === 'PENDING' || isUnresolved(s.status))
    .reduce((sum, s) => sum + Math.max(0, s.requestedPence - s.executedPence), 0);
}

export interface BookingRefundState {
  chargedPence: number;
  executedPence: number;
  /** true when any slice's outcome is unknown: refundable cannot be stated. */
  unresolved: boolean;
  /** The paymentStatus the ledger implies, or null for "unchanged". */
  paymentStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED' | null;
}

/**
 * The booking's refund state from every slice of every record. chargedPence is
 * round(totalAmountCharged × 100), never totalPrice. Nothing but
 * recomputeBookingRefundState writes REFUNDED or PARTIALLY_REFUNDED.
 */
export function bookingRefundState(chargedPence: number, slices: SliceLike[]): BookingRefundState {
  const executed = executedPence(slices);
  const unresolved = slices.some((s) => isUnresolved(s.status));
  let paymentStatus: BookingRefundState['paymentStatus'] = null;
  if (executed > 0 && executed >= chargedPence) paymentStatus = 'REFUNDED';
  else if (executed > 0) paymentStatus = 'PARTIALLY_REFUNDED';
  return { chargedPence, executedPence: executed, unresolved, paymentStatus };
}

/**
 * What can still be refunded: charged minus executed minus anything in flight.
 * null while any slice is unresolved: the remainder is not knowable, and the
 * money action waits for reconciliation rather than guessing.
 */
export function remainingRefundablePence(chargedPence: number, slices: SliceLike[]): number | null {
  if (slices.some((s) => isUnresolved(s.status))) return null;
  return Math.max(0, chargedPence - executedPence(slices) - inFlightPence(slices));
}

// ─── The cleaner's share (RENA-089, B3 R2) ───────────────────────────────

/**
 * The cleaner's proportional share of a refund, the one formula for the
 * post-release reversal and the pre-release earnings scaling.
 *
 *   share = round(cleanerRemainingPence × refundShareablePence / remainingShareablePence)
 *
 * remainingShareablePence is the charged money that carries a cleaner share
 * (every charge except a flagged TOPUP_WITHOUT_ASSIGNMENT top-up, B3 R2)
 * minus what has already been refunded from those charges. cleanerRemaining
 * is the cleaner money still standing: unreleased earnings before release,
 * transferred minus reversed after. With no earlier refunds this is exactly
 * cleanerEarnings × refund / charged; with earlier refunds it keeps the
 * cleaner's remaining money in proportion to the customer's remaining money.
 * The portion of a refund landing on a flagged top-up carries no share.
 */
export function cleanerSharePence(params: {
  cleanerRemainingPence: number;
  remainingShareablePence: number;
  refundShareablePence: number;
}): number {
  const { cleanerRemainingPence, remainingShareablePence, refundShareablePence } = params;
  if (cleanerRemainingPence <= 0 || refundShareablePence <= 0 || remainingShareablePence <= 0) {
    return 0;
  }
  if (refundShareablePence >= remainingShareablePence) return cleanerRemainingPence;
  return Math.min(
    cleanerRemainingPence,
    Math.round((cleanerRemainingPence * refundShareablePence) / remainingShareablePence)
  );
}

// ─── LIFO allocation across the booking's charges (RENA-011, 088) ─────────

export interface ChargeLike {
  paymentIntentId: string;
  chargeId: string | null;
  capturedPence: number;
  /** Executed plus in flight against this payment intent. */
  takenPence: number;
  /** A TOPUP_WITHOUT_ASSIGNMENT top-up: refundable, but carries no cleaner share. */
  flagged: boolean;
}

export interface PlannedRefundSlice {
  paymentIntentId: string;
  chargeId: string | null;
  pence: number;
  flagged: boolean;
}

/**
 * Split a refund across charges in the order given (callers pass top-ups
 * newest first, then the original: LIFO). Each charge gives at most its own
 * headroom. A request beyond the total headroom returns { shortfallPence > 0 }
 * and the caller refuses: nothing is ever put on a charge past its capture.
 * onlyPaymentIntentId confines the refund to one charge (the TOPUP_WITHOUT_
 * ASSIGNMENT refund).
 */
export function allocateRefund(
  charges: ChargeLike[],
  amountPence: number,
  onlyPaymentIntentId?: string
): { slices: PlannedRefundSlice[]; shortfallPence: number } {
  const slices: PlannedRefundSlice[] = [];
  let remaining = amountPence;
  for (const c of charges) {
    if (remaining <= 0) break;
    if (onlyPaymentIntentId && c.paymentIntentId !== onlyPaymentIntentId) continue;
    const headroom = c.capturedPence - c.takenPence;
    if (headroom <= 0) continue;
    const take = Math.min(remaining, headroom);
    slices.push({
      paymentIntentId: c.paymentIntentId,
      chargeId: c.chargeId,
      pence: take,
      flagged: c.flagged,
    });
    remaining -= take;
  }
  return { slices, shortfallPence: Math.max(0, remaining) };
}

// ─── Reversal allocation across transfer slices (RENA-010) ────────────────

export interface TransferSliceLike {
  id: string;
  amountPence: number | null;
  reversedPence: number;
}

/**
 * Spread a reversal target across transfer slices in proportion to what each
 * still holds (amount − reversed), largest remainder, never past a slice's
 * remaining. A slice with an unknown amount makes the whole plan refuse
 * (LEDGER_RECONCILIATION_PENDING): the caller must not guess.
 */
export function allocateReversal(
  slices: TransferSliceLike[],
  targetPence: number
): { parts: { sliceId: string; pence: number }[]; shortfallPence: number } | null {
  if (slices.some((s) => s.amountPence === null)) return null;
  const open = slices
    .map((s) => ({ id: s.id, remaining: Math.max(0, (s.amountPence as number) - s.reversedPence) }))
    .filter((s) => s.remaining > 0);
  const totalRemaining = open.reduce((sum, s) => sum + s.remaining, 0);
  const target = Math.max(0, Math.min(targetPence, totalRemaining));
  if (target === 0 || totalRemaining === 0) {
    return { parts: [], shortfallPence: Math.max(0, targetPence) };
  }
  // Floor shares, then hand the leftover pence to the largest remainders.
  const shares = open.map((s) => {
    const exact = (target * s.remaining) / totalRemaining;
    return { id: s.id, remaining: s.remaining, floor: Math.floor(exact), frac: exact % 1 };
  });
  let leftover = target - shares.reduce((sum, s) => sum + s.floor, 0);
  const order = [...shares].sort((a, b) => b.frac - a.frac || b.remaining - a.remaining);
  for (const s of order) {
    if (leftover <= 0) break;
    if (s.floor < s.remaining) {
      s.floor += 1;
      leftover -= 1;
    }
  }
  return {
    parts: shares.filter((s) => s.floor > 0).map((s) => ({ sliceId: s.id, pence: s.floor })),
    shortfallPence: Math.max(0, targetPence - target),
  };
}

// ─── Money holds (RENA-017, RENA-093, D-ac N7) ────────────────────────────

export type MoneyHoldReason = 'DISPUTE' | 'SHORTFALL' | 'CHARGEBACK';

/**
 * Every reason a release must wait. Release resumes only when this is empty
 * (James-ruled: dispute, shortfall and chargeback holds coexist).
 */
export function moneyHoldReasons(booking: {
  disputeStatus?: string | null;
  amountShortfallPence?: number | null;
  chargebackStatuses?: string[];
}): MoneyHoldReason[] {
  const reasons: MoneyHoldReason[] = [];
  if (booking.disputeStatus === 'OPEN' || booking.disputeStatus === 'UNDER_REVIEW') {
    reasons.push('DISPUTE');
  }
  if ((booking.amountShortfallPence ?? 0) > 0) reasons.push('SHORTFALL');
  if ((booking.chargebackStatuses ?? []).includes('OPEN')) reasons.push('CHARGEBACK');
  return reasons;
}

// ─── Retry and backoff for unknown and resolving operations (D-ac) ────────

const BACKOFF_MS = [
  2 * 60_000, // two short retries
  2 * 60_000,
  5 * 60_000, // then back off
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
];

/** When the next attempt may run, after retryCount attempts already made. */
export function nextRetryAt(now: Date, retryCount: number): Date {
  const step = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)];
  return new Date(now.getTime() + step);
}

/** Past this many attempts a row stays visible in stuck-money as persistent. */
export const PERSISTENT_FAILURE_AFTER = 6;

// ─── Stripe error classes ─────────────────────────────────────────────────

/**
 * A connection or API error: Stripe may have processed the request. The same
 * idempotency key is retried once; after that the outcome is UNKNOWN and is
 * reconciled by reading Stripe, never re-executed under a new key.
 */
export function isUnknownStripeOutcome(err: unknown): boolean {
  if (err && typeof err === 'object' && 'type' in err) {
    const t = (err as { type: string }).type;
    return t === 'StripeConnectionError' || t === 'StripeAPIError';
  }
  return false;
}

/** Pence from a Decimal-ish pounds value. */
export function toPence(pounds: unknown): number {
  return Math.round(Number(pounds ?? 0) * 100);
}
