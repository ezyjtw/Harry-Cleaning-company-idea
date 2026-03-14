import { PricingService } from '@/lib/services/pricing.service';

describe('PricingService', () => {
  describe('calculate', () => {
    it('should calculate basic pricing', () => {
      const result = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
      });

      expect(result.baseAmount).toBe(50);
      expect(result.serviceMultiplier).toBe(1.0);
      expect(result.total).toBeGreaterThan(result.subtotal);
    });

    it('should apply deep clean multiplier', () => {
      const result = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'deep',
      });

      expect(result.serviceMultiplier).toBe(1.5);
      expect(result.subtotal).toBeGreaterThan(50);
    });

    it('should apply room multipliers', () => {
      const withRooms = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
        rooms: { bedrooms: 3, bathrooms: 2, kitchen: true, livingAreas: 2 },
      });

      const withoutRooms = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
      });

      expect(withRooms.roomMultiplier).toBeGreaterThan(1);
      expect(withRooms.total).toBeGreaterThan(withoutRooms.total);
    });

    it('should add extras pricing', () => {
      const result = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
        extras: ['inside-oven', 'windows'],
      });

      expect(result.extrasAmount).toBe(35); // 15 + 20
    });

    it('should apply tier premiums', () => {
      const starter = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
        cleanerTier: 'STARTER',
      });

      const elite = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
        cleanerTier: 'ELITE',
      });

      expect(elite.tierPremium).toBeGreaterThan(starter.tierPremium);
      expect(elite.total).toBeGreaterThan(starter.total);
    });

    it('should apply urgent fee for same-day bookings', () => {
      const result = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
        isSameDay: true,
      });

      expect(result.urgentFee).toBeGreaterThan(0);
    });

    it('should always include platform fee', () => {
      const result = PricingService.calculate({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
      });

      expect(result.platformFee).toBeGreaterThan(0);
      expect(result.total).toBe(result.subtotal + result.platformFee);
    });
  });

  describe('getLocationMultiplier', () => {
    it('should return higher multiplier for central London', () => {
      const central = PricingService.getLocationMultiplier('SW1A 1AA');
      const outer = PricingService.getLocationMultiplier('BR1 1AA');
      expect(central).toBeGreaterThan(outer);
    });

    it('should return 1.0 for unknown areas', () => {
      expect(PricingService.getLocationMultiplier('XX1 1AA')).toBe(1.0);
    });
  });

  describe('getEstimateRange', () => {
    it('should return min, max, and average', () => {
      const range = PricingService.getEstimateRange({
        baseRate: 25,
        duration: 2,
        serviceType: 'standard',
      });

      expect(range.min).toBeLessThan(range.average);
      expect(range.max).toBeGreaterThan(range.average);
    });
  });

  describe('getComparisonPricing', () => {
    it('should show savings vs agencies', () => {
      const comparison = PricingService.getComparisonPricing(100);

      expect(comparison.rena).toBe(100);
      expect(comparison.typicalAgency).toBeGreaterThan(100);
      expect(comparison.otherPlatforms).toBeGreaterThan(100);
      expect(comparison.savings).toBeGreaterThan(0);
    });
  });
});
