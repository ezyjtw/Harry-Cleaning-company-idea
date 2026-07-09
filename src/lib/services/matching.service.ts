import { prisma } from '@/lib/db/prisma';
import { CURRENT_AGREEMENT_VERSION } from '@/lib/legal/self-employment-acknowledgment';
import { cleanerCoversPoint } from '@/lib/services/coverage.service';
import { haversineDistance, lookupPostcode } from '@/lib/utils/postcode';

import { TravelTimeService } from './travel-time.service';
import type { LocationCoords } from './travel-time.service';

// ─── Types ──────────────────────────────────────────────────────

export interface MatchingCriteria {
  date: Date;
  startTime: string;
  duration: number;
  serviceType: string;
  postcode: string;
  location?: LocationCoords;
  clientId?: string; // For repeat cleaner prioritization
  preferredCleanerId?: string;
  // Time-first discovery: skip the recurring-slot availability gate so this returns
  // ALL area+service-qualified candidates (ranked), and the caller applies the
  // accurate timesheet availability gate itself. Default false → unchanged behaviour
  // for the cascade / auto-assign / rebroadcast callers.
  skipAvailabilityFilter?: boolean;
}

export interface CleanerMatch {
  cleanerId: string;
  userId: string;
  name: string;
  rating: number;
  hourlyRateRegular: number;
  tier: string;
  totalScore: number;
  scores: {
    rating: number;
    distance: number;
    reliability: number;
    completionRate: number;
    responseSpeed: number;
    repeatBonus: number;
  };
  distanceKm: number;
  estimatedTravelMinutes: number;
  isRepeatCleaner: boolean;
  isAvailable: boolean;
}

export interface MatchingResult {
  matches: CleanerMatch[];
  totalCandidates: number;
  filtersSummary: {
    availableCount: number;
    inServiceAreaCount: number;
    qualifiedCount: number;
  };
}

// ─── Weights ────────────────────────────────────────────────────

const WEIGHTS = {
  rating: 0.3, // 30%
  distance: 0.2, // 20%
  reliability: 0.15, // 15%
  completionRate: 0.15, // 15%
  responseSpeed: 0.1, // 10%
  repeatBonus: 0.1, // 10%
};

// ─── Service ────────────────────────────────────────────────────

