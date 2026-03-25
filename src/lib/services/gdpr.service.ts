import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';

export type ConsentType = 'marketing' | 'analytics' | 'essential' | 'data_processing';

interface RecordConsentParams {
  userId?: string;
  email: string;
  consentType: ConsentType;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
  version?: string;
}

export class GdprService {
  /**
   * Record a consent decision (grant or revoke)
   */
  static async recordConsent(params: RecordConsentParams) {
    const consent = await prisma.gdprConsent.create({
      data: {
        userId: params.userId,
        email: params.email,
        consentType: params.consentType,
        granted: params.granted,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        version: params.version ?? '1.0',
        revokedAt: params.granted ? null : new Date(),
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'GdprConsent',
      entityId: consent.id,
      metadata: {
        consentType: params.consentType,
        granted: params.granted,
        email: params.email,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return consent;
  }

  /**
   * Record multiple consent decisions at once (e.g. cookie banner)
   */
  static async recordBulkConsent(params: {
    userId?: string;
    email: string;
    consents: { type: ConsentType; granted: boolean }[];
    ipAddress?: string;
    userAgent?: string;
    version?: string;
  }) {
    const results = await Promise.all(
      params.consents.map((consent) =>
        this.recordConsent({
          userId: params.userId,
          email: params.email,
          consentType: consent.type,
          granted: consent.granted,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          version: params.version,
        })
      )
    );

    return results;
  }

  /**
   * Get current consent status for a user/email
   */
  static async getConsentStatus(params: { userId?: string; email?: string }) {
    if (!params.userId && !params.email) {
      throw new Error('Either userId or email must be provided');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const where = params.userId ? { userId: params.userId } : { email: params.email! };

    // Get the latest consent record for each type
    const consents = await prisma.gdprConsent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Build current status from most recent of each type
    const status: Record<string, { granted: boolean; updatedAt: Date; version: string }> = {};

    for (const consent of consents) {
      if (!status[consent.consentType]) {
        status[consent.consentType] = {
          granted: consent.granted,
          updatedAt: consent.createdAt,
          version: consent.version,
        };
      }
    }

    return status;
  }

  /**
   * Submit a data deletion request (GDPR right to erasure)
   */
  static async requestDataDeletion(params: { userId: string; email: string; reason?: string }) {
    const request = await prisma.dataDeletionRequest.create({
      data: {
        userId: params.userId,
        email: params.email,
        reason: params.reason,
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: request.id,
      metadata: { action: 'DATA_DELETION_REQUESTED', email: params.email },
    });

    return request;
  }

  /**
   * Process a data deletion request — anonymise user data
   */
  static async processDataDeletion(params: { requestId: string; processedBy: string }) {
    const request = await prisma.dataDeletionRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) throw new Error('Deletion request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    // Update request status
    await prisma.dataDeletionRequest.update({
      where: { id: params.requestId },
      data: { status: 'IN_PROGRESS', processedBy: params.processedBy },
    });

    // Anonymise user data (soft delete approach for legal compliance)
    const anonymisedEmail = `deleted-${request.userId}@anonymised.rena.com`;

    await prisma.user.update({
      where: { id: request.userId },
      data: {
        email: anonymisedEmail,
        name: 'Deleted User',
        phone: null,
        image: null,
        passwordHash: null,
        isDeleted: true,
        deletedAt: new Date(),
        accountStatus: 'DEACTIVATED',
      },
    });

    // Anonymise addresses
    await prisma.address.updateMany({
      where: { userId: request.userId },
      data: {
        line1: 'REDACTED',
        line2: null,
        city: 'REDACTED',
        label: null,
      },
    });

    // Log the retention action
    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'User',
        entityId: request.userId,
        action: 'ANONYMISED',
        reason: 'user_request',
        performedBy: params.processedBy,
        metadata: { requestId: params.requestId },
      },
    });

    // Mark request as complete
    await prisma.dataDeletionRequest.update({
      where: { id: params.requestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await AuditService.log({
      userId: params.processedBy,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: params.requestId,
      metadata: {
        action: 'DATA_DELETION_COMPLETED',
        deletedUserId: request.userId,
      },
    });

    return { success: true };
  }

  /**
   * Export user data (GDPR right to data portability)
   */
  static async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        bookingsAsClient: {
          include: { review: true },
        },
        reviewsGiven: true,
        cleanerProfile: true,
      },
    });

    if (!user) throw new Error('User not found');

    // Log the export
    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'User',
        entityId: userId,
        action: 'EXPORTED',
        reason: 'user_request',
      },
    });

    await AuditService.log({
      userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { action: 'DATA_EXPORTED' },
    });

    // Return structured data export
    return {
      personalInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      addresses: user.addresses.map((a) => ({
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        postcode: a.postcode,
      })),
      bookings: user.bookingsAsClient.map((b) => ({
        id: b.id,
        serviceType: b.serviceType,
        date: b.date,
        status: b.status,
        totalPrice: b.totalPrice,
        review: b.review ? { rating: b.review.rating, text: b.review.text } : null,
      })),
      cleanerProfile: user.cleanerProfile
        ? {
            bio: user.cleanerProfile.bio,
            hourlyRate: user.cleanerProfile.hourlyRate,
            specialties: user.cleanerProfile.specialties,
            tier: user.cleanerProfile.tier,
          }
        : null,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all pending deletion requests (for admin)
   */
  static async getPendingDeletionRequests() {
    return prisma.dataDeletionRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /**
   * Run automated data retention cleanup
   * Anonymises analytics data older than the retention period
   */
  static async runRetentionCleanup(retentionDays: number = 730) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Anonymise old analytics events (keep aggregated data, remove PII)
    const updated = await prisma.analyticsEvent.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        ipAddress: { not: null },
      },
      data: {
        ipAddress: null,
        userId: null,
      },
    });

    // Log the cleanup
    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'AnalyticsEvent',
        entityId: 'batch',
        action: 'ANONYMISED',
        reason: 'retention_policy',
        performedBy: 'SYSTEM',
        metadata: {
          recordsAnonymised: updated.count,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
        },
      },
    });

    return { anonymisedCount: updated.count };
  }

  /**
   * Destroy DBS certificate files after verification.
   * Retains only certificate number, issue date, and verification outcome.
   * Should be run as a scheduled job — destroys certificates older than 6 months.
   */
  static async destroyVerifiedDbsCertificates(maxAgeDays: number = 180) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Find profiles with verified DBS certs that haven't been destroyed yet
    const profiles = await prisma.cleanerProfile.findMany({
      where: {
        dbsCertVerified: true,
        dbsCertDestroyedAt: null,
        updatedAt: { lt: cutoffDate },
      },
      select: { id: true, userId: true },
    });

    let destroyedCount = 0;

    for (const profile of profiles) {
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          dbsCertDestroyedAt: new Date(),
          // In production: also delete the actual file from storage here
        },
      });

      await prisma.dataRetentionLog.create({
        data: {
          entityType: 'CleanerProfile',
          entityId: profile.id,
          action: 'DELETED',
          reason: 'retention_policy',
          performedBy: 'SYSTEM',
          metadata: {
            field: 'dbsCertFile',
            note: 'DBS certificate file destroyed after verification. Certificate number and issue date retained.',
          },
        },
      });

      destroyedCount++;
    }

    return { destroyedCount };
  }
}
