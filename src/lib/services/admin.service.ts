import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number;
  activeCleaners: number;
  revenue: number;
  pendingDisputes: number;
  bookingsChange: string;
  cleanersChange: string;
  revenueChange: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  bookingsCount: number;
  totalSpent: number;
  status: 'active' | 'suspended' | 'inactive';
}

export interface AdminCleaner {
  id: string;
  name: string;
  email: string;
  tier: string;
  rating: number;
  verified: boolean;
  activeBookings: number;
  completedJobs: number;
  status: 'active' | 'suspended' | 'pending-approval';
}

export interface AdminBooking {
  id: string;
  customer: string;
  cleaner: string;
  serviceType: string;
  date: string;
  time: string;
  amount: number;
  status: string;
}

export interface AdminDispute {
  id: string;
  bookingRef: string;
  customerName: string;
  cleanerName: string;
  reason: string;
  description: string;
  dateRaised: string;
  status: string;
  amount: number;
  filedBy: 'customer' | 'cleaner';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CleanerFilters {
  tier?: string;
  verified?: boolean;
  status?: string;
}

export interface BookingFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  serviceType?: string;
}

export interface PlatformSettings {
  commissionRate: number;
  sameDayMultiplier: number;
  serviceTypes: Array<{ id: string; name: string; basePrice: number; active: boolean }>;
  pricingRules: Array<{ id: string; name: string; multiplier: number; active: boolean }>;
  serviceAreas: Array<{ id: string; name: string; postcodes: string; active: boolean }>;
}

// ─── Service Functions ──────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const [
    totalBookings,
    lastMonthBookings,
    activeCleaners,
    lastWeekCleaners,
    revenueThisMonth,
    revenueLastMonth,
    pendingDisputes,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.booking.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    prisma.user.count({
      where: { role: 'CLEANER', accountStatus: 'ACTIVE', isSuspended: false },
    }),
    prisma.user.count({
      where: {
        role: 'CLEANER',
        accountStatus: 'ACTIVE',
        isSuspended: false,
        createdAt: { gte: startOfWeek },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.dispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    }),
  ]);

  const revMTD = Number(revenueThisMonth._sum.amount || 0);
  const revLastMonth = Number(revenueLastMonth._sum.amount || 0);
  const bookingChange =
    lastMonthBookings > 0
      ? (((totalBookings - lastMonthBookings) / lastMonthBookings) * 100).toFixed(1)
      : '0';
  const revenueChange =
    revLastMonth > 0
      ? (((revMTD - revLastMonth) / revLastMonth) * 100).toFixed(1)
      : '0';

  return {
    totalBookings,
    activeCleaners,
    revenue: revMTD,
    pendingDisputes,
    bookingsChange: `${Number(bookingChange) >= 0 ? '+' : ''}${bookingChange}% from last month`,
    cleanersChange: `+${lastWeekCleaners} this week`,
    revenueChange: `${Number(revenueChange) >= 0 ? '+' : ''}${revenueChange}% from last month`,
  };
}

