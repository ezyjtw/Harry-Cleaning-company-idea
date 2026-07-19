import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { computeCleanerOpenRanges } from '@/lib/availability/timesheet';
import { notOwnBookingWhere } from '@/lib/booking/own-booking';
import { isProfileComplete } from '@/lib/cleaner/profile-completion';
import prisma from '@/lib/db/prisma';
import { CURRENT_AGREEMENT_VERSION } from '@/lib/legal/self-employment-acknowledgment';
import { bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';
import { displayName } from '@/lib/utils/name';

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

  // H34 banner window: today → end of THIS calendar week (Sunday 23:59). Its
  // availability queries filter through the cleanerProfile relation on
  // user.id, so they no longer depend on the profile row's id and fold into
  // the single query burst below (see the perf note near the H34 loop).
  const h34WeekEnd = new Date(startOfDay);
  {
    const dow = h34WeekEnd.getDay(); // 0=Sun
    h34WeekEnd.setDate(h34WeekEnd.getDate() + (dow === 0 ? 0 : 7 - dow));
    h34WeekEnd.setHours(23, 59, 59, 999);
  }
  const cleanerProfileByUser = { cleanerProfile: { userId: user.id } };

  // PERF (H41 audit): the /cleaner dashboard was FOUR sequential DB round-trip
  // phases — this burst, then a serial cancelled-count, then a serial
  // review-count, then the H34 availability trio. Under production pool
  // contention each phase queued for a free connection, so the render stalled
  // in the tail intermittently. They only ever needed user.id (or the profile
  // relation), so every query now shares ONE Promise.all: one acquisition
  // burst, not four. The H34 work left after this is pure CPU.
  const [
    profile,
    todaysJobs,
    weeklyBookings,
    upcomingJobs,
    recentReviews,
    thirtyDayBookings,
    backupBookingCount,
    importedReviewCount,
    insuranceDocCount,
    rejectedDocs,
    cancelledCount,
    visibleReviewCount,
    h34Recurring,
    h34DateSlots,
    h34Overrides,
  ] = await Promise.all([
    // Cleaner profile
    prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        rating: true,
        tier: true,
        completedJobs: true,
        availableNow: true,
        verified: true,
        verificationStatus: true,
        insuranceVerified: true,
        insuranceExpiresAt: true,
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
        acknowledgmentVersion: true,
        // Setup-checklist: count of availability slots (no "availability set" flag
        // existed before; this derives one for the checklist item).
        // H33: BOTH availability shapes count — the per-week editor writes
        // AvailabilityDateSlot rows, not recurring AvailabilitySlot rows, and
        // the recurring-only count left "Set your availability" permanently
        // unticked for week-view cleaners. Derived at read time, so the fix is
        // retroactive for everyone who already set times.
        _count: { select: { availabilitySlots: true, availabilityDateSlots: true } },
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
        // H38: own customer purchase never renders through the job door.
        AND: [
          notOwnBookingWhere(user.id),
          {
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
        NOT: { declinedCleanerIds: { has: user.id } },
        // H38: own customer purchase never renders through the job door.
        // (AND-wrapped — this where has its own OR; a spread would collide.)
        AND: [notOwnBookingWhere(user.id)],
        // Only surface what a cleaner can actually act on or already owns:
        //  - CONFIRMED / ACCEPTED = their upcoming work (read-only, no Accept).
        //  - AWAITING_CLEANER + a LIVE primary cascade phase = a genuine offer
        //    they can Accept.
        // Bare PENDING (assigned/auto-assigned but no open cascade) and
        // null-phase AWAITING_CLEANER are NOT acceptable — the accept path
        // requires AWAITING_CLEANER + an active cascadePhase (cascade.service),
        // so showing them with an Accept button 400s "Booking is not awaiting a
        // cleaner". They are excluded here.
        OR: [
          { status: { in: ['CONFIRMED', 'ACCEPTED'] } },
          {
            status: 'AWAITING_CLEANER',
            cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] },
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

    // Two-stage go-live: has an insurance document been uploaded at all
    // (approved or awaiting review)? Drives the waiting screen's card state.
    prisma.documentUpload.count({
      where: { userId: user.id, documentType: 'insurance', isDestroyed: false },
    }),

    // Admin-reject surface (James): the cleaner must see what was rejected +
    // why, so they can re-upload. F8: fetch ALL docs and judge by the NEWEST of
    // each type (same supersession rule as the admin queue) — a fresh re-upload
    // must clear the rejection notice here, not leave it stuck forever.
    prisma.documentUpload.findMany({
      where: { userId: user.id, isDestroyed: false },
      select: {
        documentType: true,
        rejectionReason: true,
        rejectedAt: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Cancelled in last 30 days (was a serial await — folded in; needs user.id).
    prisma.booking.count({
      where: {
        cleanerId: user.id,
        createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        status: 'CANCELLED',
      },
    }),

    // B7: visible review count (was a serial await — folded in; needs user.id).
    prisma.review.count({
      where: { cleanerId: user.id, visibility: 'VISIBLE' },
    }),

    // H34 banner trio (was a second Promise.all after the profile — folded in
    // by filtering through the cleanerProfile relation, so no profile.id dep).
    prisma.availabilitySlot.findMany({
      where: cleanerProfileByUser,
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    prisma.availabilityDateSlot.findMany({
      where: { ...cleanerProfileByUser, date: { gte: startOfDay, lte: h34WeekEnd } },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
    prisma.availabilityOverride.findMany({
      where: {
        ...cleanerProfileByUser,
        date: { gte: startOfDay, lte: h34WeekEnd },
        isBlocked: true,
      },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
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

  const totalRecent = thirtyDayBookings + cancelledCount;
  // B7 honesty: this is a COMPLETION rate (non-cancelled share of recent
  // bookings) — it was previously surfaced under a "Response Rate" label it
  // never measured.
  const completionRate =
    totalRecent > 0 ? Math.round(((totalRecent - cancelledCount) / totalRecent) * 100) : 100;

  // H34 (James-ruled banner): "no availability set this week" — computed with
  // the SAME timesheet core search uses (computeCleanerOpenRanges: recurring
  // template + date-specific slots − blocked overrides), evaluated for each
  // REMAINING day of the current week (today → Sunday). Bookings are
  // deliberately NOT subtracted: a fully-booked week is not "no availability
  // set". Banner fires only when every remaining day has zero open ranges.
  // PERF: the three availability reads this needs are fetched up in the single
  // query burst above; only this pure-CPU loop remains here.
  let noAvailabilityThisWeek = false;
  {
    const dayMs = 86400000;
    const remainingDays = Math.round((h34WeekEnd.getTime() - startOfDay.getTime()) / dayMs) + 1;
    let anyOpen = false;
    for (let i = 0; i < remainingDays && !anyOpen; i++) {
      const target = new Date(startOfDay.getTime() + i * dayMs);
      const targetStr = target.toISOString().split('T')[0];
      const { openRanges } = computeCleanerOpenRanges({
        targetDate: target,
        bufferMins: 0,
        recurringSlots: h34Recurring,
        dateSlots: h34DateSlots.filter((s) => s.date.toISOString().startsWith(targetStr)),
        overrides: h34Overrides.filter((o) => o.date.toISOString().startsWith(targetStr)),
        bookings: [],
        isPast: false,
      });
      if (openRanges.length > 0) anyOpen = true;
    }
    noAvailabilityThisWeek = !anyOpen;
  }

  return NextResponse.json({
    profile: {
      name: displayName(user.name),
      rating: Number(profile.rating),
      tier: profile.tier,
      completedJobs: profile.completedJobs,
      availableNow: profile.availableNow,
      verified: profile.verified,
      verificationStatus: profile.verificationStatus,
      insuranceVerified: profile.insuranceVerified,
      insuranceExpiresAt: profile.insuranceExpiresAt
        ? profile.insuranceExpiresAt.toISOString()
        : null,
      profileComplete: isProfileComplete(profile),
      acknowledgmentComplete: profile.acknowledgmentVersion === CURRENT_AGREEMENT_VERSION,
      serviceTypes: profile.serviceTypes,
      hourlyRateRegular: profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null,
      eotPrices: profile.eotPrices,
      airbnbPrices: profile.airbnbPrices,
      stripeChargesEnabled: profile.stripeChargesEnabled,
      stripePayoutsEnabled: profile.stripePayoutsEnabled,
      homePostcode: profile.homePostcode,
      maxTravelMinutes: profile.maxTravelMinutes,
      // Setup-checklist derived state (H33: recurring + date-specific)
      availabilitySlotsCount:
        profile._count.availabilitySlots + profile._count.availabilityDateSlots,
      // H34 banner predicate (see computation above)
      noAvailabilityThisWeek,
      importedReviewCount,
      insuranceSubmitted: insuranceDocCount > 0,
      // F8: the NEWEST doc of each type decides (docs arrive createdAt desc) —
      // rejected only if that newest doc is rejected-and-unverified. A re-upload
      // (newer row, not rejected) supersedes and the notice clears.
      rejectedDocuments: Array.from(
        rejectedDocs
          .reduce((m, d) => (m.has(d.documentType) ? m : m.set(d.documentType, d)), new Map())
          .values()
      )
        .filter((d) => d.rejectedAt && !d.isVerified)
        .map((d) => ({ type: d.documentType, reason: d.rejectionReason })),
    },
    stats: {
      todaysJobs,
      weeklyEarnings: weeklyEarnings.toFixed(2),
      rating: Number(profile.rating).toFixed(1),
      reviewCount: visibleReviewCount,
      completionRate,
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
      // A live offer the cleaner can Accept (only AWAITING_CLEANER rows reach
      // here, and the query already restricted those to active primary phases).
      isOffer: j.status === 'AWAITING_CLEANER',
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
