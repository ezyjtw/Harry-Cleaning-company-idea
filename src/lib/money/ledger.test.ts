import { describe, expect, it } from 'vitest';

import {
  allocateRefund,
  allocateReversal,
  bookingRefundState,
  cleanerSharePence,
  moneyHoldReasons,
  nextRetryAt,
  refundRecordStatus,
  remainingRefundablePence,
} from './ledger';

const slice = (status: string, requestedPence: number, executedPence = 0) => ({
  status,
  requestedPence,
  executedPence,
});

describe('refundRecordStatus', () => {
  it('UNKNOWN wins over everything, NEEDS_RECONCILE counts as unknown', () => {
    expect(refundRecordStatus([slice('SUCCEEDED', 500, 500), slice('UNKNOWN', 500)], 1000)).toBe(
      'UNKNOWN'
    );
    expect(refundRecordStatus([slice('NEEDS_RECONCILE', 500)], 500)).toBe('UNKNOWN');
  });
  it('PENDING while any slice is in flight', () => {
    expect(refundRecordStatus([slice('SUCCEEDED', 500, 500), slice('PENDING', 500)], 1000)).toBe(
      'PENDING'
    );
  });
  it('SUCCEEDED iff executed reaches the request; PARTIAL in between; FAILED at zero', () => {
    expect(refundRecordStatus([slice('SUCCEEDED', 1000, 1000)], 1000)).toBe('SUCCEEDED');
    expect(refundRecordStatus([slice('SUCCEEDED', 500, 500), slice('FAILED', 500)], 1000)).toBe(
      'PARTIAL'
    );
    expect(refundRecordStatus([slice('FAILED', 1000)], 1000)).toBe('FAILED');
    expect(refundRecordStatus([], 1000)).toBe('FAILED');
  });
});

describe('bookingRefundState', () => {
  it('REFUNDED only when executed reaches the captured total, never on one charge alone', () => {
    // Original 6000 + top-up 1000; the original refunded in full from the dashboard.
    expect(bookingRefundState(7000, [slice('SUCCEEDED', 6000, 6000)]).paymentStatus).toBe(
      'PARTIALLY_REFUNDED'
    );
    expect(
      bookingRefundState(7000, [slice('SUCCEEDED', 6000, 6000), slice('SUCCEEDED', 1000, 1000)])
        .paymentStatus
    ).toBe('REFUNDED');
    expect(bookingRefundState(7000, [slice('FAILED', 7000)]).paymentStatus).toBeNull();
  });
  it('flags unresolved slices', () => {
    expect(bookingRefundState(7000, [slice('UNKNOWN', 100)]).unresolved).toBe(true);
  });
});

describe('remainingRefundablePence', () => {
  it('charged minus executed minus in flight; null while anything is unresolved', () => {
    expect(remainingRefundablePence(7000, [slice('SUCCEEDED', 2000, 2000)])).toBe(5000);
    expect(remainingRefundablePence(7000, [slice('PENDING', 1500)])).toBe(5500);
    expect(remainingRefundablePence(7000, [slice('NEEDS_RECONCILE', 1500)])).toBeNull();
    expect(remainingRefundablePence(7000, [])).toBe(7000);
  });
});

describe('cleanerSharePence (one formula, RENA-089)', () => {
  it('with no earlier refunds it is earnings × refund / charged', () => {
    expect(
      cleanerSharePence({
        cleanerRemainingPence: 5000,
        remainingShareablePence: 6000,
        refundShareablePence: 3000,
      })
    ).toBe(2500);
  });
  it('a full refund of what remains takes everything that remains', () => {
    expect(
      cleanerSharePence({
        cleanerRemainingPence: 2500,
        remainingShareablePence: 3000,
        refundShareablePence: 3000,
      })
    ).toBe(2500);
  });
  it('two halves equal one whole (remaining basis keeps proportion)', () => {
    const first = cleanerSharePence({
      cleanerRemainingPence: 5000,
      remainingShareablePence: 6000,
      refundShareablePence: 3000,
    });
    const second = cleanerSharePence({
      cleanerRemainingPence: 5000 - first,
      remainingShareablePence: 3000,
      refundShareablePence: 3000,
    });
    expect(first + second).toBe(5000);
  });
  it('nothing shareable refunded means no share (a flagged top-up refund)', () => {
    expect(
      cleanerSharePence({
        cleanerRemainingPence: 5000,
        remainingShareablePence: 6000,
        refundShareablePence: 0,
      })
    ).toBe(0);
  });
});

