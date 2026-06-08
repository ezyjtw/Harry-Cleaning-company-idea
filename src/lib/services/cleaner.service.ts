import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface UpdateCleanerProfileData {
  name?: string;
  photo?: string;
  bio?: string;
  hourlyRateRegular?: number;
  specialties?: string[];
  languages?: string[];
  location?: string;
  bringsProducts?: boolean;
}

export interface AvailabilitySlot {
  day: string;
  start: string;
  end: string;
}

export interface EarningsSummary {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  payouts: PayoutRecord[];
  breakdown: ServiceBreakdown[];
}

export interface PayoutRecord {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  reference: string;
}

export interface ServiceBreakdown {
  serviceType: string;
  count: number;
  amount: number;
}

export interface CleanerJob {
  id: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  status: 'pending' | 'upcoming' | 'in-progress' | 'completed';
  duration: number;
}

// ─── Day-of-week mapping ─────────────────────────────────────

const NUMBER_TO_DAY: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// ─── Service Functions ──────────────────────────────────────

export async function getCleanerProfile(userId: string) {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true, phone: true, image: true } },
    },
  });

  if (!profile) return null;

  return {
    id: userId,
    name: profile.user.name || 'Unknown',
    photo: profile.user.image || '',
    rating: Number(profile.rating),
    reviewCount: profile.completedJobs,
    hourlyRateRegular: Number(profile.hourlyRateRegular),
    bio: profile.bio || '',
    specialties: profile.specialties,
    tier: profile.tier.toLowerCase(),
    location: profile.location || '',
    verified: profile.verified,
    completedJobs: profile.completedJobs,
    availableNow: profile.availableNow,
  };
}

export async function updateCleanerProfile(userId: string, data: UpdateCleanerProfileData) {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId },
  });
  if (!profile) return null;

  const profileUpdate: Record<string, unknown> = {};
  if (data.bio !== undefined) profileUpdate.bio = data.bio.trim();
  if (data.hourlyRateRegular !== undefined)
    profileUpdate.hourlyRateRegular = data.hourlyRateRegular;
  if (data.specialties !== undefined) profileUpdate.specialties = data.specialties;
  if (data.location !== undefined) profileUpdate.location = data.location;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(profileUpdate).length > 0) {
      await tx.cleanerProfile.update({
        where: { id: profile.id },
        data: profileUpdate,
      });
    }
    if (data.photo !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { image: data.photo },
      });
    }
    if (data.name !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { name: data.name },
      });
    }
  });

  return getCleanerProfile(userId);
}

export async function getAvailability(cleanerId: string): Promise<AvailabilitySlot[]> {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerId },
    include: { availabilitySlots: true },
  });

  if (!profile) return [];

  return profile.availabilitySlots.map((slot) => ({
    day: NUMBER_TO_DAY[slot.dayOfWeek] || 'Unknown',
    start: slot.startTime,
    end: slot.endTime,
  }));
}

export async function updateAvailability(
  cleanerId: string,
  slots: AvailabilitySlot[]
): Promise<{ success: boolean }> {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerId },
  });
  if (!profile) return { success: false };

  const DAY_TO_NUMBER: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  await prisma.$transaction(async (tx) => {
    await tx.availabilitySlot.deleteMany({
      where: { cleanerProfileId: profile.id },
    });

    const data = slots.map((slot) => ({
      cleanerProfileId: profile.id,
      dayOfWeek: DAY_TO_NUMBER[slot.day] ?? 0,
      startTime: slot.start,
      endTime: slot.end,
    }));

    if (data.length > 0) {
      await tx.availabilitySlot.createMany({ data });
    }
  });

  return { success: true };
}

export async function getEarnings(
  cleanerId: string,
  period: 'week' | 'month' | 'year' | 'custom'
): Promise<EarningsSummary> {
  const now = new Date();
  let dateFrom: Date;

  switch (period) {
    case 'week':
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay() + 1);
      dateFrom.setHours(0, 0, 0, 0);
      break;
    case 'year':
      dateFrom = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const completedBookings = await prisma.booking.findMany({
    where: {
      cleanerId,
      status: { in: ['COMPLETED', 'REVIEWED'] },
      completedAt: { gte: dateFrom },
    },
    select: {
      id: true,
      serviceType: true,
      totalPrice: true,
      cleanerEarnings: true,
      platformFee: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  let totalEarnings = 0;
  let totalFees = 0;
  for (const b of completedBookings) {
    totalEarnings += Number(b.cleanerEarnings);
    totalFees += Number(b.platformFee);
  }

  const byService: Record<string, { count: number; amount: number }> = {};
  for (const b of completedBookings) {
    if (!byService[b.serviceType]) byService[b.serviceType] = { count: 0, amount: 0 };
    byService[b.serviceType].count++;
    byService[b.serviceType].amount += Number(b.cleanerEarnings);
  }

  const breakdown = Object.entries(byService).map(([serviceType, data]) => ({
    serviceType,
    count: data.count,
    amount: Math.round(data.amount * 100) / 100,
  }));

  // Group by date for payouts
  const payoutsByDate: Record<string, number> = {};
  for (const b of completedBookings) {
    const key = b.completedAt ? b.completedAt.toISOString().split('T')[0] : 'unknown';
    payoutsByDate[key] = (payoutsByDate[key] || 0) + Number(b.cleanerEarnings);
  }

  const payouts = Object.entries(payoutsByDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, amount], i) => ({
      id: `P-${String(i + 1).padStart(3, '0')}`,
      date,
      amount: Math.round(amount * 100) / 100,
      status: 'completed' as const,
      reference: `PAY-${date.replace(/-/g, '')}`,
    }));

  return {
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    platformFees: Math.round(totalFees * 100) / 100,
    netEarnings: Math.round(totalEarnings * 100) / 100,
    payouts,
    breakdown,
  };
}

function mapJobStatus(status: string): CleanerJob['status'] {
  switch (status) {
    case 'PENDING':
    case 'AWAITING_CLEANER':
      return 'pending';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'upcoming';
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'in-progress';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'completed';
    default:
      return 'pending';
  }
}

export async function getCleanerJobs(
  cleanerId: string,
  status?: CleanerJob['status']
): Promise<CleanerJob[]> {
  const statusMap: Record<string, string[]> = {
    pending: ['PENDING', 'AWAITING_CLEANER'],
    upcoming: ['CONFIRMED', 'ACCEPTED'],
    'in-progress': ['EN_ROUTE', 'IN_PROGRESS'],
    completed: ['COMPLETED', 'REVIEWED'],
  };

  const where: Record<string, unknown> = { cleanerId };
  if (status && statusMap[status]) {
    where.status = { in: statusMap[status] };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      client: { select: { name: true } },
      address: { select: { line1: true, city: true, postcode: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  });

  return bookings.map((b) => ({
    id: b.id,
    clientName: b.client?.name || b.guestName || 'Guest',
    address: `${b.address?.line1 || ''}, ${b.address?.postcode || ''}`,
    date: b.date.toISOString().split('T')[0],
    time: b.startTime,
    serviceType: b.serviceType,
    price: Number(b.totalPrice),
    status: mapJobStatus(b.status),
    duration: Number(b.duration),
  }));
}
