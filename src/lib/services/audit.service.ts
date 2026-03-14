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
  | 'AI_AGENT_ACTION'
  | 'SETTINGS_UPDATED';

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
