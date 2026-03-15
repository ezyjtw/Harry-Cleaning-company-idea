import type { CompanyVerificationStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export class CompanyRepository {
  static async findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      include: { owner: true, team: { include: { user: true } }, provider: true },
    });
  }

  static async findByOwnerId(ownerId: string) {
    return prisma.company.findUnique({
      where: { ownerId },
      include: { team: { include: { user: true } }, provider: true },
    });
  }

  static async create(data: Prisma.CompanyCreateInput) {
    return prisma.company.create({ data, include: { owner: true } });
  }

  static async update(id: string, data: Prisma.CompanyUpdateInput) {
    return prisma.company.update({ where: { id }, data });
  }

  static async updateVerification(id: string, status: CompanyVerificationStatus) {
    return prisma.company.update({ where: { id }, data: { verificationStatus: status } });
  }

  static async findAll(options?: {
    status?: CompanyVerificationStatus;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Prisma.CompanyWhereInput = {};
    if (options?.status) where.verificationStatus = options.status;
    if (options?.isActive !== undefined) where.isActive = options.isActive;

    const [data, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: { owner: true, _count: { select: { team: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.company.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getTeamMembers(companyId: string) {
    return prisma.teamMember.findMany({
      where: { companyId },
      include: { user: { include: { cleanerProfile: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  static async addTeamMember(
    companyId: string,
    userId: string,
    role: 'OWNER' | 'MANAGER' | 'CLEANER'
  ) {
    return prisma.teamMember.create({
      data: { companyId, userId, role },
      include: { user: true },
    });
  }

  static async removeTeamMember(companyId: string, userId: string) {
    return prisma.teamMember.delete({
      where: { companyId_userId: { companyId, userId } },
    });
  }

  static async getCompanyBookings(
    companyId: string,
    options?: {
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });
    if (!company?.provider) return { data: [], total: 0, page, pageSize, totalPages: 0 };

    const where: Prisma.BookingWhereInput = { providerId: company.provider.id };
    if (options?.status) where.status = options.status as Prisma.EnumBookingStatusFilter;

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { client: true, cleaner: true, address: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
