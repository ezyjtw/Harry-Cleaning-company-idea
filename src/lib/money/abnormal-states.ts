// B4 stuck-money queue (RENA-015, RENA-080, D-ac).
//
// One read-only module: every abnormal money state a booking can sit in, one
// row per occurrence, with its age and the actions the admin may take. The
// page renders these rows; /api/admin/stuck-money/action executes an action
// by name. Nothing here moves money.

import { prisma } from '@/lib/db/prisma';
import { TOPUP_WITHOUT_ASSIGNMENT } from '@/lib/services/topup-flag';

import { PERSISTENT_FAILURE_AFTER, toPence } from './ledger';

export type AbnormalStateName =
  | 'REFUND_UNKNOWN'
  | 'REFUND_FAILED'
  | 'REFUND_STALE_PENDING'
  | 'REVERSAL_UNKNOWN'
  | 'TRANSFER_UNKNOWN'
  | 'TRANSFER_FAILED'
  | 'TRANSFER_RELEASING_STALE'
  | 'TRANSFER_PAUSED_DISPUTE'
  | 'TRANSFER_PAUSED_SHORTFALL'
  | 'TRANSFER_PAUSED_CHARGEBACK'
  | 'CHARGEBACK_AFTER_RELEASE'
  | 'CHARGEBACK_LOST'
  | 'REFUNDING_STALE'
  | 'TOPUP_UNKNOWN'
  | 'TOPUP_FAILED'
  | 'TOPUP_STALE_PENDING'
  | 'TOPUP_WITHOUT_ASSIGNMENT'
  | 'SLICE_NEEDS_RECONCILE'
  | 'LEGACY_RECONCILE'
  | 'DISPUTE_RESOLVING'
  | 'COMPLETED_NO_RELEASE_CLOCK'
  | 'RECURRING_CHARGE_UNKNOWN'
  | 'REASSIGN_REVERT_CONFLICT';

export type AbnormalAction =
  | 'RECONCILE_REFUND_SLICE'
  | 'RETRY_REFUND_REMAINDER'
  | 'RECONCILE_REVERSAL'
  | 'RECONCILE_BOOKING_REFUNDS'
  | 'RELEASE_NOW'
  | 'CLEAR_SHORTFALL'
  | 'ACKNOWLEDGE_CHARGEBACK'
  | 'SETTLE_LOST_CHARGEBACK'
  | 'RECONCILE_TOPUP'
  | 'REFUND_TOPUP'
  | 'RETRY_DISPUTE_MONEY'
  | 'SET_RELEASE_CLOCK'
  | 'RECONCILE_RECURRING_CHARGE'
  | 'RETRY_REVERT';

export interface AbnormalRow {
  /** Unique per row: state plus the record it is about. */
  key: string;
  state: AbnormalStateName;
  bookingId: string;
  ageSeconds: number;
  amountPence: number | null;
  /** The record the actions act on (slice, record, reversal, top-up, hold, dispute). */
  refId: string;
  detail: string | null;
  /** Retried at least PERSISTENT_FAILURE_AFTER times without settling. */
  persistent: boolean;
  actions: AbnormalAction[];
  /** Links rendered beside the actions (the dispute, Stripe). */
  links: { label: string; href: string }[];
}

const TEN_MIN = 10 * 60_000;
const TWO_MIN = 2 * 60_000;
const DAY = 24 * 60 * 60_000;
const LIMIT = 200;

function ageOf(since: Date, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - since.getTime()) / 1000));
}

function stripeLink(kind: 'payments' | 'disputes' | 'connect/transfers', id: string) {
  return { label: 'Stripe', href: `https://dashboard.stripe.com/${kind}/${id}` };
}

