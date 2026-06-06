import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface RevenueTrend {
  period: string; // "2026-01", "2026-02", etc.
  revenue: number;
  bookings: number;
  platformFees: number;
  cleanerEarnings: number;
}

export interface ServiceBreakdown {
  serviceType: string;
  bookings: number;
  revenue: number;
  avgValue: number;
  percentage: number;
}

export interface TeamMemberPerformance {
  userId: string;
  name: string;
  completedJobs: number;
  totalRevenue: number;
  avgRating: number;
  avgJobDuration: number;
  cancellationRate: number;
  ratingBreakdown: {
    thoroughness: number;
    punctuality: number;
    communication: number;
  };
}

export interface CustomerMetrics {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  avgBookingsPerCustomer: number;
  avgSpendPerCustomer: number;
  avgSpendPerBooking: number;
  topCustomers: { name: string; bookings: number; totalSpent: number }[];
}

export interface OperationalMetrics {
  avgResponseTimeMinutes: number;
  avgCompletionTimeHours: number;
  onTimeRate: number;
  completionRate: number;
  cancellationRate: number;
  cancellationReasons: { reason: string; count: number }[];
  bookingsByDayOfWeek: { day: string; count: number }[];
  peakHours: { hour: string; count: number }[];
}

export interface QualityMetrics {
  avgRating: number;
  totalReviews: number;
  ratingDistribution: { stars: number; count: number }[];
  avgThoroughness: number;
  avgPunctuality: number;
  avgCommunication: number;
  complaintsTotal: number;
  complaintsByCategory: { category: string; count: number }[];
  disputeRate: number;
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalPlatformFees: number;
  totalCleanerEarnings: number;
  platformMarginPercent: number;
  avgBookingValue: number;
  refundTotal: number;
  refundRate: number;
  revenuePerTeamMember: number;
  addonRevenue: number;
  addonAttachmentRate: number;
}

export interface CompanyAnalyticsFull {
  revenueTrends: RevenueTrend[];
  serviceBreakdown: ServiceBreakdown[];
  teamPerformance: TeamMemberPerformance[];
  customerMetrics: CustomerMetrics;
  operationalMetrics: OperationalMetrics;
  qualityMetrics: QualityMetrics;
  financialMetrics: FinancialMetrics;
}

// ─── Helpers ──────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getProviderId(company: { provider: { id: string } | null }) {
  if (!company?.provider) throw new Error('Company has no provider');
  return company.provider.id;
}

// ─── Service ──────────────────────────────────────────────────

export class CompanyAnalyticsService {
  static async getFullAnalytics(
    companyId: string,
    months: number = 6
  ): Promise<CompanyAnalyticsFull> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (!company?.provider) {
      throw new Error(`Company ${companyId} not found or has no provider`);
    }

    const providerId = getProviderId(company);
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const [
      revenueTrends,
      serviceBreakdown,
      teamPerformance,
      customerMetrics,
      operationalMetrics,
      qualityMetrics,
      financialMetrics,
    ] = await Promise.all([
      this.getRevenueTrends(providerId, periodStart, months),
      this.getServiceBreakdown(providerId),
      this.getTeamPerformance(companyId, providerId),
      this.getCustomerMetrics(providerId),
      this.getOperationalMetrics(providerId),
      this.getQualityMetrics(providerId),
      this.getFinancialMetrics(companyId, providerId),
    ]);

