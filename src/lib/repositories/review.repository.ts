import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export class ReviewRepository {
  static async findByCleanerId(cleanerId: string, options?: { page?: number; pageSize?: number }) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    const where: Prisma.ReviewWhereInput = { cleanerId, visibility: 'VISIBLE' };

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { client: true, booking: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async create(data: Prisma.ReviewCreateInput) {
    return prisma.review.create({ data });
  }

  static async getAverageRating(cleanerId: string) {
    const result = await prisma.review.aggregate({
      where: { cleanerId, visibility: 'VISIBLE' },
      _avg: { rating: true, thoroughness: true, punctuality: true, communication: true },
      _count: true,
    });
    return {
      average: result._avg.rating ? Number(result._avg.rating) : 0,
      thoroughness: result._avg.thoroughness ? Number(result._avg.thoroughness) : 0,
      punctuality: result._avg.punctuality ? Number(result._avg.punctuality) : 0,
      communication: result._avg.communication ? Number(result._avg.communication) : 0,
      count: result._count,
    };
  }

  static async moderate(reviewId: string, visibility: 'VISIBLE' | 'HIDDEN' | 'FLAGGED') {
    return prisma.review.update({
      where: { id: reviewId },
      data: { visibility, isModerated: true },
    });
  }
}
