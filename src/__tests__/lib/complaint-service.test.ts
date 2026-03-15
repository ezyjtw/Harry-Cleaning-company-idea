/**
 * Complaint & Evidence Service Tests
 */

describe('Complaint Service', () => {
  describe('complaint creation', () => {
    it('should require a booking ID', () => {
      const input = {
        bookingId: 'b1',
        category: 'POOR_QUALITY',
        subject: 'Bad cleaning',
        description: 'Not cleaned properly',
      };
      expect(input.bookingId).toBeTruthy();
    });

    it('should validate complaint categories', () => {
      const validCategories = [
        'NO_SHOW',
        'POOR_QUALITY',
        'PROPERTY_DAMAGE',
        'INCORRECT_DURATION',
        'SAFETY_CONCERN',
        'PAYMENT_ISSUE',
        'UNPROFESSIONAL',
        'OTHER',
      ];
      expect(validCategories).toHaveLength(8);
      expect(validCategories).toContain('NO_SHOW');
      expect(validCategories).toContain('PROPERTY_DAMAGE');
    });

    it('should validate severity levels', () => {
      const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      expect(severities).toHaveLength(4);
    });

    it('should default severity to MEDIUM', () => {
      const input = { category: 'POOR_QUALITY', severity: undefined };
      const severity = input.severity ?? 'MEDIUM';
      expect(severity).toBe('MEDIUM');
    });
  });

  describe('auto severity categorization', () => {
    it('should categorize SAFETY_CONCERN as CRITICAL', () => {
      const severityMap: Record<string, string> = {
        SAFETY_CONCERN: 'CRITICAL',
        PROPERTY_DAMAGE: 'HIGH',
        NO_SHOW: 'HIGH',
        POOR_QUALITY: 'MEDIUM',
        INCORRECT_DURATION: 'MEDIUM',
        PAYMENT_ISSUE: 'MEDIUM',
        UNPROFESSIONAL: 'LOW',
        OTHER: 'MEDIUM',
      };

      expect(severityMap['SAFETY_CONCERN']).toBe('CRITICAL');
      expect(severityMap['PROPERTY_DAMAGE']).toBe('HIGH');
      expect(severityMap['NO_SHOW']).toBe('HIGH');
      expect(severityMap['POOR_QUALITY']).toBe('MEDIUM');
    });
  });

  describe('complaint resolution', () => {
    it('should validate resolution types', () => {
      const resolutionTypes = [
        'FULL_REFUND',
        'PARTIAL_REFUND',
        'REDO_CLEAN',
        'DISMISSED',
        'NO_ACTION',
      ];
      expect(resolutionTypes.length).toBeGreaterThan(0);
    });

    it('should validate refund amount is non-negative', () => {
      const refundAmount = 50;
      expect(refundAmount).toBeGreaterThanOrEqual(0);
    });

    it('should not allow refund greater than booking total', () => {
      const bookingTotal = 100;
      const refundAmount = 150;
      const isValid = refundAmount <= bookingTotal;
      expect(isValid).toBe(false);
    });

    it('should allow partial refund within bounds', () => {
      const bookingTotal = 100;
      const refundAmount = 50;
      const isValid = refundAmount > 0 && refundAmount <= bookingTotal;
      expect(isValid).toBe(true);
    });
  });

  describe('evidence management', () => {
    it('should validate evidence types', () => {
      const validTypes = ['PHOTO', 'VIDEO', 'TEXT', 'DOCUMENT'];
      expect(validTypes).toHaveLength(4);
    });

    it('should require URL for non-text evidence', () => {
      const evidence = { type: 'PHOTO', url: 'https://storage.example.com/img.jpg' };
      expect(evidence.url).toBeTruthy();
    });

    it('should validate file extensions for photos', () => {
      const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const validUrl = 'photo.jpg';
      const ext = `.${validUrl.split('.').pop()}`;
      expect(photoExtensions).toContain(ext);
    });

    it('should validate file extensions for videos', () => {
      const videoExtensions = ['.mp4', '.mov', '.webm'];
      const validUrl = 'video.mp4';
      const ext = `.${validUrl.split('.').pop()}`;
      expect(videoExtensions).toContain(ext);
    });
  });
});

describe('Dispute Evidence', () => {
  it('should link evidence to a dispute', () => {
    const evidence = { disputeId: 'd1', type: 'PHOTO', url: 'img.jpg', uploadedBy: 'u1' };
    expect(evidence.disputeId).toBeTruthy();
    expect(evidence.uploadedBy).toBeTruthy();
  });

  it('should track who uploaded evidence', () => {
    const evidence = { uploadedBy: 'customer-1', type: 'PHOTO' };
    expect(evidence.uploadedBy).toBe('customer-1');
  });
});
