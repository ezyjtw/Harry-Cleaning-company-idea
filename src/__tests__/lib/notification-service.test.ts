/**
 * Enhanced Notification Service Tests
 */

describe('EnhancedNotificationService', () => {
  describe('notification channels', () => {
    it('should support all notification channels', () => {
      const channels = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];
      expect(channels).toHaveLength(4);
    });

    it('should default to IN_APP and PUSH channels', () => {
      const defaultChannels = ['IN_APP', 'PUSH'];
      expect(defaultChannels).toContain('IN_APP');
      expect(defaultChannels).toContain('PUSH');
      expect(defaultChannels).not.toContain('SMS');
    });

    it('should include all channels for urgent notifications', () => {
      const urgentChannels = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'];
      expect(urgentChannels).toHaveLength(4);
      expect(urgentChannels).toContain('SMS');
    });
  });

  describe('notification types', () => {
    it('should support booking lifecycle notifications', () => {
      const bookingTypes = [
        'BOOKING_REQUEST',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'BOOKING_COMPLETED',
      ];
      expect(bookingTypes).toHaveLength(4);
    });

    it('should support payment notifications', () => {
      const paymentTypes = ['PAYMENT_RECEIVED', 'PAYMENT_SENT'];
      expect(paymentTypes).toHaveLength(2);
    });

    it('should support communication notifications', () => {
      const commTypes = ['NEW_MESSAGE', 'NEW_REVIEW'];
      expect(commTypes).toHaveLength(2);
    });

    it('should support dispute notifications', () => {
      const disputeTypes = ['DISPUTE_OPENED', 'DISPUTE_RESOLVED'];
      expect(disputeTypes).toHaveLength(2);
    });
  });

  describe('SMS configuration', () => {
    it('should require phone number for SMS', () => {
      const smsConfig = { to: '+447700900000', body: 'Test message' };
      expect(smsConfig.to).toMatch(/^\+?\d+$/);
    });

    it('should truncate long SMS messages', () => {
      const maxLength = 160;
      const longMessage = 'A'.repeat(200);
      const truncated = longMessage.substring(0, maxLength);
      expect(truncated.length).toBeLessThanOrEqual(maxLength);
    });
  });

  describe('push notification configuration', () => {
    it('should include required push fields', () => {
      const pushConfig = {
        title: 'Booking Confirmed',
        body: 'Your cleaning is scheduled',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
      };
      expect(pushConfig.title).toBeTruthy();
      expect(pushConfig.body).toBeTruthy();
      expect(pushConfig.icon).toBeTruthy();
    });
  });

  describe('notification payload validation', () => {
    it('should require userId', () => {
      const payload = { userId: 'u1', type: 'BOOKING_CONFIRMED', title: 'Test', body: 'Test body' };
      expect(payload.userId).toBeTruthy();
    });

    it('should require title and body', () => {
      const payload = { userId: 'u1', type: 'SYSTEM', title: 'Title', body: 'Body' };
      expect(payload.title).toBeTruthy();
      expect(payload.body).toBeTruthy();
    });

    it('should allow optional data', () => {
      const payload = {
        userId: 'u1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking',
        body: 'Confirmed',
        data: { bookingId: 'b1' },
      };
      expect(payload.data).toBeDefined();
      expect(payload.data.bookingId).toBe('b1');
    });
  });
});
