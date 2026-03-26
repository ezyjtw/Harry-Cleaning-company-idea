import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { DocumentStorageService } from './document-storage.service';
import { GdprService } from './gdpr.service';
import { RightToWorkService } from './right-to-work.service';

interface ComplianceJobResult {
  job: string;
  success: boolean;
  details: Record<string, unknown>;
  executedAt: Date;
}

/**
 * Scheduled compliance jobs that should be run periodically.
 * In production, trigger these via a cron service (e.g. Railway cron, Vercel cron, or external scheduler).
 */
export class ComplianceSchedulerService {
  /**
   * Runs all scheduled compliance jobs.
   * Call this from a cron endpoint (e.g. /api/admin/compliance/cron).
   */
  static async runAllJobs(): Promise<ComplianceJobResult[]> {
    const results: ComplianceJobResult[] = [];

    results.push(await this.destroyExpiredDbsCertificates());
    results.push(await this.destroyExpiredRtwDocuments());
    results.push(await this.checkRtwExpiry());
    results.push(await this.suspendExpiredRtwCleaners());
    results.push(await this.runAnalyticsRetentionCleanup());
    results.push(await this.checkDpaAgreementRenewals());

    await AuditService.log({
      action: 'COMPLIANCE_JOB_RUN',
      entityType: 'ComplianceScheduler',
      entityId: 'batch',
      metadata: {
        jobCount: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    });

    return results;
  }

  /**
   * Job 1: Destroy DBS certificate files older than 6 months post-verification.
   */
  static async destroyExpiredDbsCertificates(): Promise<ComplianceJobResult> {
    try {
      const result = await GdprService.destroyVerifiedDbsCertificates(180);

      // Also destroy the actual encrypted files
      const expiredDocs = await prisma.documentUpload.findMany({
        where: {
          documentType: 'dbs_certificate',
          isVerified: true,
          isDestroyed: false,
          createdAt: {
            lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          },
        },
      });

      for (const doc of expiredDocs) {
        await DocumentStorageService.destroyDocument(doc.id, 'retention_policy', 'SYSTEM');
      }

      return {
        job: 'destroy_expired_dbs_certificates',
        success: true,
        details: {
          profilesUpdated: result.destroyedCount,
          filesDestroyed: expiredDocs.length,
        },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_expired_dbs_certificates',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 2: Destroy RTW documents for cleaners who left more than 2 years ago.
   * Home Office guidance: retain for duration of engagement plus 2 years.
   */
  static async destroyExpiredRtwDocuments(): Promise<ComplianceJobResult> {
    try {
      const result = await GdprService.destroyExpiredRtwDocuments(730);

      return {
        job: 'destroy_expired_rtw_documents',
        success: true,
        details: { documentsDestroyed: result.destroyedCount },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_expired_rtw_documents',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 3: Check for expiring RTW documents and send alerts.
   * Sends alerts at 90, 60, 30, 14, and 7 days before expiry.
   */
  static async checkRtwExpiry(): Promise<ComplianceJobResult> {
    try {
      const alertThresholds = [90, 60, 30, 14, 7];
      let totalAlertsSent = 0;

      for (const days of alertThresholds) {
        const alerts = await RightToWorkService.getExpiringDocuments(days);
        // Filter to only those exactly at this threshold (± 1 day) to avoid duplicates
        const filteredAlerts = alerts.filter(
          (a) => a.daysUntilExpiry <= days && a.daysUntilExpiry > days - 7
        );

        if (filteredAlerts.length > 0) {
          const sent = await RightToWorkService.sendExpiryAlerts(filteredAlerts);
          totalAlertsSent += sent;
        }
      }

      return {
        job: 'check_rtw_expiry',
        success: true,
        details: { alertsSent: totalAlertsSent },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'check_rtw_expiry',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 4: Automatically suspend cleaners with expired RTW documents.
   */
  static async suspendExpiredRtwCleaners(): Promise<ComplianceJobResult> {
    try {
      const expired = await RightToWorkService.getExpiredDocuments();
      let suspendedCount = 0;

      for (const profile of expired) {
        await RightToWorkService.suspendExpiredRtw(profile.id, 'SYSTEM');
        suspendedCount++;
      }

      return {
        job: 'suspend_expired_rtw_cleaners',
        success: true,
        details: { suspendedCount },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'suspend_expired_rtw_cleaners',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 5: Run analytics data retention cleanup (anonymise data older than 2 years).
   */
  static async runAnalyticsRetentionCleanup(): Promise<ComplianceJobResult> {
    try {
      const result = await GdprService.runRetentionCleanup(730);

      return {
        job: 'analytics_retention_cleanup',
        success: true,
        details: { anonymisedCount: result.anonymisedCount },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'analytics_retention_cleanup',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 6: Check for DPA agreements approaching renewal date.
   */
  static async checkDpaAgreementRenewals(): Promise<ComplianceJobResult> {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const dueForRenewal = await prisma.dpaAgreement.findMany({
        where: {
          status: 'ACTIVE',
          reviewDate: { lte: thirtyDaysFromNow },
        },
      });

      // Auto-expire agreements past their expiry date
      const now = new Date();
      const expired = await prisma.dpaAgreement.updateMany({
        where: {
          status: 'ACTIVE',
          expiryDate: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      return {
        job: 'check_dpa_agreement_renewals',
        success: true,
        details: {
          dueForRenewal: dueForRenewal.length,
          autoExpired: expired.count,
        },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'check_dpa_agreement_renewals',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }
}
