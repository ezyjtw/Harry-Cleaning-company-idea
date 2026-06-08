import { describe, expect, it } from 'vitest';

import { getTransferAmountPence } from './transfer-amount';

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
