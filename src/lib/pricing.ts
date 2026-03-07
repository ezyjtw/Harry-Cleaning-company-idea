// Platform fee configuration
// Sparkle takes a low cut to keep pricing competitive and attract top cleaners.
// Cleaners keep the majority of their earnings.

export const PLATFORM_FEE_PERCENT = 10; // 10% — significantly lower than industry standard 20-30%

export function calculatePlatformFee(cleanerEarnings: number): number {
  return Math.round(cleanerEarnings * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
}

export function calculateTotalPrice(cleanerEarnings: number): number {
  return cleanerEarnings + calculatePlatformFee(cleanerEarnings);
}

export function getPriceBreakdown(cleanerRate: number, duration: number, serviceMultiplier: number) {
  const cleanerEarnings = cleanerRate * duration * serviceMultiplier;
  const platformFee = calculatePlatformFee(cleanerEarnings);
  const total = cleanerEarnings + platformFee;

  return {
    cleanerEarnings: Math.round(cleanerEarnings * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    platformFeePercent: PLATFORM_FEE_PERCENT,
  };
}
