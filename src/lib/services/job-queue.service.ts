import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export type JobType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'PROCESS_PAYMENT'
  | 'SEND_REMINDER'
  | 'REQUEST_REVIEW'
  | 'SYNC_ANALYTICS';

interface EnqueueOptions {
  scheduledAt?: Date;
  maxAttempts?: number;
}

export class JobQueueService {
  static async enqueue(type: JobType, payload: Record<string, unknown>, options?: EnqueueOptions) {
    return prisma.backgroundJob.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        scheduledAt: options?.scheduledAt ?? new Date(),
        maxAttempts: options?.maxAttempts ?? 3,
      },
    });
  }

  static async dequeue(batchSize: number = 10) {
    const now = new Date();
    return prisma.backgroundJob.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
        attempts: { lt: (prisma.backgroundJob.fields?.maxAttempts as unknown as number) ?? 3 },
      },
      orderBy: { scheduledAt: 'asc' },
      take: batchSize,
    });
  }

  static async markProcessing(id: string) {
    return prisma.backgroundJob.update({
      where: { id },
      data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  static async markCompleted(id: string) {
    return prisma.backgroundJob.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  static async markFailed(id: string, error: string) {
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    const newStatus = job && job.attempts >= job.maxAttempts ? 'FAILED' : 'PENDING';

    return prisma.backgroundJob.update({
      where: { id },
      data: { status: newStatus, lastError: error },
    });
  }

  static async getStats() {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: 'PENDING' } }),
      prisma.backgroundJob.count({ where: { status: 'PROCESSING' } }),
      prisma.backgroundJob.count({ where: { status: 'COMPLETED' } }),
      prisma.backgroundJob.count({ where: { status: 'FAILED' } }),
    ]);
    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
    };
  }

  static async cleanup(olderThanDays: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    return prisma.backgroundJob.deleteMany({
      where: { status: { in: ['COMPLETED', 'FAILED'] }, completedAt: { lt: cutoff } },
    });
  }
}
