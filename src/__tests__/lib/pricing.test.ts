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
  it('adds 10% markup to cleaner rate', () => {
    expect(getListedRate(100)).toBe(110);
    expect(getSubtotal(100)).toBe(110); // alias
  });

  it('handles typical cleaner rate', () => {
    expect(getListedRate(45)).toBe(49.5);
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
    expect(getServiceFee(49.5)).toBe(3.16);
  });
});

describe('getDisplayedRate', () => {
  it('returns cleaner rate + 10% commission + 6% service fee on total', () => {
    // 100 * 1.10 = 110 listed, 110 / 0.94 = 117.02 total
    expect(getDisplayedRate(100)).toBe(117.02);
  });

  it('calculates correct total for typical rate', () => {
    // 15 * 1.10 = 16.50, 16.50 / 0.94 = 17.55
    expect(getDisplayedRate(15)).toBe(17.55);
  });
});

describe('getPriceBreakdown', () => {
  it('returns correct breakdown for a standard booking', () => {
    const result = getPriceBreakdown(15, 3, 1);

    expect(result.cleanerEarnings).toBe(45);
    expect(result.platformCommission).toBe(4.5);
    expect(result.platformCommissionPercent).toBe(10);
    expect(result.listedSubtotal).toBe(49.5);
    expect(result.subtotal).toBe(49.5); // backward compat alias
    expect(result.serviceFee).toBe(3.16);
    expect(result.serviceFeePercent).toBe(6);
    expect(result.total).toBe(52.66);
  });

  it('applies service multiplier correctly', () => {
    // Deep clean with 1.45x multiplier: 15 * 3 * 1.45 = 65.25
    const result = getPriceBreakdown(15, 3, 1.45);

    expect(result.cleanerEarnings).toBe(65.25);
    expect(result.platformCommission).toBe(6.53);
    expect(result.subtotal).toBe(71.78);
    expect(result.serviceFee).toBe(4.58);
    expect(result.total).toBe(76.36);
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
