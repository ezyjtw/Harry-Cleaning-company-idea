import { prisma } from '@/lib/db/prisma';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_REGISTERED'
  | 'USER_SUSPENDED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_COMPLETED'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_REFUNDED'
  | 'REVIEW_CREATED'
  | 'REVIEW_MODERATED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'ADMIN_ACTION'
  | 'ADMIN_SUSPEND_USER'
  | 'ADMIN_REACTIVATE_USER'
  | 'ADMIN_ASSIGN_CLEANER'
  | 'ADMIN_REASSIGN_BOOKING'
  | 'ADMIN_CANCEL_BOOKING'
  | 'ADMIN_ISSUE_REFUND'
  | 'ADMIN_MODERATE_REVIEW'
  | 'ADMIN_RESOLVE_DISPUTE'
  | 'CLEANER_PROFILE_UPDATED'
  | 'AI_AGENT_ACTION'
  | 'SETTINGS_UPDATED'
  // DBS-specific actions
  | 'DBS_CERT_UPLOADED'
  | 'DBS_CERT_VERIFIED'
  | 'DBS_CERT_REJECTED'
  | 'DBS_CERT_DESTROYED'
  | 'DBS_CERT_VIEWED'
  | 'DBS_VERIFICATION_ATTEMPTED'
  | 'DBS_APPLICATION_INITIATED'
  // Identity verification actions
  | 'IDENTITY_CHECK_SUBMITTED'
  | 'IDENTITY_CHECK_PASSED'
  | 'IDENTITY_CHECK_FAILED'
  // Right to Work actions
  | 'RTW_DOC_UPLOADED'
  | 'RTW_DOC_VERIFIED'
  | 'RTW_DOC_REJECTED'
  | 'RTW_DOC_DESTROYED'
  | 'RTW_DOC_VIEWED'
  | 'RTW_SHARE_CODE_CHECKED'
  | 'RTW_EXPIRY_ALERT_SENT'
  // Document actions
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_DESTROYED'
  | 'DOCUMENT_ENCRYPTED'
  | 'DOCUMENT_VIEWED'
  // Selfie actions
  | 'SELFIE_UPLOADED'
  // Cleaner verification actions
  | 'CLEANER_VERIFIED'
  | 'CLEANER_REJECTED'
  // Compliance actions
  | 'DATA_BREACH_DETECTED'
  | 'DATA_BREACH_REPORTED_ICO'
  | 'DATA_BREACH_RESOLVED'
  | 'DPA_AGREEMENT_CREATED'
  | 'DPA_AGREEMENT_UPDATED'
  | 'COMPLIANCE_JOB_RUN'
  // Pricing security actions
  | 'PRICE_DISCREPANCY_DETECTED'
  | 'PRICE_TAMPERING_SUSPECTED'
  // Price reconciliation (A5.3)
  | 'TOPUP_SUCCEEDED'
  // Stuck-money recovery
  | 'ADMIN_RETRY_STUCK_REFUND'
  // Admin testing tools (Stage 2)
  | 'ADMIN_STATUS_OVERRIDE'
  | 'ADMIN_FORCE_CASCADE'
  | 'ADMIN_DELETE_BOOKING'
  | 'PHASE2_ENTERED'
  | 'PHASE2_RESERVE_PROMOTED'
  | 'PHASE2_EXHAUSTED';

interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(params: AuditLogParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: (params.metadata as Record<string, string>) ?? undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      // eslint-disable-next-line no-console
      console.error('[AuditService] Failed to create audit log:', error);
      return null;
    }
  }

  static async getByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getByUser(userId: string, options?: { page?: number; pageSize?: number }) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  static async getRecent(limit: number = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