    return {
      revenueTrends,
      serviceBreakdown,
      teamPerformance,
      customerMetrics,
      operationalMetrics,
      qualityMetrics,
      financialMetrics,
    };
  }

  // ─── Revenue Trends (monthly) ──────────────────────────────

  private static async getRevenueTrends(
    providerId: string,
    periodStart: Date,
    months: number
  ): Promise<RevenueTrend[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        status: { in: ['COMPLETED', 'REVIEWED'] },
        completedAt: { gte: periodStart },
      },
      select: {
        completedAt: true,
        totalPrice: true,
        platformFee: true,
        cleanerEarnings: true,
      },
    });

    const buckets: Record<string, RevenueTrend> = {};
    const now = new Date();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = { period: key, revenue: 0, bookings: 0, platformFees: 0, cleanerEarnings: 0 };
    }

    for (const b of bookings) {
      if (!b.completedAt) continue;
      const key = `${b.completedAt.getFullYear()}-${String(b.completedAt.getMonth() + 1).padStart(2, '0')}`;
      if (buckets[key]) {
        buckets[key].revenue += Number(b.totalPrice);
        buckets[key].bookings++;
        buckets[key].platformFees += Number(b.platformFee);
        buckets[key].cleanerEarnings += Number(b.cleanerEarnings);
      }
    }

    return Object.values(buckets).map((b) => ({
      ...b,
      revenue: Math.round(b.revenue * 100) / 100,
      platformFees: Math.round(b.platformFees * 100) / 100,
      cleanerEarnings: Math.round(b.cleanerEarnings * 100) / 100,
    }));
  }

  // ─── Service Breakdown ──────────────────────────────────

  private static async getServiceBreakdown(providerId: string): Promise<ServiceBreakdown[]> {
    const bookings = await prisma.booking.findMany({
      where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] } },
      select: { serviceType: true, totalPrice: true },
    });

    const byService: Record<string, { bookings: number; revenue: number }> = {};
    for (const b of bookings) {
      if (!byService[b.serviceType]) byService[b.serviceType] = { bookings: 0, revenue: 0 };
      byService[b.serviceType].bookings++;
      byService[b.serviceType].revenue += Number(b.totalPrice);
    }

    const totalRevenue = Object.values(byService).reduce((sum, s) => sum + s.revenue, 0);

    return Object.entries(byService)
      .map(([serviceType, data]) => ({
        serviceType,
        bookings: data.bookings,
        revenue: Math.round(data.revenue * 100) / 100,
        avgValue: data.bookings > 0 ? Math.round((data.revenue / data.bookings) * 100) / 100 : 0,
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // ─── Team Performance ──────────────────────────────────

  private static async getTeamPerformance(
    companyId: string,
    providerId: string
  ): Promise<TeamMemberPerformance[]> {
    const teamMembers = await prisma.teamMember.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true } } },
    });

    return Promise.all(
      teamMembers.map(async (tm) => {
        const [completed, cancelled, _total, revenueAgg, durationAgg, reviewAgg] =
          await Promise.all([
            prisma.booking.count({
              where: {
                cleanerId: tm.userId,
                providerId,
                status: { in: ['COMPLETED', 'REVIEWED'] },
              },
            }),
            prisma.booking.count({
              where: { cleanerId: tm.userId, providerId, status: 'CANCELLED' },
            }),
            prisma.booking.count({
              where: { cleanerId: tm.userId, providerId },
            }),
            prisma.booking.aggregate({
              where: {
                cleanerId: tm.userId,
                providerId,
                status: { in: ['COMPLETED', 'REVIEWED'] },
              },
              _sum: { totalPrice: true },
            }),
            prisma.booking.aggregate({
              where: {
                cleanerId: tm.userId,
                providerId,
                status: { in: ['COMPLETED', 'REVIEWED'] },
              },
              _avg: { duration: true },
            }),
            prisma.review.aggregate({
              where: { cleanerId: tm.userId, booking: { providerId } },
              _avg: { rating: true, thoroughness: true, punctuality: true, communication: true },
            }),
          ]);

        const finishedCount = completed + cancelled;

        return {
          userId: tm.userId,
          name: tm.user.name || 'Unknown',
          completedJobs: completed,
          totalRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
          avgRating: Number(reviewAgg._avg.rating ?? 0),
          avgJobDuration: Number(durationAgg._avg.duration ?? 0),
          cancellationRate:
            finishedCount > 0 ? Math.round((cancelled / finishedCount) * 1000) / 10 : 0,
          ratingBreakdown: {
            thoroughness: Number(reviewAgg._avg.thoroughness ?? 0),
            punctuality: Number(reviewAgg._avg.punctuality ?? 0),
            communication: Number(reviewAgg._avg.communication ?? 0),
          },
        };
      })
    );
  }

  // ─── Customer Metrics ──────────────────────────────────

  private static async getCustomerMetrics(providerId: string): Promise<CustomerMetrics> {
    const bookings = await prisma.booking.findMany({
      where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] }, clientId: { not: null } },
      select: {
        clientId: true,
        totalPrice: true,
        client: { select: { name: true } },
      },
    });

    const byCustomer: Record<string, { name: string; bookings: number; totalSpent: number }> = {};
    for (const b of bookings) {
      if (!b.clientId) continue;
      if (!byCustomer[b.clientId]) {
        byCustomer[b.clientId] = { name: b.client?.name || 'Guest', bookings: 0, totalSpent: 0 };
      }
      byCustomer[b.clientId].bookings++;
      byCustomer[b.clientId].totalSpent += Number(b.totalPrice);
    }

    const customers = Object.values(byCustomer);
    const totalCustomers = customers.length;
    const repeatCustomers = customers.filter((c) => c.bookings >= 2).length;
    const totalBookings = customers.reduce((sum, c) => sum + c.bookings, 0);
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);

    const topCustomers = customers
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map((c) => ({
        name: c.name,
        bookings: c.bookings,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
      }));

    return {
      totalCustomers,
      repeatCustomers,
      repeatRate:
        totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
      avgBookingsPerCustomer:
        totalCustomers > 0 ? Math.round((totalBookings / totalCustomers) * 10) / 10 : 0,
      avgSpendPerCustomer:
        totalCustomers > 0 ? Math.round((totalSpent / totalCustomers) * 100) / 100 : 0,
      avgSpendPerBooking:
        totalBookings > 0 ? Math.round((totalSpent / totalBookings) * 100) / 100 : 0,
      topCustomers,
    };
  }

  // ─── Operational Metrics ──────────────────────────────────

  private static async getOperationalMetrics(providerId: string): Promise<OperationalMetrics> {
    const allBookings = await prisma.booking.findMany({
      where: { providerId },
      select: {
        status: true,
        createdAt: true,
        acceptedAt: true,
        completedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        date: true,
        startTime: true,
        duration: true,
      },
    });

    // Response time: createdAt → acceptedAt
    const responseTimes: number[] = [];
    for (const b of allBookings) {
      if (b.acceptedAt && b.createdAt) {
        const diffMs = b.acceptedAt.getTime() - b.createdAt.getTime();
        responseTimes.push(diffMs / 60000); // minutes
      }
    }
    const avgResponseTimeMinutes =
      responseTimes.length > 0
        ? Math.round((responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length) * 10) / 10
        : 0;

    // Completion time: acceptedAt → completedAt
    const completionTimes: number[] = [];
    for (const b of allBookings) {
      if (b.completedAt && b.acceptedAt) {
        const diffMs = b.completedAt.getTime() - b.acceptedAt.getTime();
        completionTimes.push(diffMs / 3600000); // hours
      }
    }
    const avgCompletionTimeHours =
      completionTimes.length > 0
        ? Math.round((completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length) * 10) /
          10
        : 0;

    // On-time rate: completed within estimated duration + 30min buffer
    let onTimeCount = 0;
    let completedWithDuration = 0;
    for (const b of allBookings) {
      if (b.completedAt && b.acceptedAt && b.duration) {
        completedWithDuration++;
        const actualHours = (b.completedAt.getTime() - b.acceptedAt.getTime()) / 3600000;
        const estimatedHours = Number(b.duration);
        // Consider on-time if within 50% buffer (travel + buffer)
        if (actualHours <= estimatedHours * 1.5 + 1) {
          onTimeCount++;
        }
      }
    }
    const onTimeRate =
      completedWithDuration > 0
        ? Math.round((onTimeCount / completedWithDuration) * 1000) / 10
        : 100;

    // Completion and cancellation rates
    const completed = allBookings.filter((b) =>
      ['COMPLETED', 'REVIEWED'].includes(b.status)
    ).length;
    const cancelled = allBookings.filter((b) => b.status === 'CANCELLED').length;
    const finishedCount = completed + cancelled;
    const completionRate =
      finishedCount > 0 ? Math.round((completed / finishedCount) * 1000) / 10 : 100;
    const cancellationRate =
      allBookings.length > 0 ? Math.round((cancelled / allBookings.length) * 1000) / 10 : 0;

    // Cancellation reasons
    const reasonCounts: Record<string, number> = {};
    for (const b of allBookings) {
      if (b.status === 'CANCELLED') {
        const reason = b.cancellationReason || 'No reason provided';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    const cancellationReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Bookings by day of week
    const dayBuckets: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const b of allBookings) {
      const day = b.date.getDay();
      dayBuckets[day]++;
    }
    const bookingsByDayOfWeek = Object.entries(dayBuckets).map(([day, count]) => ({
      day: DAY_NAMES[Number(day)],
      count,
    }));

    // Peak hours
    const hourBuckets: Record<string, number> = {};
    for (const b of allBookings) {
      const hour = b.startTime?.split(':')[0] || '00';
      const label = `${hour}:00`;
      hourBuckets[label] = (hourBuckets[label] || 0) + 1;
    }
    const peakHours = Object.entries(hourBuckets)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      avgResponseTimeMinutes,
      avgCompletionTimeHours,
      onTimeRate,
      completionRate,
      cancellationRate,
      cancellationReasons,
      bookingsByDayOfWeek,
      peakHours,
    };
  }

  // ─── Quality Metrics ──────────────────────────────────

  private static async getQualityMetrics(providerId: string): Promise<QualityMetrics> {
    const [reviews, reviewAgg, complaints, disputes, totalBookings] = await Promise.all([
      prisma.review.findMany({
        where: { booking: { providerId }, visibility: 'VISIBLE' },
        select: { rating: true, thoroughness: true, punctuality: true, communication: true },
      }),
      prisma.review.aggregate({
        where: { booking: { providerId }, visibility: 'VISIBLE' },
        _avg: { rating: true, thoroughness: true, punctuality: true, communication: true },
        _count: true,
      }),
      prisma.complaint.findMany({
        where: { booking: { providerId } },
        select: { category: true },
      }),
      prisma.dispute.count({
        where: { booking: { providerId } },
      }),
      prisma.booking.count({
        where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] } },
      }),
    ]);

    // Rating distribution
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const stars = Math.round(Number(r.rating));
      if (dist[stars] !== undefined) dist[stars]++;
    }
    const ratingDistribution = Object.entries(dist).map(([stars, count]) => ({
      stars: Number(stars),
      count,
    }));

    // Complaints by category
    const catCounts: Record<string, number> = {};
    for (const c of complaints) {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    }
    const complaintsByCategory = Object.entries(catCounts)
      .map(([category, count]) => ({ category: category.replace('_', ' ').toLowerCase(), count }))
      .sort((a, b) => b.count - a.count);

    return {
      avgRating: Number(reviewAgg._avg.rating ?? 0),
      totalReviews: reviewAgg._count,
      ratingDistribution,
      avgThoroughness: Number(reviewAgg._avg.thoroughness ?? 0),
      avgPunctuality: Number(reviewAgg._avg.punctuality ?? 0),
      avgCommunication: Number(reviewAgg._avg.communication ?? 0),
      complaintsTotal: complaints.length,
      complaintsByCategory,
      disputeRate: totalBookings > 0 ? Math.round((disputes / totalBookings) * 1000) / 10 : 0,
    };
  }

  // ─── Financial Metrics ──────────────────────────────────

  private static async getFinancialMetrics(
    companyId: string,
    providerId: string
  ): Promise<FinancialMetrics> {
    const [revenueAgg, refundAgg, _addonCount, totalBookings, teamCount, _bookingsWithAddons] =
      await Promise.all([
        prisma.booking.aggregate({
          where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] } },
          _sum: { totalPrice: true, platformFee: true, cleanerEarnings: true },
          _count: true,
        }),
        prisma.payment.aggregate({
          where: {
            booking: { providerId },
            status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] },
          },
          _sum: { refundAmount: true },
          _count: true,
        }),
        prisma.booking.count({
          where: {
            providerId,
            status: { in: ['COMPLETED', 'REVIEWED'] },
          },
        }),
        prisma.booking.count({
          where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] } },
        }),
        prisma.teamMember.count({
          where: { companyId, isActive: true },
        }),
        prisma.booking.count({
          where: { providerId, status: { in: ['COMPLETED', 'REVIEWED'] } },
        }),
      ]);

    const totalRevenue = Number(revenueAgg._sum.totalPrice ?? 0);
    const totalPlatformFees = Number(revenueAgg._sum.platformFee ?? 0);
    const totalCleanerEarnings = Number(revenueAgg._sum.cleanerEarnings ?? 0);
    const refundTotal = Number(refundAgg._sum.refundAmount ?? 0);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
      totalCleanerEarnings: Math.round(totalCleanerEarnings * 100) / 100,
      platformMarginPercent:
        totalRevenue > 0 ? Math.round((totalPlatformFees / totalRevenue) * 1000) / 10 : 0,
      avgBookingValue:
        totalBookings > 0 ? Math.round((totalRevenue / totalBookings) * 100) / 100 : 0,
      refundTotal: Math.round(refundTotal * 100) / 100,
      refundRate:
        revenueAgg._count > 0 ? Math.round((refundAgg._count / revenueAgg._count) * 1000) / 10 : 0,
      revenuePerTeamMember: teamCount > 0 ? Math.round((totalRevenue / teamCount) * 100) / 100 : 0,
      addonRevenue: 0,
      addonAttachmentRate: 0,
    };
  }
}
