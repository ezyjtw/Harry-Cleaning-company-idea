import { describe, expect, it } from 'vitest';

/**
 * GBP-to-pence conversion used at the Stripe API boundary.
 * Used when creating PaymentIntents (charge amount) and Transfers (cleaner payout).
 * Floating-point rounding errors here would cause Stripe to move the wrong amount.
 */

function gbpToPence(gbp: number): number {
  return Math.round(gbp * 100);
}

describe('GBP to pence conversion', () => {
  it('converts whole pounds correctly', () => {
    expect(gbpToPence(80)).toBe(8000);
    expect(gbpToPence(200)).toBe(20000);
    expect(gbpToPence(0)).toBe(0);
  });

  it('converts common decimal amounts correctly', () => {
    expect(gbpToPence(84.8)).toBe(8480);
    expect(gbpToPence(212.0)).toBe(21200);
    expect(gbpToPence(29.99)).toBe(2999);
    expect(gbpToPence(0.01)).toBe(1);
  });

  it('handles floating-point edge cases', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754, but Math.round should fix it
    expect(gbpToPence(0.1 + 0.2)).toBe(30);
    // 1.005 * 100 = 100.49999... in IEEE 754, rounds DOWN to 100
    expect(gbpToPence(1.005)).toBe(100);
  });

  it('handles the exact fee calculations from pricing service', () => {
    // Regular cleaning, £80 base:
    // cleanerListedPrice = 80, commission 10% = 8, cleanerPayout = 72
    // customerPlatformFee = 80 * 0.06 = 4.80
    // customerTotal = 80 + 4.80 = 84.80
    // applicationFee = 84.80 - 72 = 12.80
    const regularTotal = 84.8;
    const regularAppFee = 12.8;
    expect(gbpToPence(regularTotal)).toBe(8480);
    expect(gbpToPence(regularAppFee)).toBe(1280);

    // End of tenancy, £200 base:
    // commission 15% = 30, cleanerPayout = 170
    // customerPlatformFee = 200 * 0.06 = 12.00
    // customerTotal = 200 + 12 = 212
    // applicationFee = 212 - 170 = 42
    const eotTotal = 212.0;
    const eotAppFee = 42.0;
    expect(gbpToPence(eotTotal)).toBe(21200);
    expect(gbpToPence(eotAppFee)).toBe(4200);

    // Deep cleaning, £35/hr * 3h * 1.45x = 152.25
    // commission 10% = 15.225 → 15.23 (rounded to 2dp by Decimal.js)
    // cleanerPayout = 152.25 - 15.23 = 137.02
    // customerPlatformFee = 152.25 * 0.06 = 9.135 → 9.14
    // customerTotal = 152.25 + 9.14 = 161.39
    // applicationFee = 161.39 - 137.02 = 24.37
    const deepTotal = 161.39;
    const deepAppFee = 24.37;
    expect(gbpToPence(deepTotal)).toBe(16139);
    expect(gbpToPence(deepAppFee)).toBe(2437);
  });

  it('handles same-day cleaning rate', () => {
    // Same-day, £28/hr * 2h * 1.3x = 72.80
    // commission 10% = 7.28
    // cleanerPayout = 72.80 - 7.28 = 65.52
    // customerPlatformFee = 72.80 * 0.06 = 4.368 → 4.37
    // customerTotal = 72.80 + 4.37 = 77.17
    // applicationFee = 77.17 - 65.52 = 11.65
    const sameDayTotal = 77.17;
    const sameDayAppFee = 11.65;
    expect(gbpToPence(sameDayTotal)).toBe(7717);
    expect(gbpToPence(sameDayAppFee)).toBe(1165);
  });

  it('handles Airbnb fixed price', () => {
    // Airbnb, £55 base (1bed)
    // commission 15% = 8.25
    // cleanerPayout = 55 - 8.25 = 46.75
    // customerPlatformFee = 55 * 0.06 = 3.30
    // customerTotal = 55 + 3.30 = 58.30
    // applicationFee = 58.30 - 46.75 = 11.55
    const airbnbTotal = 58.3;
    const airbnbAppFee = 11.55;
    expect(gbpToPence(airbnbTotal)).toBe(5830);
    expect(gbpToPence(airbnbAppFee)).toBe(1155);
  });
});

describe('Fee split correctness', () => {
  // These tests verify the business logic:
  // cleanerPayout = base * (1 - commissionRate)
  // customerPlatformFee = base * 0.06
  // customerTotal = base + customerPlatformFee
  // applicationFee = customerTotal - cleanerPayout

  function calculateSplits(base: number, commissionRate: number) {
    const cleanerCommission = Math.round(base * commissionRate * 100) / 100;
    const cleanerPayout = Math.round((base - cleanerCommission) * 100) / 100;
    const customerPlatformFee = Math.round(base * 0.06 * 100) / 100;
    const customerTotal = Math.round((base + customerPlatformFee) * 100) / 100;
    const applicationFee = Math.round((customerTotal - cleanerPayout) * 100) / 100;
    return { cleanerPayout, customerPlatformFee, customerTotal, applicationFee };
  }

  it('regular cleaning £80 base (10% commission)', () => {
    const s = calculateSplits(80, 0.1);
    expect(s.cleanerPayout).toBe(72);
    expect(s.customerPlatformFee).toBe(4.8);
    expect(s.customerTotal).toBe(84.8);
    expect(s.applicationFee).toBe(12.8);
  });

  it('end of tenancy £200 base (15% commission)', () => {
    const s = calculateSplits(200, 0.15);
    expect(s.cleanerPayout).toBe(170);
    expect(s.customerPlatformFee).toBe(12);
    expect(s.customerTotal).toBe(212);
    expect(s.applicationFee).toBe(42);
  });

  it('deep cleaning £152.25 base (10% commission)', () => {
    const s = calculateSplits(152.25, 0.1);
    // 152.25 * 0.10 = 15.225 → rounds to 15.23 (Math.round on *100)
    // But: Math.round(152.25 * 0.10 * 100) / 100 = Math.round(1522.5) / 100 = 1523 / 100 = 15.23
    // cleanerPayout = 152.25 - 15.23 = 137.02
    expect(s.cleanerPayout).toBe(137.02);
    expect(s.customerPlatformFee).toBe(9.14);
    expect(s.customerTotal).toBe(161.39);
    expect(s.applicationFee).toBe(24.37);
  });

  it('same-day £72.80 base (10% commission)', () => {
    const s = calculateSplits(72.8, 0.1);
    expect(s.cleanerPayout).toBe(65.52);
    expect(s.customerPlatformFee).toBe(4.37);
    expect(s.customerTotal).toBe(77.17);
    expect(s.applicationFee).toBe(11.65);
  });

  it('airbnb £55 base (15% commission)', () => {
    const s = calculateSplits(55, 0.15);
    expect(s.cleanerPayout).toBe(46.75);
    expect(s.customerPlatformFee).toBe(3.3);
    expect(s.customerTotal).toBe(58.3);
    expect(s.applicationFee).toBe(11.55);
  });

  it('application fee is always non-negative', () => {
    // Verify the invariant that platform fee >= 0 for any reasonable base
    for (const base of [10, 25, 50, 100, 200, 500]) {
      for (const rate of [0.1, 0.15]) {
        const s = calculateSplits(base, rate);
        expect(s.applicationFee).toBeGreaterThan(0);
        // Verify: customerTotal = cleanerPayout + applicationFee
        expect(s.customerTotal).toBeCloseTo(s.cleanerPayout + s.applicationFee, 2);
      }
    }
  });
});
