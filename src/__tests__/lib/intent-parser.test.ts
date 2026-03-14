import { parseIntent, requiresConfirmation } from '@/lib/ai/intent-parser';

describe('Intent Parser', () => {
  describe('parseIntent', () => {
    it('should detect booking intent', () => {
      const result = parseIntent('I want to book a cleaning for next Tuesday');
      expect(result.intent).toBe('BOOK_CLEANING');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should detect cancellation intent', () => {
      const result = parseIntent('I need to cancel my booking');
      expect(result.intent).toBe('CANCEL_BOOKING');
    });

    it('should detect estimate intent', () => {
      const result = parseIntent('How much would a deep clean cost?');
      expect(result.intent).toBe('GET_ESTIMATE');
    });

    it('should detect availability intent', () => {
      const result = parseIntent('When is Sarah available next week?');
      expect(result.intent).toBe('CHECK_AVAILABILITY');
    });

    it('should detect modify intent', () => {
      const result = parseIntent('I need to reschedule my booking to Thursday');
      expect(result.intent).toBe('MODIFY_BOOKING');
    });

    it('should return UNKNOWN for gibberish', () => {
      const result = parseIntent('asdfghjkl');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should extract date entities', () => {
      const result = parseIntent('Book a cleaning for tomorrow');
      expect(result.entities.date).toBeDefined();
    });

    it('should extract time entities', () => {
      const result = parseIntent('I want a cleaning at 10am');
      expect(result.entities.time).toBeDefined();
    });

    it('should extract service type entities', () => {
      const result = parseIntent('I need a deep clean');
      expect(result.entities.serviceType).toBeDefined();
    });

    it('should extract postcode entities', () => {
      const result = parseIntent('My postcode is SW1A 1AA');
      expect(result.entities.postcode).toBe('SW1A 1AA');
    });
  });

  describe('requiresConfirmation', () => {
    it('should require confirmation for cancellation', () => {
      expect(requiresConfirmation('CANCEL_BOOKING')).toBe(true);
    });

    it('should require confirmation for modifications', () => {
      expect(requiresConfirmation('MODIFY_BOOKING')).toBe(true);
    });

    it('should not require confirmation for estimates', () => {
      expect(requiresConfirmation('GET_ESTIMATE')).toBe(false);
    });

    it('should not require confirmation for booking', () => {
      expect(requiresConfirmation('BOOK_CLEANING')).toBe(false);
    });
  });
});
