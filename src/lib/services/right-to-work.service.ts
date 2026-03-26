import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';

interface ShareCodeCheckResult {
  valid: boolean;
  status: 'valid' | 'invalid' | 'expired' | 'error';
  rightToWork?: boolean;
  expiresAt?: Date;
  fullName?: string;
  dateOfBirth?: string;
  immigrationStatus?: string;
  errorMessage?: string;
}

interface RtwExpiryAlert {
  profileId: string;
  userId: string;
  cleanerName: string;
  email: string;
  docType: string;
  expiresAt: Date;
  daysUntilExpiry: number;
}

export class RightToWorkService {
  /**
   * Verifies a Home Office share code via the Employer Checking Service API.
   *
   * In production, this integrates with the real gov.uk Employer Checking Service.
   * The API requires the employer to be registered with the Home Office.
   *
   * API docs: https://www.gov.uk/check-job-applicant-right-to-work
   */
  static async verifyShareCode(
    shareCode: string,
    dateOfBirth: string,
    requestedBy: string,
    ipAddress?: string
  ): Promise<ShareCodeCheckResult> {
    // Validate share code format (9 alphanumeric characters)
    const shareCodeRegex = /^[A-Z0-9]{9}$/i;
    if (!shareCodeRegex.test(shareCode)) {
      return {
        valid: false,
        status: 'invalid',
        errorMessage: 'Share code must be 9 alphanumeric characters',
      };
    }

    // Validate date of birth format
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dateOfBirth)) {
      return {
        valid: false,
        status: 'invalid',
        errorMessage: 'Date of birth must be in YYYY-MM-DD format',
      };
    }

    await AuditService.log({
      userId: requestedBy,
      action: 'RTW_SHARE_CODE_CHECKED',
      entityType: 'RightToWork',
      entityId: shareCode,
      metadata: {
        shareCode: `${shareCode.substring(0, 3)}***${shareCode.substring(6)}`,
        dateOfBirth: '***REDACTED***',
      },
      ipAddress,
    });

    try {
      const apiKey = process.env.HOME_OFFICE_ECS_API_KEY;
      const apiUrl = process.env.HOME_OFFICE_ECS_API_URL;

      if (!apiKey || !apiUrl) {
        // Fall back to manual verification if API not configured
        return {
          valid: false,
          status: 'error',
          errorMessage:
            'Home Office Employer Checking Service is not configured. Manual verification required.',
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          shareCode: shareCode.toUpperCase(),
          dateOfBirth,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            valid: false,
            status: 'invalid',
            errorMessage: 'Share code not found or does not match the date of birth provided',
          };
        }
        throw new Error(`ECS API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        valid: data.rightToWork === true,
        status: data.rightToWork ? 'valid' : 'expired',
        rightToWork: data.rightToWork,
        expiresAt: data.expiryDate ? new Date(data.expiryDate) : undefined,
        fullName: data.fullName,
        immigrationStatus: data.immigrationStatus,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        status: 'error',
        errorMessage: `Failed to verify share code: ${errorMessage}`,
      };
    }
  }

  /**
   * Finds all cleaners whose right to work documents are expiring within the given days.
   * Used for proactive alerts.
   */
  static async getExpiringDocuments(withinDays: number = 30): Promise<RtwExpiryAlert[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    const profiles = await prisma.cleanerProfile.findMany({
      where: {
        rightToWorkStatus: 'VERIFIED',
        rightToWorkExpiresAt: {
          not: null,
          lte: cutoffDate,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return profiles.map((profile) => {
      const expiresAt = profile.rightToWorkExpiresAt as Date;
      const now = new Date();
      const daysUntilExpiry = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        profileId: profile.id,
        userId: profile.userId,
        cleanerName: profile.user.name || 'Unknown',
        email: profile.user.email,
        docType: profile.rightToWorkDocType || 'unknown',
        expiresAt,
        daysUntilExpiry,
      };
    });
  }

  /**
   * Gets cleaners with already-expired right to work documents.
   * These cleaners should be suspended from accepting new bookings.
   */
  static async getExpiredDocuments() {
    const now = new Date();

    return prisma.cleanerProfile.findMany({
      where: {
        rightToWorkStatus: 'VERIFIED',
        rightToWorkExpiresAt: {
          not: null,
          lt: now,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Suspends a cleaner whose right to work has expired.
   * Sets their RTW status to UNVERIFIED and flags their profile.
   */
  static async suspendExpiredRtw(profileId: string, adminId: string): Promise<void> {
    await prisma.cleanerProfile.update({
      where: { id: profileId },
      data: {
        rightToWorkStatus: 'UNVERIFIED',
        availableNow: false,
      },
    });

    await AuditService.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'CleanerProfile',
      entityId: profileId,
      metadata: {
        action: 'RTW_EXPIRED_SUSPENSION',
        note: 'Cleaner suspended due to expired right to work documentation',
      },
    });
  }

  /**
   * Sends expiry alerts for cleaners whose RTW documents are expiring.
   * In production, this would send emails via the email service.
   */
  static async sendExpiryAlerts(
    alerts: RtwExpiryAlert[],
    performedBy: string = 'SYSTEM'
  ): Promise<number> {
    let sentCount = 0;

    for (const alert of alerts) {
      // In production: send email via Resend/email service
      // For now, log the alert and create a notification

      try {
        await prisma.notification.create({
          data: {
            userId: alert.userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Right to Work Document Expiring',
            body:
              alert.daysUntilExpiry <= 0
                ? `Your ${formatDocType(alert.docType)} has expired. Please update your right to work documentation immediately to continue accepting bookings.`
                : `Your ${formatDocType(alert.docType)} expires in ${alert.daysUntilExpiry} days (${alert.expiresAt.toLocaleDateString('en-GB')}). Please update your documentation before it expires.`,
            data: {
              type: 'rtw_expiry',
              daysUntilExpiry: alert.daysUntilExpiry,
              expiresAt: alert.expiresAt.toISOString(),
            },
          },
        });

        await AuditService.log({
          userId: performedBy,
          action: 'RTW_EXPIRY_ALERT_SENT',
          entityType: 'CleanerProfile',
          entityId: alert.profileId,
          metadata: {
            daysUntilExpiry: alert.daysUntilExpiry,
            docType: alert.docType,
            cleanerEmail: alert.email,
          },
        });

        sentCount++;
      } catch {
        // Failed to send expiry alert — continue with remaining alerts
      }
    }

    return sentCount;
  }
}

function formatDocType(docType: string): string {
  const map: Record<string, string> = {
    uk_passport: 'UK Passport',
    irish_passport: 'Irish Passport',
    brp: 'Biometric Residence Permit',
    eu_settled: 'EU Settled Status',
    eu_pre_settled: 'EU Pre-Settled Status',
    share_code: 'Home Office Share Code',
    visa: 'Work Visa',
  };
  return map[docType] || docType;
}
