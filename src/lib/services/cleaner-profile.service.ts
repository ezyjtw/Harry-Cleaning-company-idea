import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export interface CleanerProfileUpdateInput {
  bio?: string;
  hourlyRateRegular?: number;
  specialties?: string[];
  location?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius?: number;
  availableNow?: boolean;
}

export interface CleanerStats {
  totalEarnings: number;
  totalJobs: number;
  averageRating: number;
  reviewCount: number;
  completionRate: number;
  cancellationRate: number;
  responseTime: number | null;
  currentTier: string;
  nextTierRequirement: string | null;
}

export class CleanerProfileService {
  /**
   * Get comprehensive cleaner statistics
   */
  static async getStats(userId: string): Promise<CleanerStats | null> {
    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId },
    });
    if (!profile) return null;

    const [completedBookings, cancelledBookings, reviews, earningsResult] = await Promise.all([
      prisma.booking.count({ where: { cleanerId: userId, status: 'COMPLETED' } }),
      prisma.booking.count({ where: { cleanerId: userId, status: 'CANCELLED' } }),
      prisma.review.aggregate({
        where: { cleanerId: userId, visibility: 'VISIBLE' },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: { cleanerId: userId, status: 'COMPLETED' },
        _sum: { cleanerEarnings: true },
      }),
    ]);

    const totalJobs = completedBookings + cancelledBookings;
    const completionRate = totalJobs > 0 ? (completedBookings / totalJobs) * 100 : 100;
    const cancellationRate = totalJobs > 0 ? (cancelledBookings / totalJobs) * 100 : 0;

    const tierThresholds = {
      STARTER: { jobs: 0, label: 'Complete 10 jobs to reach Bronze' },
      BRONZE: { jobs: 10, label: 'Complete 25 jobs to reach Silver' },
      SILVER: { jobs: 25, label: 'Complete 50 jobs with 4.5+ rating to reach Gold' },
      GOLD: { jobs: 50, label: 'Complete 100 jobs with 4.7+ rating to reach Elite' },
      ELITE: { jobs: 100, label: null },
    };

    const tierInfo =
      tierThresholds[profile.tier as keyof typeof tierThresholds] ?? tierThresholds.STARTER;

    return {
      totalEarnings: Number(earningsResult._sum.cleanerEarnings ?? 0),
      totalJobs: completedBookings,
      averageRating: Number(reviews._avg.rating ?? 0),
      reviewCount: reviews._count,
      completionRate: Math.round(completionRate * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      responseTime: profile.responseTime ?? profile.responseSpeed,
      currentTier: profile.tier,
      nextTierRequirement: tierInfo.label,
    };
  }

  /**
   * Update cleaner profile
   */
  static async updateProfile(userId: string, data: CleanerProfileUpdateInput) {
    return prisma.cleanerProfile.update({
      where: { userId },
      data: {
        bio: data.bio,
        hourlyRateRegular: data.hourlyRateRegular,
        specialties: data.specialties,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        serviceRadius: data.serviceRadius,
        availableNow: data.availableNow,
      },
    });
  }

  /**
   * Get earnings breakdown by period
   */
  static async getEarningsBreakdown(userId: string, period: 'week' | 'month' | 'year') {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const bookings = await prisma.booking.findMany({
      where: {
        cleanerId: userId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });

    const totalEarnings = bookings.reduce((sum, b) => sum + Number(b.cleanerEarnings), 0);
    const totalPlatformFees = bookings.reduce((sum, b) => sum + Number(b.platformFee), 0);

    // Group by service type
    const byServiceType = new Map<string, { count: number; amount: number }>();
    for (const booking of bookings) {
      const existing = byServiceType.get(booking.serviceType) ?? { count: 0, amount: 0 };
      existing.count++;
      existing.amount += Number(booking.cleanerEarnings);
      byServiceType.set(booking.serviceType, existing);
    }

    return {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
      netEarnings: Math.round(totalEarnings * 100) / 100,
      jobCount: bookings.length,
      period,
      byServiceType: Array.from(byServiceType.entries()).map(([type, data]) => ({
        serviceType: type,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100,
      })),
    };
  }

  /**
   * Auto-calculate and update cleaner tier based on performance
   */
  static async recalculateTier(userId: string): Promise<string> {
    const profile = await prisma.cleanerProfile.findUnique({ where: { userId } });
    if (!profile) return 'STARTER';

    const stats = await this.getStats(userId);
    if (!stats) return 'STARTER';

    let newTier = 'STARTER';
    if (stats.totalJobs >= 100 && stats.averageRating >= 4.7) {
      newTier = 'ELITE';
    } else if (stats.totalJobs >= 50 && stats.averageRating >= 4.5) {
      newTier = 'GOLD';
    } else if (stats.totalJobs >= 25 && stats.averageRating >= 4.0) {
      newTier = 'SILVER';
    } else if (stats.totalJobs >= 10) {
      newTier = 'BRONZE';
    }

    if (newTier !== profile.tier) {
      await prisma.cleanerProfile.update({
        where: { userId },
        data: { tier: newTier as Prisma.EnumCleanerTierFieldUpdateOperationsInput['set'] },
      });
    }

    return newTier;
  }
}
