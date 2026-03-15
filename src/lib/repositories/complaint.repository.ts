import type { ComplaintCategory, ComplaintSeverity, DisputeStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export class ComplaintRepository {
  static async create(data: {
    bookingId: string;
    filedById: string;
    category: ComplaintCategory;
    severity: ComplaintSeverity;
    subject: string;
    description: string;
  }) {
    return prisma.complaint.create({
      data,
      include: { booking: true, filedBy: true, evidence: true },
    });
  }

  static async findById(id: string) {
    return prisma.complaint.findUnique({
      where: { id },
      include: { booking: true, filedBy: true, evidence: true },
    });
  }

  static async findByUser(userId: string) {
    return prisma.complaint.findMany({
      where: { filedById: userId },
      include: { booking: true, evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findAll(filters?: {
    status?: DisputeStatus;
    category?: ComplaintCategory;
    severity?: ComplaintSeverity;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const where: Prisma.ComplaintWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.severity) where.severity = filters.severity;

    const [data, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: { booking: true, filedBy: true, evidence: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.complaint.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async resolve(
    id: string,
    resolution: string,
    refundAmount?: number,
    isRedoClean?: boolean
  ) {
    return prisma.complaint.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        refundAmount,
        isRedoClean: isRedoClean ?? false,
        resolvedAt: new Date(),
      },
    });
  }

  static async dismiss(id: string, reason: string) {
    return prisma.complaint.update({
      where: { id },
      data: { status: 'DISMISSED', resolution: reason, resolvedAt: new Date() },
    });
  }

  static async addEvidence(
    complaintId: string,
    data: {
      type: 'PHOTO' | 'VIDEO' | 'TEXT' | 'DOCUMENT';
      url: string;
      fileName?: string;
      description?: string;
    }
  ) {
    return prisma.complaintEvidence.create({
      data: { complaintId, ...data },
    });
  }
}
