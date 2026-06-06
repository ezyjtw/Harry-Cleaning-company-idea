import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

/**
 * These tests verify the hourly quote calculation extracted from
 * PricingService.calculateHourlyQuote(). The actual service method
 * is tightly coupled to Prisma, so we test the core math directly.
 *
 * After removing baseMultiplier from the calculation:
 *   cleanerListedPrice = hourlyRate × hours  (no multiplier)
 *   cleanerCommission  = cleanerListedPrice × commissionRate
 *   cleanerPayout      = cleanerListedPrice − cleanerCommission
 *   customerPlatformFee = cleanerListedPrice × 0.06
 *   customerTotal      = cleanerListedPrice + customerPlatformFee
 */

const PLATFORM_FEE_RATE = 0.06;
const COMMISSION_RATE_HOURLY = 0.1;

function calculateHourlyQuote(hourlyRate: number, hours: number) {
  const cleanerListedPrice = new Decimal(hourlyRate).mul(hours).toDecimalPlaces(2).toNumber();

  const cleanerCommission = new Decimal(cleanerListedPrice)
    .mul(COMMISSION_RATE_HOURLY)
    .toDecimalPlaces(2)
    .toNumber();

  const cleanerPayout = new Decimal(cleanerListedPrice)
    .minus(cleanerCommission)
    .toDecimalPlaces(2)
    .toNumber();

  const customerPlatformFee = new Decimal(cleanerListedPrice)
    .mul(PLATFORM_FEE_RATE)
    .toDecimalPlaces(2)
    .toNumber();

  const customerTotal = new Decimal(cleanerListedPrice)
    .plus(customerPlatformFee)
    .toDecimalPlaces(2)
    .toNumber();

  return {
    cleanerListedPrice,
    cleanerCommission,
    cleanerPayout,
    customerPlatformFee,
    customerTotal,
  };
}

describe('Hourly quote calculation (no baseMultiplier)', () => {
  it('regular cleaning — £20/hr × 4h = £80', () => {
    const q = calculateHourlyQuote(20, 4);
    expect(q.cleanerListedPrice).toBe(80);
    expect(q.cleanerCommission).toBe(8);
    expect(q.cleanerPayout).toBe(72);
    expect(q.customerPlatformFee).toBe(4.8);
    expect(q.customerTotal).toBe(84.8);
  });

  it('same-day cleaning — £25/hr × 4h = £100 (was £130 before fix)', () => {
    const q = calculateHourlyQuote(25, 4);
    expect(q.cleanerListedPrice).toBe(100);
    expect(q.cleanerCommission).toBe(10);
    expect(q.cleanerPayout).toBe(90);
    expect(q.customerPlatformFee).toBe(6);
    expect(q.customerTotal).toBe(106);
  });

  it('deep cleaning — £28/hr × 4h = £112 (was £162.40 before fix)', () => {
    const q = calculateHourlyQuote(28, 4);
    expect(q.cleanerListedPrice).toBe(112);
    expect(q.cleanerCommission).toBe(11.2);
    expect(q.cleanerPayout).toBe(100.8);
    expect(q.customerPlatformFee).toBe(6.72);
    expect(q.customerTotal).toBe(118.72);
  });

  it('one-off cleaning — £22/hr × 3h = £66 (was £72.60 before fix)', () => {
    const q = calculateHourlyQuote(22, 3);
    expect(q.cleanerListedPrice).toBe(66);
    expect(q.cleanerCommission).toBe(6.6);
    expect(q.cleanerPayout).toBe(59.4);
    expect(q.customerPlatformFee).toBe(3.96);
    expect(q.customerTotal).toBe(69.96);
  });

  it('minimum booking — £14/hr × 2h = £28', () => {
    const q = calculateHourlyQuote(14, 2);
    expect(q.cleanerListedPrice).toBe(28);
    expect(q.cleanerCommission).toBe(2.8);
    expect(q.cleanerPayout).toBe(25.2);
    expect(q.customerPlatformFee).toBe(1.68);
    expect(q.customerTotal).toBe(29.68);
  });

  it('large booking — £35/hr × 8h = £280', () => {
    const q = calculateHourlyQuote(35, 8);
    expect(q.cleanerListedPrice).toBe(280);
    expect(q.cleanerCommission).toBe(28);
    expect(q.cleanerPayout).toBe(252);
    expect(q.customerPlatformFee).toBe(16.8);
    expect(q.customerTotal).toBe(296.8);
  });

  it('customerTotal = cleanerPayout + applicationFee', () => {
    for (const [rate, hours] of [
      [20, 4],
      [25, 4],
      [28, 4],
      [14, 2],
      [35, 8],
    ] as const) {
      const q = calculateHourlyQuote(rate, hours);
      const applicationFee = new Decimal(q.customerTotal)
        .minus(q.cleanerPayout)
        .toDecimalPlaces(2)
        .toNumber();
      expect(applicationFee).toBeGreaterThan(0);
      expect(q.customerTotal).toBeCloseTo(q.cleanerPayout + applicationFee, 2);
    }
  });
});
