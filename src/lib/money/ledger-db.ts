// B4 money ledger: the database half. Reads a booking's ledger and writes
// the derived states (ledger.ts) inside the caller's transaction.

import { prisma } from '@/lib/db/prisma';
import { TOPUP_WITHOUT_ASSIGNMENT } from '@/lib/services/topup-flag';

import {
  bookingRefundState,
  executedPence,
  moneyHoldReasons,
  refundRecordStatus,
  toPence,
  type ChargeLike,
  type MoneyHoldReason,
} from './ledger';

/** The client or a transaction client (same shape as B3's AssignTx). */
export type Db = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface BookingLedger {
  booking: {
    id: string;
    status: string;
    paymentStatus: string;
    transferStatus: string;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    totalAmountCharged: unknown;
    totalPrice: unknown;
    cleanerEarnings: unknown;
    platformFee: unknown;
    cleanerPayoutAmount: unknown;
    platformCommissionAmount: unknown;
    amountShortfallPence: number | null;
  };
  chargedPence: number;
  topups: {
    id: string;
    stripePaymentIntentId: string;
    stripeChargeId: string | null;
    amountPence: number;
    flagged: boolean;
    createdAt: Date;
  }[];
  slices: {
    id: string;
    refundRecordId: string;
    stripePaymentIntentId: string;
    status: string;
    requestedPence: number;
    executedPence: number;
  }[];
  transferSlices: {
    id: string;
    stripeTransferId: string;
    amountPence: number | null;
    reversedPence: number;
    kind: string;
    status: string;
  }[];
}

export async function loadBookingLedger(db: Db, bookingId: string): Promise<BookingLedger | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      transferStatus: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      totalAmountCharged: true,
      totalPrice: true,
      cleanerEarnings: true,
      platformFee: true,
      cleanerPayoutAmount: true,
      platformCommissionAmount: true,
      amountShortfallPence: true,
      topupRecords: {
        where: { status: 'SUCCEEDED', stripePaymentIntentId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          stripePaymentIntentId: true,
          stripeChargeId: true,
          amount: true,
          failureReason: true,
          createdAt: true,
        },
      },
      refundRecords: {
        select: {
          slices: {
            select: {
              id: true,
              refundRecordId: true,
              stripePaymentIntentId: true,
              status: true,
              requestedPence: true,
              executedPence: true,
            },
          },
        },
      },
      transferSlices: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          stripeTransferId: true,
          amountPence: true,
          reversedPence: true,
          kind: true,
          status: true,
        },
      },
    },
  });
  if (!b) return null;
  const { topupRecords, refundRecords, transferSlices, ...booking } = b;
  return {
    booking,
    // RENA-017: Stripe captured less than the booking expected; the ledger's
    // charged money is what Stripe received (held or accepted alike).
    chargedPence: Math.max(
      0,
      toPence(b.totalAmountCharged ?? b.totalPrice) - (b.amountShortfallPence ?? 0)
    ),
    topups: topupRecords.map((t) => ({
      id: t.id,
      stripePaymentIntentId: t.stripePaymentIntentId as string,
      stripeChargeId: t.stripeChargeId,
      amountPence: toPence(t.amount),
      flagged: (t.failureReason ?? '').startsWith(TOPUP_WITHOUT_ASSIGNMENT),
      createdAt: t.createdAt,
    })),
    slices: refundRecords.flatMap((r) => r.slices),
    transferSlices,
  };
}

/** The booking's charges in LIFO order: top-ups newest first, then the original. */
export function chargesLifo(ledger: BookingLedger): ChargeLike[] {
  const taken = new Map<string, number>();
  for (const s of ledger.slices) {
    if (s.status === 'FAILED') continue;
    const t = s.status === 'SUCCEEDED' ? s.executedPence : s.requestedPence;
    taken.set(s.stripePaymentIntentId, (taken.get(s.stripePaymentIntentId) ?? 0) + t);
  }
  const topupTotal = ledger.topups.reduce((sum, t) => sum + t.amountPence, 0);
  const charges: ChargeLike[] = ledger.topups.map((t) => ({
    paymentIntentId: t.stripePaymentIntentId,
    chargeId: t.stripeChargeId,
    capturedPence: t.amountPence,
    takenPence: taken.get(t.stripePaymentIntentId) ?? 0,
    flagged: t.flagged,
  }));
  if (ledger.booking.stripePaymentIntentId) {
    charges.push({
      paymentIntentId: ledger.booking.stripePaymentIntentId,
      chargeId: ledger.booking.stripeChargeId,
      capturedPence: Math.max(0, ledger.chargedPence - topupTotal),
      takenPence: taken.get(ledger.booking.stripePaymentIntentId) ?? 0,
      flagged: false,
    });
  }
  return charges;
}

