import { TravelTimeService } from '@/lib/services/travel-time.service';

describe('TravelTimeService', () => {
  const locationA = { latitude: 51.5074, longitude: -0.1278 }; // Central London
  const locationB = { latitude: 51.5155, longitude: -0.1419 }; // Near Oxford Circus
  const locationC = { latitude: 51.4545, longitude: -0.9781 }; // Reading (far)

  describe('calculateDistance', () => {
    it('should return 0 for same location', () => {
      expect(TravelTimeService.calculateDistance(locationA, locationA)).toBe(0);
    });

    it('should calculate short distance correctly', () => {
      const distance = TravelTimeService.calculateDistance(locationA, locationB);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(5); // Should be ~1.3km
    });

    it('should calculate longer distance', () => {
      const distance = TravelTimeService.calculateDistance(locationA, locationC);
      expect(distance).toBeGreaterThan(50); // ~60km to Reading
    });
  });

  describe('estimateTravelTime', () => {
    it('should estimate travel time for short distance', () => {
      const estimate = TravelTimeService.estimateTravelTime(locationA, locationB);
      expect(estimate.distanceKm).toBeGreaterThan(0);
      expect(estimate.durationMinutes).toBeGreaterThan(0);
    });

    it('should not charge travel fee within free radius', () => {
      const estimate = TravelTimeService.estimateTravelTime(locationA, locationB);
      expect(estimate.travelFee).toBe(0);
    });

    it('should charge travel fee beyond free radius', () => {
      const estimate = TravelTimeService.estimateTravelTime(locationA, locationC);
      expect(estimate.travelFee).toBeGreaterThan(0);
    });
  });

  describe('isWithinServiceRadius', () => {
    it('should return true for nearby location', () => {
      expect(TravelTimeService.isWithinServiceRadius(locationA, locationB, 10)).toBe(true);
    });

    it('should return false for far location with small radius', () => {
      expect(TravelTimeService.isWithinServiceRadius(locationA, locationC, 5)).toBe(false);
    });
  });

  describe('calculateTravelFee', () => {
    it('should return 0 within free radius', () => {
      expect(TravelTimeService.calculateTravelFee(3)).toBe(0);
    });

    it('should calculate fee for distance beyond free radius', () => {
      expect(TravelTimeService.calculateTravelFee(10)).toBeGreaterThan(0);
    });
  });

  describe('hasAdequateTravelTime', () => {
    it('should confirm adequate time for large gap', () => {
      const result = TravelTimeService.hasAdequateTravelTime(
        '09:00',
        '12:00',
        locationA,
        locationB
      );
      expect(result.adequate).toBe(true);
    });

    it('should flag inadequate time for small gap with distant locations', () => {
      const result = TravelTimeService.hasAdequateTravelTime(
        '09:00',
        '09:15',
        locationA,
        locationC
      );
      expect(result.adequate).toBe(false);
    });
  });
});
