/**
 * AI-powered schedule optimization for cleaners.
 * Reorders jobs to minimize travel time and fill gaps.
 */

import { TravelTimeService } from '@/lib/services/travel-time.service';
import type { LocationCoords } from '@/lib/services/travel-time.service';

export interface ScheduledJob {
  id: string;
  startTime: string; // "HH:mm"
  duration: number; // hours
  location: LocationCoords;
  address: string;
  serviceType: string;
  isFixed?: boolean; // Some jobs can't be moved
}

export interface OptimizedSchedule {
  jobs: ScheduledJob[];
  totalTravelKm: number;
  totalTravelMinutes: number;
  gapsFound: number;
  optimizationSavings: {
    distanceSavedKm: number;
    timeSavedMinutes: number;
  };
  suggestions: string[];
}

export class SchedulingOptimizer {
  /**
   * Optimize job order to minimize travel time
   * Uses nearest-neighbor heuristic for route optimization
   */
  static optimize(jobs: ScheduledJob[], cleanerHomeLocation?: LocationCoords): OptimizedSchedule {
    if (jobs.length <= 1) {
      return {
        jobs,
        totalTravelKm: 0,
        totalTravelMinutes: 0,
        gapsFound: 0,
        optimizationSavings: { distanceSavedKm: 0, timeSavedMinutes: 0 },
        suggestions: [],
      };
    }

    // Separate fixed and movable jobs
    const fixed = jobs.filter((j) => j.isFixed);
    const movable = jobs.filter((j) => !j.isFixed);

    // Calculate original route distance
    const originalDistance = this.calculateTotalDistance(jobs);

    // Optimize movable jobs using nearest-neighbor
    const optimized = this.nearestNeighborSort(movable, cleanerHomeLocation);

    // Merge fixed jobs back in at their original positions
    const finalSchedule = this.mergeFixedJobs(optimized, fixed);

    // Calculate optimized distance
    const optimizedDistance = this.calculateTotalDistance(finalSchedule);

    // Generate suggestions
    const suggestions = this.generateSuggestions(finalSchedule, cleanerHomeLocation);

    // Count gaps
    const gaps = this.findGaps(finalSchedule);

    return {
      jobs: finalSchedule,
      totalTravelKm: Math.round(optimizedDistance * 100) / 100,
      totalTravelMinutes: Math.round((optimizedDistance / 20) * 60), // ~20 km/h average
      gapsFound: gaps.length,
      optimizationSavings: {
        distanceSavedKm: Math.round((originalDistance - optimizedDistance) * 100) / 100,
        timeSavedMinutes: Math.round(((originalDistance - optimizedDistance) / 20) * 60),
      },
      suggestions,
    };
  }

  /**
   * Suggest optimal routes for a day's jobs
   */
  static suggestRoute(jobs: ScheduledJob[]): string[] {
    const route: string[] = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const nextJob = jobs[i + 1];

      route.push(
        `${i + 1}. ${job.startTime} - ${job.address} (${job.serviceType}, ${job.duration}h)`
      );

      if (nextJob) {
        const travel = TravelTimeService.estimateTravelTime(job.location, nextJob.location);
        route.push(`   → Travel: ${travel.durationMinutes} min (${travel.distanceKm} km)`);
      }
    }
    return route;
  }

  /**
   * Find schedule gaps that could be filled
   */
  static findGaps(
    jobs: ScheduledJob[],
    minGapMinutes: number = 60
  ): Array<{ after: string; before: string; gapMinutes: number }> {
    const gaps: Array<{ after: string; before: string; gapMinutes: number }> = [];
    const sorted = [...jobs].sort(
      (a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = this.timeToMinutes(sorted[i].startTime) + sorted[i].duration * 60;
      const nextStart = this.timeToMinutes(sorted[i + 1].startTime);
      const gap = nextStart - currentEnd;

      if (gap >= minGapMinutes) {
        gaps.push({
          after: sorted[i].id,
          before: sorted[i + 1].id,
          gapMinutes: gap,
        });
      }
    }

    return gaps;
  }

  // ─── Private helpers ──────────────────────────────────────

  private static nearestNeighborSort(
    jobs: ScheduledJob[],
    startLocation?: LocationCoords
  ): ScheduledJob[] {
    if (jobs.length === 0) return [];

    const remaining = [...jobs];
    const sorted: ScheduledJob[] = [];

    // Start from the job nearest to home, or first job
    let currentLocation = startLocation ?? jobs[0].location;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = TravelTimeService.calculateDistance(
          currentLocation,
          remaining[i].location
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIdx = i;
        }
      }

      const nearest = remaining.splice(nearestIdx, 1)[0];
      sorted.push(nearest);
      currentLocation = nearest.location;
    }

    return sorted;
  }

  private static mergeFixedJobs(optimized: ScheduledJob[], fixed: ScheduledJob[]): ScheduledJob[] {
    const merged = [...optimized];
    for (const fixedJob of fixed) {
      const insertIdx = merged.findIndex(
        (j) => this.timeToMinutes(j.startTime) > this.timeToMinutes(fixedJob.startTime)
      );
      if (insertIdx === -1) {
        merged.push(fixedJob);
      } else {
        merged.splice(insertIdx, 0, fixedJob);
      }
    }
    return merged;
  }

  private static calculateTotalDistance(jobs: ScheduledJob[]): number {
    let total = 0;
    for (let i = 0; i < jobs.length - 1; i++) {
      total += TravelTimeService.calculateDistance(jobs[i].location, jobs[i + 1].location);
    }
    return total;
  }

  private static generateSuggestions(
    jobs: ScheduledJob[],
    homeLocation?: LocationCoords
  ): string[] {
    const suggestions: string[] = [];

    if (jobs.length >= 4) {
      suggestions.push('Consider grouping nearby jobs together to reduce travel time.');
    }

    const gaps = this.findGaps(jobs, 90);
    if (gaps.length > 0) {
      suggestions.push(
        `You have ${gaps.length} gap(s) of 90+ minutes that could fit additional bookings.`
      );
    }

    if (homeLocation && jobs.length > 0) {
      const lastJob = jobs[jobs.length - 1];
      const homeDistance = TravelTimeService.calculateDistance(lastJob.location, homeLocation);
      if (homeDistance > 10) {
        suggestions.push(
          `Your last job is ${Math.round(homeDistance)}km from home. Consider ending closer to home.`
        );
      }
    }

    return suggestions;
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
