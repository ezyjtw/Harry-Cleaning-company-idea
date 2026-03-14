import { BookingLifecycleService } from '@/lib/services/booking-lifecycle.service';

describe('BookingLifecycleService', () => {
  describe('isValidTransition', () => {
    it('should allow PENDING -> CONFIRMED', () => {
      expect(BookingLifecycleService.isValidTransition('PENDING', 'CONFIRMED')).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(BookingLifecycleService.isValidTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should not allow PENDING -> COMPLETED', () => {
      expect(BookingLifecycleService.isValidTransition('PENDING', 'COMPLETED')).toBe(false);
    });

    it('should not allow CANCELLED -> anything', () => {
      expect(BookingLifecycleService.isValidTransition('CANCELLED', 'PENDING')).toBe(false);
      expect(BookingLifecycleService.isValidTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    });

    it('should allow CONFIRMED -> ACCEPTED', () => {
      expect(BookingLifecycleService.isValidTransition('CONFIRMED', 'ACCEPTED')).toBe(true);
    });

    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(BookingLifecycleService.isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should allow COMPLETED -> REVIEWED', () => {
      expect(BookingLifecycleService.isValidTransition('COMPLETED', 'REVIEWED')).toBe(true);
    });

    it('should not allow REVIEWED -> anything', () => {
      expect(BookingLifecycleService.isValidTransition('REVIEWED', 'COMPLETED')).toBe(false);
    });
  });

  describe('getNextStatuses', () => {
    it('should return valid next statuses for PENDING', () => {
      expect(BookingLifecycleService.getNextStatuses('PENDING')).toEqual([
        'CONFIRMED',
        'CANCELLED',
      ]);
    });

    it('should return empty array for CANCELLED', () => {
      expect(BookingLifecycleService.getNextStatuses('CANCELLED')).toEqual([]);
    });

    it('should return empty array for REVIEWED', () => {
      expect(BookingLifecycleService.getNextStatuses('REVIEWED')).toEqual([]);
    });
  });

  describe('canCancel', () => {
    it('should allow full refund for bookings > 48 hours away', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const result = BookingLifecycleService.canCancel(futureDate, 'CONFIRMED');
      expect(result.canCancel).toBe(true);
      expect(result.refundPercent).toBe(100);
    });

    it('should allow 75% refund for bookings 24-48 hours away', () => {
      const futureDate = new Date(Date.now() + 36 * 60 * 60 * 1000);
      const result = BookingLifecycleService.canCancel(futureDate, 'CONFIRMED');
      expect(result.canCancel).toBe(true);
      expect(result.refundPercent).toBe(75);
    });

    it('should allow 50% refund for bookings 6-24 hours away', () => {
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const result = BookingLifecycleService.canCancel(futureDate, 'CONFIRMED');
      expect(result.canCancel).toBe(true);
      expect(result.refundPercent).toBe(50);
    });

    it('should allow 0% refund for bookings < 6 hours away', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const result = BookingLifecycleService.canCancel(futureDate, 'CONFIRMED');
      expect(result.canCancel).toBe(true);
      expect(result.refundPercent).toBe(0);
    });

    it('should not allow cancellation for IN_PROGRESS bookings', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const result = BookingLifecycleService.canCancel(futureDate, 'IN_PROGRESS');
      expect(result.canCancel).toBe(false);
    });
  });

  describe('calculateCancellationRefund', () => {
    it('should calculate correct refund amount', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const refund = BookingLifecycleService.calculateCancellationRefund(
        100,
        futureDate,
        'CONFIRMED'
      );
      expect(refund).toBe(100);
    });

    it('should calculate 75% refund', () => {
      const futureDate = new Date(Date.now() + 36 * 60 * 60 * 1000);
      const refund = BookingLifecycleService.calculateCancellationRefund(
        100,
        futureDate,
        'CONFIRMED'
      );
      expect(refund).toBe(75);
    });
  });
});