export async function listAbnormalStates(now = new Date()): Promise<AbnormalRow[]> {
  const rows: AbnormalRow[] = [];
  const stale = new Date(now.getTime() - TEN_MIN);

  const [
    refundSlices,
    refundRecords,
    reversals,
    transferBookings,
    paused,
    chargebacks,
    refunding,
    topups,
    transferSlices,
    disputes,
    noClock,
    recurringUnknown,
    revertConflicts,
  ] = await Promise.all([
    prisma.refundSlice.findMany({
      where: {
        OR: [
          { status: { in: ['UNKNOWN', 'NEEDS_RECONCILE'] } },
          { status: 'PENDING', createdAt: { lt: stale } },
        ],
      },
      include: { record: { select: { bookingId: true, context: true } } },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    // B4-era records (context set) that stopped short, and are the latest
    // record on their booking (a later record superseded older failures).
    prisma.refundRecord.findMany({
      where: { status: { in: ['FAILED', 'PARTIAL'] } },
      select: {
        id: true,
        bookingId: true,
        status: true,
        amount: true,
        requestedPence: true,
        executedPence: true,
        failureReason: true,
        context: true,
        createdAt: true,
        booking: {
          select: {
            paymentStatus: true,
            refundRecords: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    prisma.transferReversal.findMany({
      where: {
        OR: [{ status: 'UNKNOWN' }, { status: 'PENDING', createdAt: { lt: stale } }],
      },
      include: { slice: { select: { bookingId: true, stripeTransferId: true } } },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { transferStatus: { in: ['UNKNOWN', 'FAILED'] } },
          { transferStatus: 'RELEASING', updatedAt: { lt: stale } },
        ],
      },
      select: {
        id: true,
        transferStatus: true,
        transferFailureReason: true,
        cleanerEarnings: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: {
        OR: [{ transferStatus: 'PAUSED' }, { amountShortfallPence: { not: null } }],
      },
      select: {
        id: true,
        transferStatus: true,
        amountShortfallPence: true,
        cleanerEarnings: true,
        updatedAt: true,
        dispute: { select: { id: true, status: true } },
        chargebackHolds: { where: { status: 'OPEN' }, select: { id: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: LIMIT,
    }),
    prisma.chargebackHold.findMany({
      where: { status: { in: ['OPEN', 'AFTER_RELEASE', 'LOST'] } },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: { transferStatus: 'REFUNDING', updatedAt: { lt: stale } },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: LIMIT,
    }),
    prisma.topupRecord.findMany({
      where: {
        OR: [
          { status: 'UNKNOWN' },
          {
            status: 'SUCCEEDED',
            failureReason: { startsWith: `${TOPUP_WITHOUT_ASSIGNMENT}:` },
          },
          {
            status: 'FAILED',
            createdAt: { gt: new Date(now.getTime() - 7 * DAY) },
            booking: { cascadePhase: 'PROVISIONAL_APPROVAL' },
          },
          {
            status: 'PENDING',
            OR: [
              { createdAt: { lt: new Date(now.getTime() - DAY) } },
              { booking: { cascadePhase: { not: 'PROVISIONAL_APPROVAL' } } },
              { booking: { cascadePhase: null } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    prisma.transferSlice.findMany({
      where: { OR: [{ status: 'NEEDS_RECONCILE' }, { amountPence: null }] },
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    }),
    prisma.dispute.findMany({
      where: {
        status: { in: ['RESOLVING_REFUND', 'RESOLVING_RELEASE'] },
        resolvingSince: { lt: new Date(now.getTime() - TWO_MIN) },
      },
      select: {
        id: true,
        bookingId: true,
        status: true,
        resolvingSince: true,
        resolutionAmountPence: true,
        lastMoneyError: true,
        retryCount: true,
      },
      orderBy: { resolvingSince: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: { status: 'COMPLETED', transferStatus: 'PENDING', releaseDueAt: null },
      select: { id: true, cleanerEarnings: true, completedAt: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: { chargeOutcomeUnknownAt: { not: null } },
      select: {
        id: true,
        chargeOutcomeUnknownAt: true,
        chargeReconcileCount: true,
        totalPrice: true,
      },
      orderBy: { chargeOutcomeUnknownAt: 'asc' },
      take: LIMIT,
    }),
    prisma.booking.findMany({
      where: { reassignRevertConflictAt: { not: null }, cascadePhase: 'PROVISIONAL_APPROVAL' },
      select: { id: true, reassignRevertConflictAt: true },
      orderBy: { reassignRevertConflictAt: 'asc' },
      take: LIMIT,
    }),
  ]);

  for (const s of refundSlices) {
    const legacy = s.status === 'NEEDS_RECONCILE' || !s.record.context;
    const state: AbnormalStateName =
      s.status === 'UNKNOWN' && !legacy
        ? 'REFUND_UNKNOWN'
        : s.status === 'PENDING'
          ? 'REFUND_STALE_PENDING'
          : 'LEGACY_RECONCILE';
    rows.push({
      key: `${state}:${s.id}`,
      state,
      bookingId: s.record.bookingId,
      ageSeconds: ageOf(s.createdAt, now),
      amountPence: s.requestedPence,
      refId: s.id,
      detail: s.lastReconcileResult,
      persistent: s.retryCount >= PERSISTENT_FAILURE_AFTER,
      actions: ['RECONCILE_REFUND_SLICE'],
      links: [stripeLink('payments', s.stripePaymentIntentId)],
    });
  }

  for (const r of refundRecords) {
    if (!r.context) continue;
    if (r.booking.refundRecords[0]?.id !== r.id) continue;
    const requested = r.requestedPence ?? toPence(r.amount);
    if (requested - r.executedPence <= 0) continue;
    rows.push({
      key: `REFUND_FAILED:${r.id}`,
      state: 'REFUND_FAILED',
      bookingId: r.bookingId,
      ageSeconds: ageOf(r.createdAt, now),
      amountPence: requested - r.executedPence,
      refId: r.id,
      detail: r.failureReason,
      persistent: false,
      actions: ['RETRY_REFUND_REMAINDER'],
      links: [],
    });
  }

  for (const v of reversals) {
    rows.push({
      key: `REVERSAL_UNKNOWN:${v.id}`,
      state: 'REVERSAL_UNKNOWN',
      bookingId: v.slice.bookingId,
      ageSeconds: ageOf(v.createdAt, now),
      amountPence: v.amountPence,
      refId: v.id,
      detail: v.lastReconcileResult,
      persistent: v.retryCount >= PERSISTENT_FAILURE_AFTER,
      actions: ['RECONCILE_REVERSAL'],
      links: [stripeLink('connect/transfers', v.slice.stripeTransferId)],
    });
  }

  for (const b of transferBookings) {
    const state: AbnormalStateName =
      b.transferStatus === 'UNKNOWN'
        ? 'TRANSFER_UNKNOWN'
        : b.transferStatus === 'FAILED'
          ? 'TRANSFER_FAILED'
          : 'TRANSFER_RELEASING_STALE';
    rows.push({
      key: `${state}:${b.id}`,
      state,
      bookingId: b.id,
      ageSeconds: ageOf(b.updatedAt, now),
      amountPence: toPence(b.cleanerEarnings),
      refId: b.id,
      detail: b.transferFailureReason,
      persistent: false,
      actions: ['RELEASE_NOW'],
      links: [],
    });
  }

  for (const b of paused) {
    if (b.amountShortfallPence !== null) {
      rows.push({
        key: `TRANSFER_PAUSED_SHORTFALL:${b.id}`,
        state: 'TRANSFER_PAUSED_SHORTFALL',
        bookingId: b.id,
        ageSeconds: ageOf(b.updatedAt, now),
        amountPence: b.amountShortfallPence,
        refId: b.id,
        detail: 'Stripe received less than the booking expected',
        persistent: false,
        actions: ['CLEAR_SHORTFALL'],
        links: [],
      });
    }
    const disputeOpen =
      b.dispute && ['OPEN', 'UNDER_REVIEW', 'RESOLVING_REFUND'].includes(b.dispute.status);
    if (b.transferStatus === 'PAUSED' && disputeOpen && b.dispute) {
      rows.push({
        key: `TRANSFER_PAUSED_DISPUTE:${b.id}`,
        state: 'TRANSFER_PAUSED_DISPUTE',
        bookingId: b.id,
        ageSeconds: ageOf(b.updatedAt, now),
        amountPence: toPence(b.cleanerEarnings),
        refId: b.dispute.id,
        detail: `Dispute ${b.dispute.status.toLowerCase().replace(/_/g, ' ')}`,
        persistent: false,
        actions: [],
        links: [{ label: 'Dispute', href: `/admin/disputes/${b.dispute.id}` }],
      });
    }
  }

  for (const h of chargebacks) {
    const state: AbnormalStateName =
      h.status === 'OPEN'
        ? 'TRANSFER_PAUSED_CHARGEBACK'
        : h.status === 'AFTER_RELEASE'
          ? 'CHARGEBACK_AFTER_RELEASE'
          : 'CHARGEBACK_LOST';
    rows.push({
      key: `${state}:${h.id}`,
      state,
      bookingId: h.bookingId,
      ageSeconds: ageOf(h.createdAt, now),
      amountPence: h.amountPence,
      refId: h.id,
      detail: h.closedAt ? 'Closed at Stripe' : null,
      persistent: false,
      actions:
        state === 'CHARGEBACK_AFTER_RELEASE'
          ? ['ACKNOWLEDGE_CHARGEBACK']
          : state === 'CHARGEBACK_LOST'
            ? ['SETTLE_LOST_CHARGEBACK']
            : [],
      links: [stripeLink('disputes', h.stripeDisputeId)],
    });
  }

  for (const b of refunding) {
    rows.push({
      key: `REFUNDING_STALE:${b.id}`,
      state: 'REFUNDING_STALE',
      bookingId: b.id,
      ageSeconds: ageOf(b.updatedAt, now),
      amountPence: null,
      refId: b.id,
      detail: null,
      persistent: false,
      actions: ['RECONCILE_BOOKING_REFUNDS'],
      links: [],
    });
  }

  for (const t of topups) {
    const flagged =
      t.status === 'SUCCEEDED' &&
      (t.failureReason ?? '').startsWith(`${TOPUP_WITHOUT_ASSIGNMENT}:`);
    const state: AbnormalStateName = flagged
      ? 'TOPUP_WITHOUT_ASSIGNMENT'
      : t.status === 'UNKNOWN'
        ? 'TOPUP_UNKNOWN'
        : t.status === 'FAILED'
          ? 'TOPUP_FAILED'
          : 'TOPUP_STALE_PENDING';
    rows.push({
      key: `${state}:${t.id}`,
      state,
      bookingId: t.bookingId,
      ageSeconds: ageOf(t.createdAt, now),
      amountPence: toPence(t.amount),
      refId: t.id,
      detail: t.failureReason,
      persistent: false,
      actions: flagged
        ? ['REFUND_TOPUP']
        : t.stripePaymentIntentId && state !== 'TOPUP_FAILED'
          ? ['RECONCILE_TOPUP']
          : [],
      links: t.stripePaymentIntentId ? [stripeLink('payments', t.stripePaymentIntentId)] : [],
    });
  }

  for (const s of transferSlices) {
    rows.push({
      key: `SLICE_NEEDS_RECONCILE:${s.id}`,
      state: 'SLICE_NEEDS_RECONCILE',
      bookingId: s.bookingId,
      ageSeconds: ageOf(s.createdAt, now),
      amountPence: s.amountPence,
      refId: s.id,
      detail: s.lastReconcileResult ?? 'Filled from Stripe by the scheduler',
      persistent: s.retryCount >= PERSISTENT_FAILURE_AFTER,
      actions: [],
      links: [stripeLink('connect/transfers', s.stripeTransferId)],
    });
  }

  for (const d of disputes) {
    rows.push({
      key: `DISPUTE_RESOLVING:${d.id}`,
      state: 'DISPUTE_RESOLVING',
      bookingId: d.bookingId,
      ageSeconds: ageOf(d.resolvingSince ?? now, now),
      amountPence: d.resolutionAmountPence,
      refId: d.id,
      detail: d.lastMoneyError ?? d.status.toLowerCase().replace(/_/g, ' '),
      persistent: d.retryCount >= PERSISTENT_FAILURE_AFTER,
      actions: ['RETRY_DISPUTE_MONEY'],
      links: [{ label: 'Dispute', href: `/admin/disputes/${d.id}` }],
    });
  }

  for (const b of noClock) {
    rows.push({
      key: `COMPLETED_NO_RELEASE_CLOCK:${b.id}`,
      state: 'COMPLETED_NO_RELEASE_CLOCK',
      bookingId: b.id,
      ageSeconds: ageOf(b.completedAt ?? b.updatedAt, now),
      amountPence: toPence(b.cleanerEarnings),
      refId: b.id,
      detail: null,
      persistent: false,
      actions: ['SET_RELEASE_CLOCK'],
      links: [],
    });
  }

  for (const b of recurringUnknown) {
    rows.push({
      key: `RECURRING_CHARGE_UNKNOWN:${b.id}`,
      state: 'RECURRING_CHARGE_UNKNOWN',
      bookingId: b.id,
      ageSeconds: ageOf(b.chargeOutcomeUnknownAt ?? now, now),
      amountPence: toPence(b.totalPrice),
      refId: b.id,
      detail: 'Reconciled by the payment sweep; never charged again while unknown',
      persistent: b.chargeReconcileCount >= PERSISTENT_FAILURE_AFTER,
      actions: ['RECONCILE_RECURRING_CHARGE'],
      links: [],
    });
  }

  for (const b of revertConflicts) {
    rows.push({
      key: `REASSIGN_REVERT_CONFLICT:${b.id}`,
      state: 'REASSIGN_REVERT_CONFLICT',
      bookingId: b.id,
      ageSeconds: ageOf(b.reassignRevertConflictAt ?? now, now),
      amountPence: null,
      refId: b.id,
      detail: 'The original cleaner is no longer free at that time',
      persistent: false,
      actions: ['RETRY_REVERT'],
      links: [],
    });
  }

  return rows.sort((a, b) => b.ageSeconds - a.ageSeconds);
}
