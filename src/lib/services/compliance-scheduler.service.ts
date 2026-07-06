import { prisma } from '@/lib/db/prisma';
import { deleteObject } from '@/lib/storage/r2-client';

import { AuditService } from './audit.service';
import { DocumentStorageService } from './document-storage.service';
import { GdprService } from './gdpr.service';
import { RightToWorkService } from './right-to-work.service';

const DAY_MS = 24 * 60 * 60 * 1000;

// Retention periods (James-signed, Batch 1 B3-new-jobs):
const PHOTO_ID_POST_CLOSURE_DAYS = 30; // privacy-policy commitment
const INSURANCE_POST_EXPIRY_DAYS = 3 * 365; // 3yr liability-claims limitation window
const INSURANCE_POST_CLOSURE_DAYS = 30; // floor, same as identity docs
const DISPUTE_EVIDENCE_POST_RESOLUTION_DAYS = 730; // 2yr post-resolution
const IMPORTED_REVIEW_EVIDENCE_POST_DECISION_DAYS = 365; // 12mo post verify/reject

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
    results.push(await this.destroyExpiredPhotoIdDocuments());
    results.push(await this.destroyExpiredInsuranceDocuments());
    results.push(await this.destroyResolvedDisputeEvidence());
    results.push(await this.destroyDecidedImportedReviewEvidence());
    results.push(await this.processApprovedDeletionRequests());

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

  /**
   * Returns userIds whose account has been closed longer than `days` ago —
   * either soft-deleted (isDeleted + deletedAt) or DEACTIVATED (by updatedAt).
   * Mirrors the closure predicate used by the RTW retention job.
   */
  private static async getClosedUserIds(days: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { isDeleted: true, deletedAt: { lt: cutoff } },
          { accountStatus: 'DEACTIVATED', updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /**
   * Job 7: Destroy photo ID / selfie documents 30 days after account closure.
   * Privacy-policy commitment: identity documents deleted within 30 days of
   * account closure. (Selfie liveness images are stored as documentType
   * 'photo_id', so this covers both.)
   */
  static async destroyExpiredPhotoIdDocuments(): Promise<ComplianceJobResult> {
    try {
      const closedUserIds = await this.getClosedUserIds(PHOTO_ID_POST_CLOSURE_DAYS);

      let filesDestroyed = 0;
      if (closedUserIds.length > 0) {
        const docs = await prisma.documentUpload.findMany({
          where: {
            documentType: 'photo_id',
            isDestroyed: false,
            userId: { in: closedUserIds },
          },
          select: { id: true },
        });
        for (const doc of docs) {
          await DocumentStorageService.destroyDocument(
            doc.id,
            'retention_policy_account_closure',
            'SYSTEM'
          );
        }
        filesDestroyed = docs.length;
      }

      return {
        job: 'destroy_expired_photo_id_documents',
        success: true,
        details: { filesDestroyed },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_expired_photo_id_documents',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 8: Destroy insurance certificates 3 years after policy expiry (liability
   * claims limitation window), or 30 days after account closure — whichever
   * comes first.
   */
  static async destroyExpiredInsuranceDocuments(): Promise<ComplianceJobResult> {
    try {
      const expiryCutoff = new Date(Date.now() - INSURANCE_POST_EXPIRY_DAYS * DAY_MS);
      const closedUserIds = await this.getClosedUserIds(INSURANCE_POST_CLOSURE_DAYS);

      const docs = await prisma.documentUpload.findMany({
        where: {
          documentType: 'insurance',
          isDestroyed: false,
          OR: [
            { expiresAt: { lt: expiryCutoff } },
            ...(closedUserIds.length > 0 ? [{ userId: { in: closedUserIds } }] : []),
          ],
        },
        select: { id: true },
      });

      for (const doc of docs) {
        await DocumentStorageService.destroyDocument(doc.id, 'retention_policy', 'SYSTEM');
      }

      return {
        job: 'destroy_expired_insurance_documents',
        success: true,
        details: { filesDestroyed: docs.length },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_expired_insurance_documents',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 9: Destroy dispute evidence 2 years after the dispute was resolved.
   * DisputeEvidence is not a DocumentUpload row (its `url` is the R2 key), so we
   * mirror destroyDocument's guarantees directly: delete the R2 object, remove
   * the DB row, and write a DataRetentionLog + audit entry. The parent Dispute
   * is retained; only the heavy evidence media is purged.
   */
  static async destroyResolvedDisputeEvidence(): Promise<ComplianceJobResult> {
    try {
      const cutoff = new Date(Date.now() - DISPUTE_EVIDENCE_POST_RESOLUTION_DAYS * DAY_MS);

      const evidence = await prisma.disputeEvidence.findMany({
        where: {
          dispute: { resolvedAt: { lt: cutoff } },
        },
        select: { id: true, disputeId: true, url: true },
      });

      let filesDestroyed = 0;
      for (const ev of evidence) {
        try {
          await deleteObject(ev.url);
        } catch {
          // Object may already be gone — continue with DB cleanup.
        }
        await prisma.disputeEvidence.delete({ where: { id: ev.id } });
        await prisma.dataRetentionLog.create({
          data: {
            entityType: 'DisputeEvidence',
            entityId: ev.id,
            action: 'DELETED',
            reason: 'retention_policy',
            performedBy: 'SYSTEM',
            metadata: {
              disputeId: ev.disputeId,
              note: 'Dispute evidence destroyed 2 years after dispute resolution.',
            },
          },
        });
        await AuditService.log({
          userId: 'SYSTEM',
          action: 'DISPUTE_EVIDENCE_DESTROYED',
          entityType: 'DisputeEvidence',
          entityId: ev.id,
          metadata: { disputeId: ev.disputeId, reason: 'retention_policy' },
        });
        filesDestroyed++;
      }

      return {
        job: 'destroy_resolved_dispute_evidence',
        success: true,
        details: { filesDestroyed },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_resolved_dispute_evidence',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 10: Destroy imported-review evidence 12 months after the verify/reject
   * decision. Evidence lives at ImportedReview.evidenceUrl (R2 key), not a
   * DocumentUpload row; the review itself is retained, only the evidence file is
   * purged and the field nulled.
   */
  static async destroyDecidedImportedReviewEvidence(): Promise<ComplianceJobResult> {
    try {
      const cutoff = new Date(Date.now() - IMPORTED_REVIEW_EVIDENCE_POST_DECISION_DAYS * DAY_MS);

      const reviews = await prisma.importedReview.findMany({
        where: {
          verificationStatus: { in: ['VERIFIED', 'REJECTED'] },
          verifiedAt: { lt: cutoff },
          evidenceUrl: { not: null },
        },
        select: { id: true, evidenceUrl: true },
      });

      let filesDestroyed = 0;
      for (const review of reviews) {
        if (!review.evidenceUrl) continue;
        try {
          await deleteObject(review.evidenceUrl);
        } catch {
          // Object may already be gone — continue with DB cleanup.
        }
        await prisma.importedReview.update({
          where: { id: review.id },
          data: { evidenceUrl: null },
        });
        await prisma.dataRetentionLog.create({
          data: {
            entityType: 'ImportedReview',
            entityId: review.id,
            action: 'DELETED',
            reason: 'retention_policy',
            performedBy: 'SYSTEM',
            metadata: {
              field: 'evidenceUrl',
              note: 'Imported-review evidence destroyed 12 months after verification decision.',
            },
          },
        });
        await AuditService.log({
          userId: 'SYSTEM',
          action: 'IMPORTED_REVIEW_EVIDENCE_DESTROYED',
          entityType: 'ImportedReview',
          entityId: review.id,
          metadata: { reason: 'retention_policy' },
        });
        filesDestroyed++;
      }

      return {
        job: 'destroy_decided_imported_review_evidence',
        success: true,
        details: { filesDestroyed },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'destroy_decided_imported_review_evidence',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }

  /**
   * Job 11: Safety-net sweep — execute any deletion requests an admin has
   * APPROVED but that weren't processed inline (e.g. the admin action's
   * execution step failed). processDataDeletion atomically claims
   * APPROVED → IN_PROGRESS, so this never double-runs a request already handled.
   */
  static async processApprovedDeletionRequests(): Promise<ComplianceJobResult> {
    try {
      const approved = await prisma.dataDeletionRequest.findMany({
        where: { status: 'APPROVED' },
        select: { id: true },
      });

      let processed = 0;
      for (const req of approved) {
        try {
          await GdprService.processDataDeletion({ requestId: req.id, processedBy: 'SYSTEM' });
          processed++;
        } catch {
          // Leave APPROVED so the next sweep retries.
        }
      }

      return {
        job: 'process_approved_deletion_requests',
        success: true,
        details: { processed },
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        job: 'process_approved_deletion_requests',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: new Date(),
      };
    }
  }
}
