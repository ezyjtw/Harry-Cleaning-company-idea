import type { Prisma, VerificationStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export class CleanerRepository {
  static async findByUserId(userId: string) {
    return prisma.cleanerProfile.findUnique({
      where: { userId },
      include: { user: true, availabilitySlots: true },
    });
  }

  static async findAvailable(options: {
    date?: Date;
    postcode?: string;
    serviceType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 10;
    const where: Prisma.CleanerProfileWhereInput = {
      verified: true,
      user: { isDeleted: false, accountStatus: 'ACTIVE' },
    };

    const [data, total] = await Promise.all([
      prisma.cleanerProfile.findMany({
        where,
        include: { user: true, availabilitySlots: true },
        orderBy: { rating: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cleanerProfile.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async updateProfile(userId: string, data: Prisma.CleanerProfileUpdateInput) {
    return prisma.cleanerProfile.update({ where: { userId }, data });
  }

  static async updateVerification(userId: string, status: VerificationStatus) {
    return prisma.cleanerProfile.update({
      where: { userId },
      data: {
        verificationStatus: status,
        identityVerifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });
  }

  static async getTopRated(limit: number = 10) {
    return prisma.cleanerProfile.findMany({
      where: { verified: true, user: { isDeleted: false } },
      include: { user: true },
      orderBy: { rating: 'desc' },
      take: limit,
    });
  }

  static async findByServiceArea(postcode: string) {
    // Match by location field containing the postcode prefix
    const prefix = postcode.split(' ')[0];
    return prisma.cleanerProfile.findMany({
      where: {
        verified: true,
        location: { contains: prefix },
        user: { isDeleted: false, accountStatus: 'ACTIVE' },
      },
      include: { user: true },
    });
  }
}
