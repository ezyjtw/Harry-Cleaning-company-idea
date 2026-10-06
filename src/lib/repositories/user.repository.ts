import type { Prisma, Role, AccountStatus } from '@prisma/client';

import { revokeAllSessions } from '@/lib/auth/device-session';
import { prisma } from '@/lib/db/prisma';

export class UserRepository {
  static async findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { cleanerProfile: true } });
  }

  static async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, include: { cleanerProfile: true } });
  }

  static async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  static async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  }

  static async updateLoginAttempt(id: string, success: boolean) {
    if (success) {
      return prisma.user.update({
        where: { id },
        data: { lastLoginAt: new Date(), failedLoginCount: 0 },
      });
    }
    return prisma.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
    });
  }

  static async softDelete(id: string) {
    const updated = await prisma.user.update({
      where: { id },
      data: { isDeleted: true, accountStatus: 'DEACTIVATED' },
    });
    // D-g: deletion revokes every session row and bumps the version.
    await revokeAllSessions(id, 'deletion');
    return updated;
  }

  static async findPaginated(options: {
    role?: Role;
    status?: AccountStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 10;
    const where: Prisma.UserWhereInput = { isDeleted: false };
    if (options.role) where.role = options.role;
    if (options.status) where.accountStatus = options.status;
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