/** Charged money that carries a cleaner share, minus what was refunded from it. */
export function remainingShareablePence(ledger: BookingLedger): number {
  const flaggedPis = new Set(
    ledger.topups.filter((t) => t.flagged).map((t) => t.stripePaymentIntentId)
  );
  const flaggedPence = ledger.topups
    .filter((t) => t.flagged)
    .reduce((s, t) => s + t.amountPence, 0);
  const refundedShareable = ledger.slices
    .filter((s) => s.status === 'SUCCEEDED' && !flaggedPis.has(s.stripePaymentIntentId))
    .reduce((sum, s) => sum + s.executedPence, 0);
  return Math.max(0, ledger.chargedPence - flaggedPence - refundedShareable);
}

/**
 * A RefundRecord's derived status and executed total from its slices. The
 * record's legacy `amount` stays the request; executedPence is the truth.
 */
export async function recomputeRefundRecord(db: Db, refundRecordId: string): Promise<string> {
  const rec = await db.refundRecord.findUniqueOrThrow({
    where: { id: refundRecordId },
    select: {
      requestedPence: true,
      amount: true,
      stripeRefundId: true,
      slices: {
        orderBy: { createdAt: 'asc' },
        select: { status: true, requestedPence: true, executedPence: true, stripeRefundId: true },
      },
    },
  });
  const requested = rec.requestedPence ?? toPence(rec.amount);
  const status = rec.slices.length === 0 ? 'PENDING' : refundRecordStatus(rec.slices, requested);
  const firstRefundId =
    rec.stripeRefundId ?? rec.slices.find((s) => s.stripeRefundId)?.stripeRefundId ?? null;
  await db.refundRecord.update({
    where: { id: refundRecordId },
    data: {
      status,
      executedPence: executedPence(rec.slices),
      ...(firstRefundId && !rec.stripeRefundId ? { stripeRefundId: firstRefundId } : {}),
    },
  });
  return status;
}

/**
 * The only writer of paymentStatus REFUNDED and PARTIALLY_REFUNDED. Runs in
 * the same transaction as any slice confirmation. While any slice of the
 * booking is unresolved the state is left as it is (never guessed).
 */
export async function recomputeBookingRefundState(
  db: Db,
  bookingId: string
): Promise<{ paymentStatus: string | null; executedPence: number; unresolved: boolean }> {
  const ledger = await loadBookingLedger(db, bookingId);
  if (!ledger) return { paymentStatus: null, executedPence: 0, unresolved: false };
  const state = bookingRefundState(ledger.chargedPence, ledger.slices);
  if (!state.unresolved && state.paymentStatus) {
    await db.booking.updateMany({
      where: {
        id: bookingId,
        paymentStatus: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      data: { paymentStatus: state.paymentStatus },
    });
    await db.payment.updateMany({
      where: { bookingId },
      data: { status: state.paymentStatus, refundAmount: state.executedPence / 100 },
    });
  }
  return {
    paymentStatus: state.paymentStatus,
    executedPence: state.executedPence,
    unresolved: state.unresolved,
  };
}

/** Every reason this booking's release must wait (empty: release may run). */
export async function holdReasonsFor(db: Db, bookingId: string): Promise<MoneyHoldReason[]> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      amountShortfallPence: true,
      shortfallAcceptedAt: true,
      dispute: { select: { status: true } },
      chargebackHolds: { select: { status: true } },
    },
  });
  if (!b) return [];
  return moneyHoldReasons({
    disputeStatus: b.dispute?.status ?? null,
    amountShortfallPence: b.amountShortfallPence,
    shortfallAccepted: !!b.shortfallAcceptedAt,
    chargebackStatuses: b.chargebackHolds.map((h) => h.status),
  });
}

export { prisma };
