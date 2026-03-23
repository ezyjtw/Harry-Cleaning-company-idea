import {
  PLATFORM_COMMISSION_PERCENT,
  SERVICE_FEE_PERCENT,
  getSubtotal,
  getServiceFee,
  getDisplayedRate,
  getPriceBreakdown,
} from '@/lib/pricing';

describe('PLATFORM_COMMISSION_PERCENT', () => {
  it('should be 10%', () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(10);
  });
});

describe('SERVICE_FEE_PERCENT', () => {
  it('should be 5%', () => {
    expect(SERVICE_FEE_PERCENT).toBe(5);
  });
});

describe('getSubtotal', () => {
  it('adds 10% commission to cleaner rate', () => {
    expect(getSubtotal(100)).toBe(110);
  });

  it('handles typical cleaner rate', () => {
    expect(getSubtotal(45)).toBe(49.5);
  });

  it('returns 0 for 0 rate', () => {
    expect(getSubtotal(0)).toBe(0);
  });
});

describe('getServiceFee', () => {
  it('calculates 5% on subtotal', () => {
    expect(getServiceFee(100)).toBe(5);
  });

  it('handles typical subtotal', () => {
    expect(getServiceFee(49.5)).toBe(2.48);
  });
});

describe('getDisplayedRate', () => {
  it('returns cleaner rate + 10% commission + 5% service fee', () => {
    // 100 * 1.10 = 110 subtotal, 110 * 0.05 = 5.50 service fee, total = 115.50
    expect(getDisplayedRate(100)).toBe(115.5);
  });

  it('calculates correct total for typical rate', () => {
    // 15 * 1.10 = 16.50, 16.50 * 0.05 = 0.825 -> 0.83, total = 17.33
    expect(getDisplayedRate(15)).toBe(17.33);
  });
});

describe('getPriceBreakdown', () => {
  it('returns correct breakdown for a standard booking', () => {
    const result = getPriceBreakdown(15, 3, 1);

    expect(result.cleanerEarnings).toBe(45);
    expect(result.platformCommission).toBe(4.5);
    expect(result.platformCommissionPercent).toBe(10);
    expect(result.subtotal).toBe(49.5);
    expect(result.serviceFee).toBe(2.48);
    expect(result.serviceFeePercent).toBe(5);
    expect(result.total).toBe(51.98);
  });

  it('applies service multiplier correctly', () => {
    // Deep clean with 1.5x multiplier: 15 * 3 * 1.5 = 67.50
    const result = getPriceBreakdown(15, 3, 1.5);

    expect(result.cleanerEarnings).toBe(67.5);
    expect(result.platformCommission).toBe(6.75);
    expect(result.subtotal).toBe(74.25);
    expect(result.serviceFee).toBe(3.71);
    expect(result.total).toBe(77.96);
  });

  it('handles 0 duration', () => {
    const result = getPriceBreakdown(15, 0, 1);

    expect(result.cleanerEarnings).toBe(0);
    expect(result.platformCommission).toBe(0);
    expect(result.serviceFee).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles 0 rate', () => {
    const result = getPriceBreakdown(0, 3, 1);

    expect(result.cleanerEarnings).toBe(0);
    expect(result.platformCommission).toBe(0);
    expect(result.serviceFee).toBe(0);
    expect(result.total).toBe(0);
  });

  it('total equals cleanerEarnings + commission + serviceFee', () => {
    const result = getPriceBreakdown(20, 4, 1.2);

    expect(result.total).toBe(
      Math.round((result.cleanerEarnings + result.platformCommission + result.serviceFee) * 100) /
        100
    );
  });

  it('rounds all values to 2 decimal places', () => {
    const result = getPriceBreakdown(13, 2.5, 1.3);

    const decimals = (n: number) => {
      const parts = n.toString().split('.');
      return parts.length > 1 ? parts[1].length : 0;
    };

    expect(decimals(result.cleanerEarnings)).toBeLessThanOrEqual(2);
    expect(decimals(result.platformCommission)).toBeLessThanOrEqual(2);
    expect(decimals(result.serviceFee)).toBeLessThanOrEqual(2);
    expect(decimals(result.total)).toBeLessThanOrEqual(2);
  });
});
