import type {
  ComplaintCategory,
  ComplaintSeverity,
  DisputeStatus,
  EvidenceType,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

interface FileComplaintInput {
  bookingId: string;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  subject: string;
  description: string;
}

interface ResolveComplaintInput {
  resolution: string;
  refundAmount?: number;
  isRedoClean?: boolean;
}

interface AddEvidenceInput {
  type: EvidenceType;
  url: string;
  fileName?: string;
  description?: string;
}

interface ComplaintFilters {
  status?: DisputeStatus;
  category?: ComplaintCategory;
  severity?: ComplaintSeverity;
}

// ─── Severity rules by category ─────────────────────────────

const SEVERITY_RULES: Record<ComplaintCategory, ComplaintSeverity> = {
  NO_SHOW: 'HIGH',
  POOR_QUALITY: 'MEDIUM',
  PROPERTY_DAMAGE: 'CRITICAL',
  INCORRECT_DURATION: 'LOW',
  SAFETY_CONCERN: 'CRITICAL',
  PAYMENT_ISSUE: 'HIGH',
  UNPROFESSIONAL: 'MEDIUM',
  OTHER: 'LOW',
};

const KEYWORD_ESCALATIONS: { pattern: RegExp; severity: ComplaintSeverity }[] = [
  { pattern: /\b(injur|hurt|danger|unsafe|hazard|emergency)\b/i, severity: 'CRITICAL' },
  { pattern: /\b(stole|stolen|theft|missing items)\b/i, severity: 'CRITICAL' },
  { pattern: /\b(broke|broken|smash|crack|destroy)\b/i, severity: 'HIGH' },
  { pattern: /\b(refund|overcharg|double.?charg)\b/i, severity: 'HIGH' },
];

// ─── Service ────────────────────────────────────────────────

export class ComplaintService {
  static async fileComplaint(filedById: string, input: FileComplaintInput) {
    return prisma.complaint.create({
      data: {
        filedById,
        bookingId: input.bookingId,
        category: input.category,
        severity: input.severity,
        subject: input.subject,
        description: input.description,
      },
      include: { booking: true, filedBy: true },
    });
  }

  static async getComplaint(complaintId: string) {
    return prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { booking: true, filedBy: true, evidence: true },
    });
  }

  static async getComplaintsByUser(userId: string) {
    return prisma.complaint.findMany({
      where: { filedById: userId },
      include: { booking: true, evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getComplaintsByBooking(bookingId: string) {
    return prisma.complaint.findMany({
      where: { bookingId },
      include: { filedBy: true, evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAllComplaints(filters: ComplaintFilters = {}) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.severity) where.severity = filters.severity;

    return prisma.complaint.findMany({
      where,
      include: { booking: true, filedBy: true, evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async resolveComplaint(complaintId: string, input: ResolveComplaintInput) {
    return prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'RESOLVED',
        resolution: input.resolution,
        refundAmount: input.refundAmount ?? undefined,
        isRedoClean: input.isRedoClean ?? false,
        resolvedAt: new Date(),
      },
      include: { booking: true, filedBy: true },
    });
  }

  static async dismissComplaint(complaintId: string, reason: string) {
    return prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'DISMISSED',
        resolution: reason,
        resolvedAt: new Date(),
      },
    });
  }

  static async addEvidence(complaintId: string, input: AddEvidenceInput) {
    return prisma.complaintEvidence.create({
      data: {
        complaintId,
        type: input.type,
        url: input.url,
        fileName: input.fileName,
        description: input.description,
      },
    });
  }

  static async getComplaintEvidence(complaintId: string) {
    return prisma.complaintEvidence.findMany({
      where: { complaintId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static autoCategorizeSeverity(
    category: ComplaintCategory,
    description: string
  ): ComplaintSeverity {
    let severity = SEVERITY_RULES[category] ?? 'MEDIUM';

    const severityRank: Record<ComplaintSeverity, number> = {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };

    for (const rule of KEYWORD_ESCALATIONS) {
      if (rule.pattern.test(description) && severityRank[rule.severity] > severityRank[severity]) {
        severity = rule.severity;
      }
    }

    return severity;
  }
}