export async function getCustomers(
  page: number = 1,
  search: string = '',
  pageSize: number = 10
): Promise<PaginatedResult<AdminCustomer>> {
  const where: Record<string, unknown> = { role: 'CLIENT', isDeleted: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        accountStatus: true,
        isSuspended: true,
        _count: { select: { bookingsAsClient: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const data: AdminCustomer[] = users.map((u) => {
    let status: AdminCustomer['status'] = 'active';
    if (u.isSuspended || u.accountStatus === 'SUSPENDED') status = 'suspended';
    else if (u.accountStatus === 'DEACTIVATED') status = 'inactive';

    return {
      id: u.id,
      name: u.name || 'Unknown',
      email: u.email,
      joinDate: u.createdAt.toISOString().split('T')[0],
      bookingsCount: u._count.bookingsAsClient,
      totalSpent: 0, // Aggregation would require extra query per user
      status,
    };
  });

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCleaners(
  page: number = 1,
  search: string = '',
  filters: CleanerFilters = {},
  pageSize: number = 10
): Promise<PaginatedResult<AdminCleaner>> {
  const where: Record<string, unknown> = { role: 'CLEANER', isDeleted: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.verified !== undefined) {
    where.cleanerProfile = { ...(where.cleanerProfile as object || {}), verified: filters.verified };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        isSuspended: true,
        accountStatus: true,
        cleanerProfile: {
          select: { tier: true, rating: true, verified: true, completedJobs: true },
        },
        _count: {
          select: {
            bookingsAsCleaner: {
              where: { status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const data: AdminCleaner[] = users.map((c) => {
    let status: AdminCleaner['status'] = 'active';
    if (c.isSuspended || c.accountStatus === 'SUSPENDED') status = 'suspended';
    else if (!c.cleanerProfile?.verified) status = 'pending-approval';

    return {
      id: c.id,
      name: c.name || 'Unknown',
      email: c.email,
      tier: c.cleanerProfile?.tier?.toLowerCase() || 'starter',
      rating: Number(c.cleanerProfile?.rating || 0),
      verified: c.cleanerProfile?.verified || false,
      activeBookings: c._count.bookingsAsCleaner,
      completedJobs: c.cleanerProfile?.completedJobs || 0,
      status,
    };
  });

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getAllBookings(
  page: number = 1,
  filters: BookingFilters = {},
  pageSize: number = 10
): Promise<PaginatedResult<AdminBooking>> {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status.toUpperCase();
  }
  if (filters.serviceType) {
    where.serviceType = filters.serviceType;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) (where.date as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters.dateTo) (where.date as Record<string, unknown>).lte = new Date(filters.dateTo);
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { name: true } },
        cleaner: { select: { name: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const data: AdminBooking[] = bookings.map((b) => ({
    id: b.id,
    customer: b.client?.name || b.guestName || 'Guest',
    cleaner: b.cleaner.name || 'Unassigned',
    serviceType: b.serviceType,
    date: b.date.toISOString().split('T')[0],
    time: b.startTime,
    amount: Number(b.totalPrice),
    status: b.status.toLowerCase().replace('_', '-'),
  }));

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getDisputes(
  page: number = 1,
  status?: string,
  pageSize: number = 10
): Promise<PaginatedResult<AdminDispute>> {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status.toUpperCase().replace('-', '_');
  }

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        booking: {
          include: {
            client: { select: { name: true } },
            cleaner: { select: { name: true } },
          },
        },
        raisedBy: { select: { role: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  const data: AdminDispute[] = disputes.map((d) => ({
    id: d.id,
    bookingRef: d.booking.id.substring(0, 8).toUpperCase(),
    customerName: d.booking.client?.name || d.booking.guestName || 'Guest',
    cleanerName: d.booking.cleaner.name || 'Unassigned',
    reason: d.reason,
    description: d.description,
    dateRaised: d.createdAt.toISOString().split('T')[0],
    status: d.status.toLowerCase().replace('_', '-'),
    amount: Number(d.booking.totalPrice),
    filedBy: d.raisedBy.role === 'CLEANER' ? 'cleaner' as const : 'customer' as const,
  }));

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function updatePlatformSettings(
  settings: Partial<PlatformSettings>
): Promise<{ success: boolean }> {
  if (settings.commissionRate !== undefined) {
    await prisma.platformConfig.upsert({
      where: { key: 'commission_rate' },
      update: { value: String(settings.commissionRate) },
      create: { key: 'commission_rate', value: String(settings.commissionRate) },
    });
  }

  if (settings.sameDayMultiplier !== undefined) {
    await prisma.platformConfig.upsert({
      where: { key: 'same_day_multiplier' },
      update: { value: String(settings.sameDayMultiplier) },
      create: { key: 'same_day_multiplier', value: String(settings.sameDayMultiplier) },
    });
  }

  return { success: true };
}
