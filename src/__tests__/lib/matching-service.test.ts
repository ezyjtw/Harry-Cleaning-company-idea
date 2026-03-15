import { MatchingService } from '@/lib/services/matching.service';

describe('MatchingService', () => {
  describe('explainScore', () => {
    it('should explain high rating', () => {
      const match = createMockMatch({ rating: 4.8, scores: { rating: 0.96 } });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Exceptional rating (4.5+/5)');
    });

    it('should explain good rating', () => {
      const match = createMockMatch({ rating: 4.2, scores: { rating: 0.84 } });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Excellent rating (4.0+/5)');
    });

    it('should explain close distance', () => {
      const match = createMockMatch({ scores: { distance: 0.9 } });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Very close to your location');
    });

    it('should explain repeat cleaner', () => {
      const match = createMockMatch({ isRepeatCleaner: true });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Has cleaned for you before');
    });

    it('should explain high reliability', () => {
      const match = createMockMatch({ scores: { reliability: 0.98 } });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Highly reliable (low cancellation rate)');
    });

    it('should explain fast response', () => {
      const match = createMockMatch({ scores: { responseSpeed: 0.85 } });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toContain('Fast response times');
    });

    it('should return empty for average cleaner', () => {
      const match = createMockMatch({
        scores: {
          rating: 0.5,
          distance: 0.3,
          reliability: 0.7,
          completionRate: 0.7,
          responseSpeed: 0.5,
          repeatBonus: 0,
        },
        isRepeatCleaner: false,
      });
      const explanations = MatchingService.explainScore(match);
      expect(explanations).toHaveLength(0);
    });
  });
});

function createMockMatch(overrides: Record<string, unknown> = {}) {
  const defaultScores = {
    rating: 0.5,
    distance: 0.5,
    reliability: 0.5,
    completionRate: 0.5,
    responseSpeed: 0.5,
    repeatBonus: 0,
  };

  return {
    cleanerId: 'cleaner-1',
    userId: 'user-1',
    name: 'Test Cleaner',
    rating: 3.5,
    hourlyRate: 20,
    tier: 'BRONZE',
    totalScore: 0.5,
    scores: { ...defaultScores, ...((overrides.scores as Record<string, number>) ?? {}) },
    distanceKm: 5,
    estimatedTravelMinutes: 15,
    isRepeatCleaner: false,
    isAvailable: true,
    ...overrides,
    scores: { ...defaultScores, ...((overrides.scores as Record<string, number>) ?? {}) },
  };
}