export class MatchingService {
  /**
   * Find and rank cleaners for a booking
   */
  static async findMatches(criteria: MatchingCriteria): Promise<MatchingResult> {
    // 1. Get all active, verified cleaners who have acknowledged the CURRENT
    //    self-employment version (A14 gate — un-acknowledged or out-of-date
    //    cleaners aren't offered jobs until they (re-)acknowledge).
    const allCleaners = await prisma.cleanerProfile.findMany({
      where: {
        verified: true,
        acknowledgmentVersion: CURRENT_AGREEMENT_VERSION,
        user: { isDeleted: false, accountStatus: 'ACTIVE' },
      },
      // Matching is a coverage consumer — re-enable the globally-omitted
      // isochrone for cleanerCoversPoint.
      omit: { catchmentPolygon: false },
      include: {
        user: true,
        availabilitySlots: true,
      },
    });

    const totalCandidates = allCleaners.length;

    // 2. Filter by availability (day of week). Time-first discovery skips this so
    //    the caller can apply the accurate timesheet gate (date-slots + overrides).
    const dayOfWeek = criteria.date.getDay();
    const availableCleaners = criteria.skipAvailabilityFilter
      ? allCleaners
      : allCleaners.filter((cleaner) =>
          cleaner.availabilitySlots.some((slot) => {
            if (slot.dayOfWeek !== dayOfWeek) return false;
            const slotStart = this.timeToMinutes(slot.startTime);
            const slotEnd = this.timeToMinutes(slot.endTime);
            const bookingStart = this.timeToMinutes(criteria.startTime);
            const bookingEnd = bookingStart + criteria.duration * 60;
            return bookingStart >= slotStart && bookingEnd <= slotEnd;
          })
        );

    // 3. Filter by service area — REAL coverage: a cleaner serves the booking when
    //    their home point is within their own max travel time (fallback: radius) of the
    //    customer's postcode. This is the SAME mechanism /api/cleaners and the cleaner
    //    grid use (geocode → haversine miles → travel-time), so every discovery path
    //    agrees on who serves an area. Previously this matched the DEPRECATED `location`
    //    outward-code prefix, which dropped every cleaner serving the area from a
    //    different outward code — the time-first "no cleaners" bug. Cleaners with no
    //    geocoded home serve no one → excluded (mirrors the /api/cleaners gate).
    const customerGeo = criteria.location ?? (await lookupPostcode(criteria.postcode));
    const inServiceArea = customerGeo
      ? availableCleaners.filter((cleaner) => {
          if (cleaner.latitude === null || cleaner.longitude === null) return false;
          const distanceMiles = haversineDistance(
            customerGeo.latitude,
            customerGeo.longitude,
            cleaner.latitude,
            cleaner.longitude
          );
          // B: polygon-first coverage (stored isochrone → point-in-polygon),
          // crow-flies fallback inside — same predicate as search/covers.
          return cleanerCoversPoint(
            cleaner,
            customerGeo.latitude,
            customerGeo.longitude,
            distanceMiles
          );
        })
      : // Geocode unavailable (unresolvable postcode / lookup outage) — fall back to the
        // legacy outward-code match so discovery degrades gracefully instead of empty.
        availableCleaners.filter((cleaner) => {
          if (!cleaner.location) return true;
          const bookingPrefix = criteria.postcode.split(' ')[0].toUpperCase();
          const areas = cleaner.location.split(',').map((a) => a.trim().toUpperCase());
          return areas.some(
            (area) => bookingPrefix.startsWith(area) || area.startsWith(bookingPrefix)
          );
        });

    // 4. Filter by service type qualification
    const qualified = inServiceArea.filter((cleaner) => {
      if (!cleaner.serviceTypes || cleaner.serviceTypes.length === 0) return true;
      const slugMap: Record<string, string> = {
        regular: 'regular',
        standard: 'regular',
        deep: 'deep',
        'same-day': 'same_day',
        same_day: 'same_day',
        'end-of-tenancy': 'end_of_tenancy',
        end_of_tenancy: 'end_of_tenancy',
        airbnb: 'airbnb',
      };
      const slug = slugMap[criteria.serviceType] || criteria.serviceType;
      return cleaner.serviceTypes.includes(slug);
    });

    // 5. Check for overlapping bookings
    const startOfDay = new Date(criteria.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(criteria.date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await prisma.booking.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
        cleanerId: { in: qualified.map((c) => c.userId) },
      },
    });

    const bookingsByCleanerId = new Map<string, typeof existingBookings>();
    for (const booking of existingBookings) {
      const list = bookingsByCleanerId.get(booking.cleanerId) ?? [];
      list.push(booking);
      bookingsByCleanerId.set(booking.cleanerId, list);
    }

    // 6. Check repeat cleaner status
    let repeatCleanerIds = new Set<string>();
    if (criteria.clientId) {
      const previousBookings = await prisma.booking.findMany({
        where: {
          clientId: criteria.clientId,
          status: 'COMPLETED',
        },
        select: { cleanerId: true },
        distinct: ['cleanerId'],
      });
      repeatCleanerIds = new Set(previousBookings.map((b) => b.cleanerId));
    }

    // 7. Score and rank
    const bookingStart = this.timeToMinutes(criteria.startTime);
    const bookingEnd = bookingStart + criteria.duration * 60;