describe('allocateRefund (LIFO)', () => {
  const charges = [
    {
      paymentIntentId: 'pi_top',
      chargeId: 'ch_top',
      capturedPence: 1000,
      takenPence: 0,
      flagged: false,
    },
    {
      paymentIntentId: 'pi_orig',
      chargeId: 'ch_orig',
      capturedPence: 6000,
      takenPence: 0,
      flagged: false,
    },
  ];
  it('a partial refund within the top-up is one slice', () => {
    const r = allocateRefund(charges, 800);
    expect(r.slices).toEqual([
      { paymentIntentId: 'pi_top', chargeId: 'ch_top', pence: 800, flagged: false },
    ]);
  });
  it('across both charges is two slices, top-up first', () => {
    const r = allocateRefund(charges, 2500);
    expect(r.slices.map((s) => [s.paymentIntentId, s.pence])).toEqual([
      ['pi_top', 1000],
      ['pi_orig', 1500],
    ]);
    expect(r.shortfallPence).toBe(0);
  });
  it('respects what each charge has already given', () => {
    const r = allocateRefund([{ ...charges[0], takenPence: 1000 }, charges[1]], 500);
    expect(r.slices.map((s) => s.paymentIntentId)).toEqual(['pi_orig']);
  });
  it('never puts money past a capture: the excess is a shortfall', () => {
    expect(allocateRefund(charges, 7500).shortfallPence).toBe(500);
  });
  it('can be confined to one payment intent', () => {
    const r = allocateRefund(charges, 1000, 'pi_top');
    expect(r.slices).toHaveLength(1);
    expect(allocateRefund(charges, 1500, 'pi_top').shortfallPence).toBe(500);
  });
});

describe('allocateReversal (proportional, largest remainder)', () => {
  it('splits across anchored and excess in proportion to what each holds', () => {
    const plan = allocateReversal(
      [
        { id: 'a', amountPence: 6000, reversedPence: 0 },
        { id: 'x', amountPence: 1000, reversedPence: 0 },
      ],
      3500
    );
    expect(plan?.parts).toEqual([
      { sliceId: 'a', pence: 3000 },
      { sliceId: 'x', pence: 500 },
    ]);
  });
  it('pennies land on the largest remainder and the sum is exact', () => {
    const plan = allocateReversal(
      [
        { id: 'a', amountPence: 100, reversedPence: 0 },
        { id: 'b', amountPence: 100, reversedPence: 0 },
        { id: 'c', amountPence: 100, reversedPence: 0 },
      ],
      100
    );
    expect(plan?.parts.reduce((s, p) => s + p.pence, 0)).toBe(100);
  });
  it('never past a slice remaining; the excess is a shortfall', () => {
    const plan = allocateReversal([{ id: 'a', amountPence: 1000, reversedPence: 900 }], 300);
    expect(plan?.parts).toEqual([{ sliceId: 'a', pence: 100 }]);
    expect(plan?.shortfallPence).toBe(200);
  });
  it('refuses (null) while any slice amount is unknown', () => {
    expect(allocateReversal([{ id: 'a', amountPence: null, reversedPence: 0 }], 100)).toBeNull();
  });
});

describe('moneyHoldReasons (holds coexist)', () => {
  it('lists every reason; empty means release may run', () => {
    expect(moneyHoldReasons({})).toEqual([]);
    expect(
      moneyHoldReasons({
        disputeStatus: 'OPEN',
        amountShortfallPence: 50,
        chargebackStatuses: ['OPEN', 'WON'],
      })
    ).toEqual(['DISPUTE', 'SHORTFALL', 'CHARGEBACK']);
    // A lost chargeback keeps holding; won or closed does not.
    expect(moneyHoldReasons({ chargebackStatuses: ['LOST'] })).toEqual(['CHARGEBACK']);
    expect(moneyHoldReasons({ chargebackStatuses: ['WON', 'CLOSED', 'AFTER_RELEASE'] })).toEqual(
      []
    );
    expect(moneyHoldReasons({ disputeStatus: 'RESOLVING_RELEASE' })).toEqual([]);
    expect(moneyHoldReasons({ chargebackStatuses: ['WON', 'AFTER_RELEASE'] })).toEqual([]);
  });
});

describe('nextRetryAt (short retries, then backoff)', () => {
  it('grows and caps', () => {
    const t0 = new Date('2026-10-08T10:00:00Z');
    expect(nextRetryAt(t0, 0).getTime() - t0.getTime()).toBe(120_000);
    expect(nextRetryAt(t0, 3).getTime() - t0.getTime()).toBe(900_000);
    expect(nextRetryAt(t0, 99).getTime() - t0.getTime()).toBe(4 * 3_600_000);
  });
});
