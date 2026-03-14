import { prisma } from '@/lib/db/prisma';

export interface SurgeInfo {
  isActive: boolean;
  multiplier: number;
  reason: 'peak_demand' | 'low_supply' | 'holiday' | 'weekend' | 'none';
  expiresAt?: Date;
}

// UK public holidays (approximate for 2026)
const UK_HOLIDAYS = [
  '01-01', // New Year's Day
  '04-03', // Good Friday
  '04-06', // Easter Monday
  '05-04', // Early May Bank Holiday
  '05-25', // Spring Bank Holiday
  '08-31', // Summer Bank Holiday
  '12-25', // Christmas Day
  '12-26', // Boxing Day
];

export class SurgePricingService {
  /**
   * Get current surge pricing info for a given date/time
   */
  static async getSurgeInfo(date: Date): Promise<SurgeInfo> {
    // 1. Check holidays
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (UK_HOLIDAYS.includes(monthDay)) {
      return { isActive: true, multiplier: 1.25, reason: 'holiday' };
    }

    // 2. Check weekends (Sunday premium)
    if (date.getDay() === 0) {
      return { isActive: true, multiplier: 1.15, reason: 'weekend' };
    }

    // 3. Check demand vs supply ratio
    const demandInfo = await this.checkDemandSupply(date);
    if (demandInfo.isHighDemand) {
      return {
        isActive: true,
        multiplier: demandInfo.suggestedMultiplier,
        reason: demandInfo.lowSupply ? 'low_supply' : 'peak_demand',
      };
    }

    return { isActive: false, multiplier: 1.0, reason: 'none' };
  }

  /**
   * Check demand vs supply for surge calculation
   */
  private static async checkDemandSupply(date: Date): Promise<{
    isHighDemand: boolean;
    lowSupply: boolean;
    suggestedMultiplier: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Count bookings for the day
    const bookingsCount = await prisma.booking.count({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
    });

    // Count available cleaners
    const dayOfWeek = date.getDay();
    const availableCleaners = await prisma.availabilitySlot.groupBy({
      by: ['cleanerProfileId'],
      where: { dayOfWeek },
    });

    const cleanerCount = availableCleaners.length;
    const utilizationRate = cleanerCount > 0 ? bookingsCount / (cleanerCount * 3) : 0; // Assume 3 bookings per cleaner max

    if (utilizationRate > 0.8) {
      return { isHighDemand: true, lowSupply: cleanerCount < 5, suggestedMultiplier: 1.2 };
    }

    if (utilizationRate > 0.6) {
      return { isHighDemand: true, lowSupply: false, suggestedMultiplier: 1.1 };
    }

    return { isHighDemand: false, lowSupply: false, suggestedMultiplier: 1.0 };
  }

  /**
   * Calculate dynamic pricing based on supply and demand
   */
  static calculateDynamicMultiplier(
    demandLevel: number, // 0-1 (percentage of capacity)
    supplyLevel: number // 0-1 (percentage of cleaners available)
  ): number {
    // Higher demand + lower supply = higher multiplier
    const demandFactor = Math.min(demandLevel * 0.3, 0.3); // max 30% from demand
    const supplyFactor = supplyLevel < 0.3 ? (0.3 - supplyLevel) * 0.5 : 0; // up to 15% from low supply

    return Math.round((1 + demandFactor + supplyFactor) * 100) / 100;
  }
}
