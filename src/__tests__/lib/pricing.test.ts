import {
  PLATFORM_COMMISSION_PERCENT,
  SERVICE_FEE_PERCENT,
  getSubtotal,
  getListedRate,
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
  it('should be 6%', () => {
    expect(SERVICE_FEE_PERCENT).toBe(6);
  });
});

describe('getListedRate / getSubtotal', () => {
  it('returns the cleaner rate as-is (no markup)', () => {
    expect(getListedRate(100)).toBe(100);
    expect(getSubtotal(100)).toBe(100);
  });

  it('handles typical cleaner rate', () => {
    expect(getListedRate(15)).toBe(15);
  });

  it('returns 0 for 0 rate', () => {
    expect(getListedRate(0)).toBe(0);
  });
});

describe('getServiceFee', () => {
  it('calculates 6% inclusive fee on listed amount', () => {
    expect(getServiceFee(100)).toBe(6.38);
  });

  it('handles typical subtotal', () => {
    expect(getServiceFee(45)).toBe(2.87);
  });
});

describe('getDisplayedRate', () => {
  it('returns cleaner rate + 6% service fee on total', () => {
    // 100 / 0.94 = 106.38
    expect(getDisplayedRate(100)).toBe(106.38);
  });

  it('calculates correct total for typical rate', () => {
    // 15 / 0.94 = 15.96
    expect(getDisplayedRate(15)).toBe(15.96);
  });
});

describe('getPriceBreakdown', () => {
  it('returns correct breakdown for a standard booking', () => {
    const result = getPriceBreakdown(15, 3, 1);

    expect(result.listedSubtotal).toBe(45);
    expect(result.subtotal).toBe(45);
    expect(result.platformCommission).toBe(4.5);
    expect(result.cleanerEarnings).toBe(40.5);
    expect(result.platformCommissionPercent).toBe(10);
    expect(result.serviceFee).toBe(2.87);
    expect(result.serviceFeePercent).toBe(6);
    expect(result.total).toBe(47.87);
  });

  it('applies service multiplier correctly', () => {
    // Deep clean with 1.45x multiplier: 15 * 3 * 1.45 = 65.25 listed
    const result = getPriceBreakdown(15, 3, 1.45);

    expect(result.listedSubtotal).toBe(65.25);
    expect(result.platformCommission).toBe(6.53);
    expect(result.cleanerEarnings).toBe(58.72);
    expect(result.serviceFee).toBe(4.16);
    expect(result.total).toBe(69.41);
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
});
