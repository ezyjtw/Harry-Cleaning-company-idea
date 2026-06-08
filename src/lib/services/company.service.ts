import type { ProviderType, CompanyVerificationStatus, BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface CreateCompanyData {
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  operatingAreas?: string[];
  specialties?: string[];
}

export interface UpdateCompanyData {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  operatingAreas?: string[];
  specialties?: string[];
  isActive?: boolean;
}

export interface BookingFilters {
  status?: BookingStatus;
  dateFrom?: Date;
  dateTo?: Date;
  cleanerId?: string;
  page?: number;
  pageSize?: number;
}

export interface CompanyDashboard {
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  activeTeamMembers: number;
  totalTeamMembers: number;
}

export interface CompanyPerformanceMetrics {
  completionRate: number;
  averageRating: number;
  totalRevenue: number;
  revenueThisMonth: number;
  bookingsThisMonth: number;
  cancellationRate: number;
  averageJobDuration: number;
  topPerformers: { userId: string; name: string | null; completedJobs: number; rating: number }[];
}

// ─── Service ────────────────────────────────────────────────

export class CompanyService {
  /**
   * Create a new company with its associated Provider record.
   */
  static async createCompany(ownerId: string, data: CreateCompanyData) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          ownerId,
          name: data.name,
          description: data.description,
          logo: data.logo,
          website: data.website,
          phone: data.phone,
          email: data.email,
          registrationNumber: data.registrationNumber,
          operatingAreas: data.operatingAreas ?? [],
          specialties: data.specialties ?? [],
        },
      });

      const provider = await tx.provider.create({
        data: {
          type: 'COMPANY' as ProviderType,
          companyId: company.id,
        },
      });

      // Add owner as a team member with OWNER role
      await tx.teamMember.create({
        data: {
          companyId: company.id,
          userId: ownerId,
          role: 'OWNER',
          isActive: true,
          canAcceptJobs: true,
        },
      });

      return { company, provider };
    });
  }

  /**
   * Get a company by ID with its provider and team info.
   */
  static async getCompany(companyId: string) {
    return prisma.company.findUnique({
      where: { id: companyId },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        provider: true,
        team: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Update company details.
   */
  static async updateCompany(companyId: string, data: UpdateCompanyData) {
    return prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  /**
   * Get dashboard stats for a company.
   */
  static async getCompanyDashboard(companyId: string): Promise<CompanyDashboard> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (!company?.provider) {
      throw new Error(`Company ${companyId} not found or has no provider`);
    }

    const providerId = company.provider.id;

    const [
      totalBookings,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      revenueAgg,
      reviewAgg,
      teamCounts,
    ] = await Promise.all([
      prisma.booking.count({ where: { providerId } }),
      prisma.booking.count({ where: { providerId, status: 'COMPLETED' } }),
      prisma.booking.count({
        where: { providerId, status: { in: ['PENDING', 'AWAITING_CLEANER'] } },
      }),
      prisma.booking.count({ where: { providerId, status: 'CANCELLED' } }),
      prisma.booking.aggregate({
        where: { providerId, status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      prisma.review.aggregate({
        where: { booking: { providerId } },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.teamMember
        .aggregate({
          where: { companyId },
          _count: { _all: true },
        })
        .then(async (total) => {
          const active = await prisma.teamMember.count({
            where: { companyId, isActive: true },
          });
          return { total: total._count._all, active };
        }),
    ]);

    return {
      totalBookings,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      totalRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
      averageRating: Number(reviewAgg._avg.rating ?? 0),
      totalReviews: reviewAgg._count,
      activeTeamMembers: teamCounts.active,
      totalTeamMembers: teamCounts.total,
    };
  }

  /**
   * Get bookings for a company with optional filters and pagination.
   */
  static async getCompanyBookings(companyId: string, filters: BookingFilters = {}) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (!company?.provider) {
      throw new Error(`Company ${companyId} not found or has no provider`);
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where = {
      providerId: company.provider.id,
      ...(filters.status && { status: filters.status }),
      ...(filters.cleanerId && { cleanerId: filters.cleanerId }),
      ...((filters.dateFrom || filters.dateTo) && {
        date: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          cleaner: { select: { id: true, name: true, email: true } },
          address: true,
          review: true,
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Assign a booking to a specific team member (cleaner).
   */
  static async assignBookingToTeamMember(bookingId: string, userId: string) {
    // Verify the user is an active team member of the company that owns the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: { include: { company: true } } },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (!booking.provider?.company) {
      throw new Error('Booking is not associated with a company');
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: {
        companyId_userId: {
          companyId: booking.provider.company.id,
          userId,
        },
      },
    });

    if (!teamMember || !teamMember.isActive) {
      throw new Error('User is not an active team member of this company');
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: { cleanerId: userId },
      include: {
        cleaner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Admin action: verify or reject a company.
   */
  static async verifyCompany(companyId: string, status: CompanyVerificationStatus) {
    return prisma.company.update({
      where: { id: companyId },
      data: { verificationStatus: status },
    });
  }

  /**
   * Get detailed performance metrics for a company.
   */
  static async getCompanyPerformanceMetrics(companyId: string): Promise<CompanyPerformanceMetrics> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (!company?.provider) {
      throw new Error(`Company ${companyId} not found or has no provider`);
    }

    const providerId = company.provider.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      completedCount,
      totalCount,
      cancelledCount,
      revenueAll,
      revenueMonth,
      bookingsMonth,
      reviewAgg,
      completedBookings,
    ] = await Promise.all([
      prisma.booking.count({ where: { providerId, status: 'COMPLETED' } }),
      prisma.booking.count({ where: { providerId } }),
      prisma.booking.count({ where: { providerId, status: 'CANCELLED' } }),
      prisma.booking.aggregate({
        where: { providerId, status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: { providerId, status: 'COMPLETED', date: { gte: startOfMonth } },
        _sum: { totalPrice: true },
      }),
      prisma.booking.count({
        where: { providerId, date: { gte: startOfMonth } },
      }),
      prisma.review.aggregate({
        where: { booking: { providerId } },
        _avg: { rating: true },
      }),
      prisma.booking.findMany({
        where: { providerId, status: 'COMPLETED' },
        select: { duration: true },
      }),
    ]);

    const avgDuration =
      completedBookings.length > 0
        ? completedBookings.reduce((sum, b) => sum + Number(b.duration), 0) /
          completedBookings.length
        : 0;

    // Top performers: team members with the most completed bookings
    const teamMembers = await prisma.teamMember.findMany({
      where: { companyId, isActive: true },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const topPerformers = await Promise.all(
      teamMembers.map(async (tm) => {
        const [jobs, rating] = await Promise.all([
          prisma.booking.count({
            where: { cleanerId: tm.userId, providerId, status: 'COMPLETED' },
          }),
          prisma.review.aggregate({
            where: { cleanerId: tm.userId, booking: { providerId } },
            _avg: { rating: true },
          }),
        ]);
        return {
          userId: tm.userId,
          name: tm.user.name,
          completedJobs: jobs,
          rating: Number(rating._avg.rating ?? 0),
        };
      })
    );

    topPerformers.sort((a, b) => b.completedJobs - a.completedJobs);

    const finishedCount = completedCount + cancelledCount;

    return {
      completionRate: finishedCount > 0 ? (completedCount / finishedCount) * 100 : 100,
      averageRating: Number(reviewAgg._avg.rating ?? 0),
      totalRevenue: Number(revenueAll._sum.totalPrice ?? 0),
      revenueThisMonth: Number(revenueMonth._sum.totalPrice ?? 0),
      bookingsThisMonth: bookingsMonth,
      cancellationRate: totalCount > 0 ? (cancelledCount / totalCount) * 100 : 0,
      averageJobDuration: Math.round(avgDuration * 100) / 100,
      topPerformers: topPerformers.slice(0, 5),
    };
  }
}
