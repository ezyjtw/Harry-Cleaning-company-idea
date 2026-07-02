import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { isProfileComplete } from '@/lib/cleaner/profile-completion';
import prisma from '@/lib/db/prisma';
import { bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [
    profile,
    todaysJobs,
    weeklyBookings,
    upcomingJobs,
    recentReviews,
    thirtyDayBookings,
    backupBookingCount,
    importedReviewCount,
  ] = await Promise.all([
    // Cleaner profile
    prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: {
        rating: true,
        tier: true,
        completedJobs: true,
        availableNow: true,
        verified: true,
        verificationStatus: true,
        insuranceVerified: true,
        bio: true,
        postcode: true,
        specialties: true,
        serviceTypes: true,
        hourlyRateRegular: true,
        eotPrices: true,
        airbnbPrices: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        homePostcode: true,
        maxTravelMinutes: true,
        // Setup-checklist: count of availability slots (no "availability set" flag
        // existed before; this derives one for the checklist item).
        _count: { select: { availabilitySlots: true } },
      },
    }),

    // Today's jobs count
    prisma.booking.count({
      where: {
        cleanerId: user.id,
        date: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 86400000) },
        // #4: exclude jobs this cleaner declined, and only count AWAITING_CLEANER
        // while this cleaner is still the current offer-holder (cleanerId stays
        // pinned to the primary through the whole cascade, so gate on cascadePhase).
        // Confirmed/accepted/in-progress work is theirs regardless of phase.
        NOT: { declinedCleanerIds: { has: user.id } },
        OR: [
          { status: { in: ['CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'] } },
          {
            status: 'AWAITING_CLEANER',
            OR: [
              { cascadePhase: null },
              { cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] } },
            ],
          },
        ],
      },
    }),

    // Weekly earnings
    prisma.booking.findMany({
      where: {
        cleanerId: user.id,
        date: { gte: startOfWeek, lt: endOfWeek },
        status: { in: ['COMPLETED', 'REVIEWED'] },
      },
      select: { cleanerEarnings: true, date: true },
    }),

    // Upcoming jobs (next 7 days, pending or confirmed)
    prisma.booking.findMany({
      where: {
        cleanerId: user.id,
        date: { gte: startOfDay },
        // #4: same gating as today's count — drop offers this cleaner declined,
        // and only show AWAITING_CLEANER while they're the current offer-holder,
        // so a declined/passed-on offer no longer appears as an actionable
        // "Pending" row (which then 409s on Accept).
        NOT: { declinedCleanerIds: { has: user.id } },
        OR: [
          { status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED'] } },
          {
            status: 'AWAITING_CLEANER',
            OR: [
              { cascadePhase: null },
              { cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] } },
            ],
          },
        ],
      },
      include: {
        client: { select: { name: true } },
        address: { select: { line1: true, postcode: true } },
      },
      orderBy: { date: 'asc' },
      take: 5,
    }),

    // Recent reviews
    prisma.review.findMany({
      where: { cleanerId: user.id, visibility: 'VISIBLE' },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // Last 30 days bookings for response rate
    prisma.booking.count({
      where: {
        cleanerId: user.id,
        createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        status: { notIn: ['CANCELLED'] },
      },
    }),

    // Bookings where this cleaner is a backup and being offered the job
    prisma.booking.count({
      where: {
        backupCleanerIds: { has: user.id },
        status: 'AWAITING_CLEANER',
        cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER'] },
        NOT: { declinedCleanerIds: { has: user.id } },
      },
    }),

    // Setup-checklist: how many reviews the cleaner has imported (any status).
    prisma.importedReview.count({ where: { cleanerId: user.id } }),
  ]);

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Calculate weekly earnings by day
  const weeklyEarnings = weeklyBookings.reduce((sum, b) => sum + Number(b.cleanerEarnings), 0);

  // Build daily earnings for the chart (Mon-Sun)
  const dailyEarnings = Array(7).fill(0);
  for (const booking of weeklyBookings) {
    const day = booking.date.getDay();
    const idx = day === 0 ? 6 : day - 1; // Convert to Mon=0, Sun=6
    dailyEarnings[idx] += Number(booking.cleanerEarnings);
  }
  const maxDaily = Math.max(...dailyEarnings, 1);
  const dailyPercents = dailyEarnings.map((e) => Math.round((e / maxDaily) * 100));

  // Cancelled in last 30 days
  const cancelledCount = await prisma.booking.count({
    where: {
      cleanerId: user.id,
      createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
      status: 'CANCELLED',
    },
  });
  const totalRecent = thirtyDayBookings + cancelledCount;
  const responseRate =
    totalRecent > 0 ? Math.round(((totalRecent - cancelledCount) / totalRecent) * 100) : 100;

  return NextResponse.json({
    profile: {
      name: user.name,
      rating: Number(profile.rating),
      tier: profile.tier,
      completedJobs: profile.completedJobs,
      availableNow: profile.availableNow,
      verified: profile.verified,
      verificationStatus: profile.verificationStatus,
      insuranceVerified: profile.insuranceVerified,
      profileComplete: isProfileComplete(profile),
      serviceTypes: profile.serviceTypes,
      hourlyRateRegular: profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null,
      eotPrices: profile.eotPrices,
      airbnbPrices: profile.airbnbPrices,
      stripeChargesEnabled: profile.stripeChargesEnabled,
      stripePayoutsEnabled: profile.stripePayoutsEnabled,
      homePostcode: profile.homePostcode,
      maxTravelMinutes: profile.maxTravelMinutes,
      // Setup-checklist derived state
      availabilitySlotsCount: profile._count.availabilitySlots,
      importedReviewCount,
    },
    stats: {
      todaysJobs,
      weeklyEarnings: weeklyEarnings.toFixed(2),
      rating: Number(profile.rating).toFixed(1),
      reviewCount: profile.completedJobs,
      responseRate,
      backupBookingCount,
    },
    dailyPercents,
    upcomingJobs: upcomingJobs.map((j) => ({
      id: j.id,
      clientName: j.client?.name || j.guestName || 'Guest',
      // A12: read from booking columns (legacy relation fallback in helper).
      address:
        j.status === 'PENDING'
          ? bookingPostcode(j) || 'TBD'
          : `${bookingLine1(j)}, ${bookingPostcode(j)}`,
      date: j.date.toISOString().split('T')[0],
      time: j.startTime,
      serviceType: j.serviceType,
      price: Number(j.totalPrice),
      cleanerEarnings: Number(j.cleanerEarnings),
      status: j.status.toLowerCase(),
      bedrooms: (j.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
    })),
    recentReviews: recentReviews.map((r) => ({
      id: r.id,
      clientName: r.client.name || 'Anonymous',
      rating: Number(r.rating),
      comment: r.text || '',
      date: r.createdAt.toISOString().split('T')[0],
    })),
  });
}
