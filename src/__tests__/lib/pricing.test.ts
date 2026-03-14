import {
  calculatePlatformFee,
  calculateTotalPrice,
  getPriceBreakdown,
  PLATFORM_FEE_PERCENT,
} from '@/lib/pricing'

describe('PLATFORM_FEE_PERCENT', () => {
  it('should be 10%', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(10)
  })
})

describe('calculatePlatformFee', () => {
  it('calculates 10% fee on a standard amount', () => {
    expect(calculatePlatformFee(100)).toBe(10)
  })

  it('calculates fee on a typical cleaner earnings amount', () => {
    expect(calculatePlatformFee(45)).toBe(4.5)
  })

  it('rounds to two decimal places', () => {
    // 33 * 0.10 = 3.3 (already 2 decimals or fewer)
    expect(calculatePlatformFee(33)).toBe(3.3)
    // 17.5 * 0.10 = 1.75
    expect(calculatePlatformFee(17.5)).toBe(1.75)
  })

  it('handles small amounts correctly', () => {
    expect(calculatePlatformFee(1)).toBe(0.1)
    expect(calculatePlatformFee(0.5)).toBe(0.05)
  })

  it('returns 0 for 0 earnings', () => {
    expect(calculatePlatformFee(0)).toBe(0)
  })

  it('handles negative values', () => {
    expect(calculatePlatformFee(-100)).toBe(-10)
  })

  it('handles very large amounts', () => {
    expect(calculatePlatformFee(10000)).toBe(1000)
  })
})

describe('calculateTotalPrice', () => {
  it('adds platform fee to cleaner earnings', () => {
    // 100 + 10% = 110
    expect(calculateTotalPrice(100)).toBe(110)
  })

  it('calculates correct total for typical booking', () => {
    // 45 (3hrs x 15) + 4.50 (10%) = 49.50
    expect(calculateTotalPrice(45)).toBe(49.5)
  })

  it('returns 0 for 0 earnings', () => {
    expect(calculateTotalPrice(0)).toBe(0)
  })

  it('handles decimal earnings', () => {
    // 22.50 + 2.25 = 24.75
    expect(calculateTotalPrice(22.5)).toBe(24.75)
  })

  it('handles negative values (edge case)', () => {
    expect(calculateTotalPrice(-50)).toBe(-55)
  })
})

describe('getPriceBreakdown', () => {
  it('returns correct breakdown for a standard booking', () => {
    const result = getPriceBreakdown(15, 3, 1)

    expect(result).toEqual({
      cleanerEarnings: 45,
      platformFee: 4.5,
      total: 49.5,
      platformFeePercent: 10,
    })
  })

  it('applies service multiplier correctly', () => {
    // Deep clean with 1.5x multiplier: 15 * 3 * 1.5 = 67.50
    const result = getPriceBreakdown(15, 3, 1.5)

    expect(result.cleanerEarnings).toBe(67.5)
    expect(result.platformFee).toBe(6.75)
    expect(result.total).toBe(74.25)
    expect(result.platformFeePercent).toBe(10)
  })

  it('handles 0 duration', () => {
    const result = getPriceBreakdown(15, 0, 1)

    expect(result.cleanerEarnings).toBe(0)
    expect(result.platformFee).toBe(0)
    expect(result.total).toBe(0)
  })

  it('handles 0 rate', () => {
    const result = getPriceBreakdown(0, 3, 1)

    expect(result.cleanerEarnings).toBe(0)
    expect(result.platformFee).toBe(0)
    expect(result.total).toBe(0)
  })

  it('handles 0 multiplier', () => {
    const result = getPriceBreakdown(15, 3, 0)

    expect(result.cleanerEarnings).toBe(0)
    expect(result.platformFee).toBe(0)
    expect(result.total).toBe(0)
  })

  it('total equals cleanerEarnings plus platformFee', () => {
    const result = getPriceBreakdown(20, 4, 1.2)

    expect(result.total).toBe(result.cleanerEarnings + result.platformFee)
  })

  it('always includes platformFeePercent of 10', () => {
    const result = getPriceBreakdown(25, 2, 1)
    expect(result.platformFeePercent).toBe(10)
  })

  it('rounds all values to 2 decimal places', () => {
    const result = getPriceBreakdown(13, 2.5, 1.3)

    const decimals = (n: number) => {
      const parts = n.toString().split('.')
      return parts.length > 1 ? parts[1].length : 0
    }

    expect(decimals(result.cleanerEarnings)).toBeLessThanOrEqual(2)
    expect(decimals(result.platformFee)).toBeLessThanOrEqual(2)
    expect(decimals(result.total)).toBeLessThanOrEqual(2)
  })

  it('handles negative duration (edge case)', () => {
    const result = getPriceBreakdown(15, -2, 1)

    expect(result.cleanerEarnings).toBe(-30)
    expect(result.total).toBe(-33)
  })
})
