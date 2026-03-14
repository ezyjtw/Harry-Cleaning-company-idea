import type { Prisma, BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export class BookingRepository {
  static async findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: { client: true, cleaner: true, address: true, review: true, payment: true },
    });
  }

  static async findByClientId(
    clientId: string,
    options?: { status?: BookingStatus; page?: number; pageSize?: number }
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    const where: Prisma.BookingWhereInput = { clientId };
    if (options?.status) where.status = options.status;

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { cleaner: true, address: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async findByCleanerId(
    cleanerId: string,
    options?: { status?: BookingStatus; dateFrom?: Date; dateTo?: Date }
  ) {
    const where: Prisma.BookingWhereInput = { cleanerId };
    if (options?.status) where.status = options.status;
    if (options?.dateFrom || options?.dateTo) {
      where.date = {};
      if (options?.dateFrom) where.date.gte = options.dateFrom;
      if (options?.dateTo) where.date.lte = options.dateTo;
    }

    return prisma.booking.findMany({
      where,
      include: { client: true, address: true },
      orderBy: { date: 'asc' },
    });
  }

  static async create(data: Prisma.BookingCreateInput) {
    return prisma.booking.create({ data, include: { client: true, cleaner: true, address: true } });
  }

  static async updateStatus(id: string, status: BookingStatus, timestamps?: Record<string, Date>) {
    return prisma.booking.update({
      where: { id },
      data: { status, ...timestamps },
    });
  }

  static async findConflicting(
    cleanerId: string,
    date: Date,
    _startTime: string,
    _duration: number
  ) {
    return prisma.booking.findMany({
      where: {
        cleanerId,
        date,
        status: { notIn: ['CANCELLED'] },
      },
    });
  }

  static async countByStatus(status?: BookingStatus) {
    return prisma.booking.count({ where: status ? { status } : undefined });
  }
}