    const matches: CleanerMatch[] = qualified.map((cleaner) => {
      // Check availability (no overlapping bookings)
      const cleanerBookings = bookingsByCleanerId.get(cleaner.userId) ?? [];
      const isAvailable = !cleanerBookings.some((b) => {
        const bStart = this.timeToMinutes(b.startTime);
        const bEnd = bStart + Number(b.duration) * 60;
        return bookingStart < bEnd && bookingEnd > bStart;
      });

      // Calculate distance
      let distanceKm = 0;
      let travelMinutes = 0;
      if (criteria.location && cleaner.latitude && cleaner.longitude) {
        const cleanerCoords: LocationCoords = {
          latitude: cleaner.latitude,
          longitude: cleaner.longitude,
        };
        const travel = TravelTimeService.estimateTravelTime(cleanerCoords, criteria.location);
        distanceKm = travel.distanceKm;
        travelMinutes = travel.durationMinutes;
      }

      const isRepeat = repeatCleanerIds.has(cleaner.userId);

      // Score components (all normalized to 0-1)
      const ratingScore = Number(cleaner.rating) / 5;
      let distanceScore: number;
      if (travelMinutes > 0 && cleaner.maxTravelMinutes) {
        distanceScore = Math.max(0, 1 - travelMinutes / cleaner.maxTravelMinutes);
      } else if (distanceKm > 0) {
        distanceScore = Math.max(0, 1 - distanceKm / (cleaner.radius || 10));
      } else {
        distanceScore = 0.5;
      }
      const reliabilityScore = (100 - Number(cleaner.cancellationRate || 0)) / 100;
      const completionRateScore = Number(cleaner.completionRate || 100) / 100;
      const responseSpeedScore = cleaner.responseSpeed
        ? Math.max(0, 1 - cleaner.responseSpeed / 3600) // Normalized: 0-1 hour response
        : 0.5;
      const repeatBonus = isRepeat ? 1.0 : 0;

      // Weighted total
      const totalScore =
        ratingScore * WEIGHTS.rating +
        distanceScore * WEIGHTS.distance +
        reliabilityScore * WEIGHTS.reliability +
        completionRateScore * WEIGHTS.completionRate +
        responseSpeedScore * WEIGHTS.responseSpeed +
        repeatBonus * WEIGHTS.repeatBonus;

      return {
        cleanerId: cleaner.id,
        userId: cleaner.userId,
        name: cleaner.user.name ?? 'Unknown',
        rating: Number(cleaner.rating),
        hourlyRateRegular: Number(cleaner.hourlyRateRegular),
        tier: cleaner.tier,
        totalScore: Math.round(totalScore * 1000) / 1000,
        scores: {
          rating: Math.round(ratingScore * 100) / 100,
          distance: Math.round(distanceScore * 100) / 100,
          reliability: Math.round(reliabilityScore * 100) / 100,
          completionRate: Math.round(completionRateScore * 100) / 100,
          responseSpeed: Math.round(responseSpeedScore * 100) / 100,
          repeatBonus,
        },
        distanceKm,
        estimatedTravelMinutes: travelMinutes,
        isRepeatCleaner: isRepeat,
        isAvailable,
      };
    });

    // Sort: available first, then by score
    matches.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      return b.totalScore - a.totalScore;
    });

    // Preferred cleaner boost — move to top if available
    if (criteria.preferredCleanerId) {
      const prefIdx = matches.findIndex(
        (m) => m.userId === criteria.preferredCleanerId && m.isAvailable
      );
      if (prefIdx > 0) {
        const [preferred] = matches.splice(prefIdx, 1);
        matches.unshift(preferred);
      }
    }

    return {
      matches,
      totalCandidates,
      filtersSummary: {
        availableCount: availableCleaners.length,
        inServiceAreaCount: inServiceArea.length,
        qualifiedCount: qualified.length,
      },
    };
  }

  /**
   * Auto-select the best available cleaner
   */
  static async autoAssign(criteria: MatchingCriteria): Promise<CleanerMatch | null> {
    const result = await this.findMatches(criteria);
    const available = result.matches.filter((m) => m.isAvailable);
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Get match score explanation for a specific cleaner
   */
  static explainScore(match: CleanerMatch): string[] {
    const explanations: string[] = [];

    if (match.scores.rating >= 0.9) explanations.push('Exceptional rating (4.5+/5)');
    else if (match.scores.rating >= 0.8) explanations.push('Excellent rating (4.0+/5)');

    if (match.scores.distance >= 0.8) explanations.push('Very close to your location');
    else if (match.scores.distance >= 0.5) explanations.push('Within reasonable distance');

    if (match.scores.reliability >= 0.95)
      explanations.push('Highly reliable (low cancellation rate)');

    if (match.scores.completionRate >= 0.95) explanations.push('Excellent job completion rate');

    if (match.scores.responseSpeed >= 0.8) explanations.push('Fast response times');

    if (match.isRepeatCleaner) explanations.push('Has cleaned for you before');

    return explanations;
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
