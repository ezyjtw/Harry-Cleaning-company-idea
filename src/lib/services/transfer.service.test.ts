import { describe, expect, it } from 'vitest';

import {
  findMatchingTransfer,
  getTransferAmountPence,
  needsReconciliation,
} from './transfer-amount';

describe('getTransferAmountPence', () => {
  it('converts cleanerEarnings to pence for 10% commission (regular £80 base)', () => {
    // base=80, commission=8, cleanerPayout=72
    expect(getTransferAmountPence(72)).toBe(7200);
  });

  it('converts cleanerEarnings to pence for 15% commission (EoT £200 base)', () => {
    // base=200, commission=30, cleanerPayout=170
    expect(getTransferAmountPence(170)).toBe(17000);
  });

  it('converts cleanerEarnings to pence for 15% commission (Airbnb £55 base)', () => {
    // base=55, commission=8.25, cleanerPayout=46.75
    expect(getTransferAmountPence(46.75)).toBe(4675);
  });

  it('handles deep clean fractional payout (10% of £152.25)', () => {
    // commission=15.23, cleanerPayout=137.02
    expect(getTransferAmountPence(137.02)).toBe(13702);
  });

  it('handles same-day fractional payout (10% of £72.80)', () => {
    // commission=7.28, cleanerPayout=65.52
    expect(getTransferAmountPence(65.52)).toBe(6552);
  });

  it('handles floating-point edge cases via Math.round', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    expect(getTransferAmountPence(0.1 + 0.2)).toBe(30);
  });

  it('returns 0 for zero earnings', () => {
    expect(getTransferAmountPence(0)).toBe(0);
  });

  it('is the single documented place for the transfer-amount formula', () => {
    // When paid add-ons are introduced, the add-on share decision
    // should be made inside getTransferAmountPence (or its caller
    // in releaseBookingFunds). This test exists to flag that dependency.
    // Currently: transferAmount = cleanerEarnings (add-ons unused/zero).
    // If add-ons become non-zero, update getTransferAmountPence and add
    // a test here for the new formula.
    const earningsWithNoAddons = 72;
    expect(getTransferAmountPence(earningsWithNoAddons)).toBe(7200);
  });

  it('transfer amount never exceeds a sanity bound', () => {
    // Verify for a range of realistic values
    for (const base of [10, 25, 50, 100, 200, 500]) {
      for (const rate of [0.1, 0.15]) {
        const commission = Math.round(base * rate * 100) / 100;
        const payout = Math.round((base - commission) * 100) / 100;
        const pence = getTransferAmountPence(payout);
        const totalPence = Math.round(base * 1.06 * 100); // base + 6% customer fee
        expect(pence).toBeLessThanOrEqual(totalPence);
        expect(pence).toBeGreaterThan(0);
      }
    }
  });
});

describe('needsReconciliation', () => {
  it('returns true for UNKNOWN (network error — transfer may exist)', () => {
    expect(needsReconciliation('UNKNOWN')).toBe(true);
  });

  it('returns true for RELEASING (crash after Stripe success, before DB write)', () => {
    expect(needsReconciliation('RELEASING')).toBe(true);
  });

  it('returns false for PENDING (fresh attempt, no prior transfer possible)', () => {
    expect(needsReconciliation('PENDING')).toBe(false);
  });

  it('returns false for FAILED (definitive — Stripe confirmed no transfer)', () => {
    expect(needsReconciliation('FAILED')).toBe(false);
  });

  it('returns false for RELEASED (terminal)', () => {
    expect(needsReconciliation('RELEASED')).toBe(false);
  });
});

describe('findMatchingTransfer (crash-after-success reconciliation)', () => {
  const CHARGE_ID = 'ch_booking123';

  it('adopts existing transfer when source_transaction matches (string)', () => {
    const transfers = [
      { id: 'tr_other', source_transaction: 'ch_different' },
      { id: 'tr_match', source_transaction: CHARGE_ID },
    ];
    expect(findMatchingTransfer(transfers, CHARGE_ID)).toBe('tr_match');
  });

  it('adopts existing transfer when source_transaction is expanded Charge object', () => {
    const transfers = [{ id: 'tr_match', source_transaction: { id: CHARGE_ID } }];
    expect(findMatchingTransfer(transfers, CHARGE_ID)).toBe('tr_match');
  });

  it('returns null when no transfer matches — safe to create', () => {
    const transfers = [
      { id: 'tr_other1', source_transaction: 'ch_different1' },
      { id: 'tr_other2', source_transaction: 'ch_different2' },
    ];
    expect(findMatchingTransfer(transfers, CHARGE_ID)).toBeNull();
  });

  it('returns null for empty list — safe to create', () => {
    expect(findMatchingTransfer([], CHARGE_ID)).toBeNull();
  });

  it('handles null source_transaction without matching', () => {
    const transfers = [{ id: 'tr_null', source_transaction: null }];
    expect(findMatchingTransfer(transfers, CHARGE_ID)).toBeNull();
  });

  it('returns first match if multiple exist (defensive)', () => {
    const transfers = [
      { id: 'tr_first', source_transaction: CHARGE_ID },
      { id: 'tr_second', source_transaction: CHARGE_ID },
    ];
    expect(findMatchingTransfer(transfers, CHARGE_ID)).toBe('tr_first');
  });

  it('UNKNOWN prior state with existing transfer → reconcile, not double-pay', () => {
    // Scenario: network error on attempt 1, transfer actually succeeded on Stripe.
    // On retry, needsReconciliation('UNKNOWN') = true, findMatchingTransfer finds it.
    // Service adopts tr_existing and returns RELEASED — no second transfer created.
    expect(needsReconciliation('UNKNOWN')).toBe(true);
    const transfers = [{ id: 'tr_existing', source_transaction: CHARGE_ID }];
    const adoptedId = findMatchingTransfer(transfers, CHARGE_ID);
    expect(adoptedId).toBe('tr_existing');
  });

  it('RELEASING prior state with existing transfer → reconcile, not double-pay', () => {
    // Scenario: crash after stripe.transfers.create returned, before DB write.
    // On recovery, needsReconciliation('RELEASING') = true, findMatchingTransfer finds it.
    // Service adopts tr_crashed and returns RELEASED — no second transfer created.
    expect(needsReconciliation('RELEASING')).toBe(true);
    const transfers = [{ id: 'tr_crashed', source_transaction: CHARGE_ID }];
    const adoptedId = findMatchingTransfer(transfers, CHARGE_ID);
    expect(adoptedId).toBe('tr_crashed');
  });

  it('PENDING does not reconcile — goes straight to create', () => {
    // Fresh attempt, no prior Stripe call possible, reconciliation would waste an API call.
    expect(needsReconciliation('PENDING')).toBe(false);
  });
});
