import { prisma } from '@/lib/db/prisma';

export interface PerformanceTrend {
  period: string;
  earnings: number;
  jobCount: number;
  averageRating: number;
  cancellations: number;
}

export interface CleanerAnalytics {
  totalEarnings: number;
  totalJobsCompleted: number;
  averageRating: number;
  totalReviews: number;
  cancellationRate: number;
  averageJobDuration: number;
  mostPopularService: string;
  peakDay: string;
  trends: PerformanceTrend[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class CleanerAnalyticsService {
  /**
   * Get comprehensive analytics for a cleaner
   */
  static async getAnalytics(userId: string, months: number = 6): Promise<CleanerAnalytics> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const [completedBookings, cancelledCount, reviews] = await Promise.all([
      prisma.booking.findMany({
        where: { cleanerId: userId, status: 'COMPLETED', date: { gte: startDate } },
        orderBy: { date: 'asc' },
      }),
      prisma.booking.count({
        where: { cleanerId: userId, status: 'CANCELLED', date: { gte: startDate } },
      }),
      prisma.review.aggregate({
        where: { cleanerId: userId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const totalEarnings = completedBookings.reduce((sum, b) => sum + Number(b.cleanerEarnings), 0);
    const totalJobs = completedBookings.length;
    const totalWithCancelled = totalJobs + cancelledCount;
    const avgDuration =
      totalJobs > 0
        ? completedBookings.reduce((sum, b) => sum + Number(b.duration), 0) / totalJobs
        : 0;

    // Most popular service
    const serviceCounts: Record<string, number> = {};
    for (const b of completedBookings) {
      serviceCounts[b.serviceType] = (serviceCounts[b.serviceType] ?? 0) + 1;
    }
    const mostPopularService =
      Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    // Peak day
    const dayCounts: Record<number, number> = {};
    for (const b of completedBookings) {
      const day = new Date(b.date).getDay();
      dayCounts[day] = (dayCounts[day] ?? 0) + 1;
    }
    const peakDayNum = Number(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1);

    // Monthly trends
    const trends = this.calculateMonthlyTrends(completedBookings, months);

    return {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalJobsCompleted: totalJobs,
      averageRating: Number(reviews._avg.rating ?? 0),
      totalReviews: reviews._count,
      cancellationRate:
        totalWithCancelled > 0
          ? Math.round((cancelledCount / totalWithCancelled) * 10000) / 100
          : 0,
      averageJobDuration: Math.round(avgDuration * 10) / 10,
      mostPopularService,
      peakDay: DAY_NAMES[peakDayNum],
      trends,
    };
  }

  private static calculateMonthlyTrends(
    bookings: Array<{
      date: Date;
      cleanerEarnings: unknown;
      duration: unknown;
      serviceType: string;
    }>,
    months: number
  ): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const label = monthStart.toLocaleString('en-GB', { month: 'short', year: 'numeric' });

      const monthBookings = bookings.filter((b) => {
        const d = new Date(b.date);
        return d >= monthStart && d <= monthEnd;
      });

      trends.push({
        period: label,
        earnings:
          Math.round(monthBookings.reduce((s, b) => s + Number(b.cleanerEarnings), 0) * 100) / 100,
        jobCount: monthBookings.length,
        averageRating: 0, // Would need per-month review aggregation
        cancellations: 0,
      });
    }

    return trends;
  }
}
