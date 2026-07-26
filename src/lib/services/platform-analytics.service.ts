import { prisma } from '@/lib/db/prisma';

export interface PlatformOverview {
  bookings: { total: number; thisMonth: number; change: number };
  revenue: { total: number; thisMonth: number; change: number };
  cleaners: { total: number; active: number; new: number };
  customers: { total: number; active: number; new: number };
  disputes: { open: number; resolved: number; rate: number };
}

export interface RevenueData {
  period: string;
  revenue: number;
  bookings: number;
  platformFees: number;
}

export class PlatformAnalyticsService {
  /**
   * Get platform overview dashboard stats
   */
  static async getOverview(): Promise<PlatformOverview> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalBookings,
      thisMonthBookings,
      lastMonthBookings,
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      totalCleaners,
      activeCleaners,
      newCleaners,
      totalCustomers,
      activeCustomers,
      newCustomers,
      openDisputes,
      resolvedDisputes,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { createdAt: { gte: thisMonthStart } } }),
      prisma.booking.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amount: true },
      }),
      // B1.1: cleaner counts are profile-based — a CleanerProfile row only exists
      // once signup completes, so step-0 accounts never inflate these numbers.
      prisma.cleanerProfile.count({ where: { user: { isDeleted: false } } }),
      prisma.cleanerProfile.count({
        where: { user: { isDeleted: false, accountStatus: 'ACTIVE' } },
      }),
      prisma.cleanerProfile.count({ where: { createdAt: { gte: thisMonthStart } } }),
      prisma.user.count({ where: { role: 'CLIENT', isDeleted: false } }),
      prisma.user.count({ where: { role: 'CLIENT', isDeleted: false, accountStatus: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: thisMonthStart } } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.dispute.count({ where: { status: 'RESOLVED' } }),
    ]);

    const bookingsChange =
      lastMonthBookings > 0
        ? Math.round(((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 10000) / 100
        : 0;

    const thisMonthRev = Number(thisMonthRevenue._sum.amount ?? 0);
    const lastMonthRev = Number(lastMonthRevenue._sum.amount ?? 0);
    const revenueChange =
      lastMonthRev > 0
        ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 10000) / 100
        : 0;

    const disputeRate =
      totalBookings > 0
        ? Math.round(((openDisputes + resolvedDisputes) / totalBookings) * 10000) / 100
        : 0;

    return {
      bookings: { total: totalBookings, thisMonth: thisMonthBookings, change: bookingsChange },
      revenue: {
        total: Number(totalRevenue._sum.amount ?? 0),
        thisMonth: thisMonthRev,
        change: revenueChange,
      },
      cleaners: { total: totalCleaners, active: activeCleaners, new: newCleaners },
      customers: { total: totalCustomers, active: activeCustomers, new: newCustomers },
      disputes: { open: openDisputes, resolved: resolvedDisputes, rate: disputeRate },
    };
  }

  /**
   * Get revenue trends over time
   */
  static async getRevenueTrends(months: number = 12): Promise<RevenueData[]> {
    const trends: RevenueData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const label = monthStart.toLocaleString('en-GB', { month: 'short', year: 'numeric' });

      const [revenue, bookingCount] = await Promise.all([
        prisma.payment.aggregate({
          where: { status: 'SUCCEEDED', createdAt: { gte: monthStart, lte: monthEnd } },
          _sum: { amount: true },
        }),
        prisma.booking.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd } },
        }),
      ]);

      const totalRevenue = Number(revenue._sum.amount ?? 0);

      trends.push({
        period: label,
        revenue: Math.round(totalRevenue * 100) / 100,
        bookings: bookingCount,
        platformFees: Math.round(totalRevenue * 0.1 * 100) / 100, // 10% platform fee
      });
    }

    return trends;
  }

  /**
   * Get cleaner utilization metrics
   */
  static async getCleanerUtilization() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const cleaners = await prisma.cleanerProfile.findMany({
      where: { verified: true, user: { isDeleted: false, accountStatus: 'ACTIVE' } },
      include: {
        user: { select: { name: true } },
      },
    });

    const utilization = await Promise.all(
      cleaners.map(async (cleaner) => {
        const bookingCount = await prisma.booking.count({
          where: {
            cleanerId: cleaner.userId,
            date: { gte: monthStart },
            status: { notIn: ['CANCELLED'] },
          },
        });

        // Assume max 4 bookings per day, 22 working days
        const maxCapacity = 88;
        const utilizationRate = Math.round((bookingCount / maxCapacity) * 10000) / 100;

        return {
          cleanerId: cleaner.userId,
          name: cleaner.user.name ?? 'Unknown',
          tier: cleaner.tier,
          bookingsThisMonth: bookingCount,
          utilizationRate,
          rating: Number(cleaner.rating),
        };
      })
    );

    return utilization.sort((a, b) => b.utilizationRate - a.utilizationRate);
  }

  /**
   * Get customer retention metrics
   */
  static async getCustomerRetention() {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const [totalCustomers, returningCustomers, oneTimeCustomers] = await Promise.all([
      prisma.user.count({ where: { role: 'CLIENT', isDeleted: false } }),
      prisma.booking.groupBy({
        by: ['clientId'],
        having: { clientId: { _count: { gt: 1 } } },
      }),
      prisma.booking.groupBy({
        by: ['clientId'],
        having: { clientId: { _count: { equals: 1 } } },
      }),
    ]);

    return {
      totalCustomers,
      returningCustomers: returningCustomers.length,
      oneTimeCustomers: oneTimeCustomers.length,
      retentionRate:
        totalCustomers > 0
          ? Math.round((returningCustomers.length / totalCustomers) * 10000) / 100
          : 0,
    };
  }
}
