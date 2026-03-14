import { prisma } from '@/lib/db/prisma';

export interface WeeklySchedule {
  dayOfWeek: number; // 0-6
  startTime: string;
  endTime: string;
}

export interface DateBlock {
  date: Date;
  reason?: string;
  isPartialDay?: boolean;
  startTime?: string;
  endTime?: string;
}

export class AvailabilityService {
  /**
   * Get full weekly schedule for a cleaner
   */
  static async getWeeklySchedule(cleanerProfileId: string): Promise<WeeklySchedule[]> {
    const slots = await prisma.availabilitySlot.findMany({
      where: { cleanerProfileId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  /**
   * Set weekly schedule (replaces existing)
   */
  static async setWeeklySchedule(cleanerProfileId: string, schedule: WeeklySchedule[]) {
    // Delete existing slots and create new ones in a transaction
    await prisma.$transaction([
      prisma.availabilitySlot.deleteMany({ where: { cleanerProfileId } }),
      ...schedule.map((slot) =>
        prisma.availabilitySlot.create({
          data: {
            cleanerProfileId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
      ),
    ]);
  }

  /**
   * Block a specific date
   */
  static async blockDate(cleanerProfileId: string, block: DateBlock) {
    return prisma.availabilityOverride.upsert({
      where: {
        cleanerProfileId_date: {
          cleanerProfileId,
          date: block.date,
        },
      },
      create: {
        cleanerProfileId,
        date: block.date,
        isBlocked: true,
        reason: block.reason,
        startTime: block.isPartialDay ? block.startTime : null,
        endTime: block.isPartialDay ? block.endTime : null,
      },
      update: {
        isBlocked: true,
        reason: block.reason,
        startTime: block.isPartialDay ? block.startTime : null,
        endTime: block.isPartialDay ? block.endTime : null,
      },
    });
  }

  /**
   * Unblock a specific date
   */
  static async unblockDate(cleanerProfileId: string, date: Date) {
    return prisma.availabilityOverride.deleteMany({
      where: { cleanerProfileId, date },
    });
  }

  /**
   * Block a date range (e.g. holiday)
   */
  static async blockDateRange(
    cleanerProfileId: string,
    startDate: Date,
    endDate: Date,
    reason?: string
  ) {
    const blocks: DateBlock[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      blocks.push({ date: new Date(current), reason });
      current.setDate(current.getDate() + 1);
    }

    for (const block of blocks) {
      await this.blockDate(cleanerProfileId, block);
    }

    return blocks.length;
  }

  /**
   * Get blocked dates for a cleaner within a date range
   */
  static async getBlockedDates(cleanerProfileId: string, from: Date, to: Date) {
    return prisma.availabilityOverride.findMany({
      where: {
        cleanerProfileId,
        date: { gte: from, lte: to },
        isBlocked: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Check if a cleaner is available on a specific date/time
   */
  static async isAvailable(
    cleanerProfileId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    // Check blocked dates
    const override = await prisma.availabilityOverride.findFirst({
      where: {
        cleanerProfileId,
        date,
        isBlocked: true,
      },
    });

    if (override) {
      // If partial block, check if requested time conflicts
      if (override.startTime && override.endTime) {
        const blockStart = this.timeToMinutes(override.startTime);
        const blockEnd = this.timeToMinutes(override.endTime);
        const reqStart = this.timeToMinutes(startTime);
        const reqEnd = this.timeToMinutes(endTime);
        if (reqStart < blockEnd && reqEnd > blockStart) return false;
      } else {
        return false; // Full day blocked
      }
    }

    // Check weekly schedule
    const dayOfWeek = date.getDay();
    const slots = await prisma.availabilitySlot.findMany({
      where: { cleanerProfileId, dayOfWeek },
    });

    if (slots.length === 0) return false;

    const reqStart = this.timeToMinutes(startTime);
    const reqEnd = this.timeToMinutes(endTime);

    return slots.some((slot) => {
      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd = this.timeToMinutes(slot.endTime);
      return reqStart >= slotStart && reqEnd <= slotEnd;
    });
  }

  /**
   * Get availability summary for calendar display
   */
  static async getCalendarView(cleanerProfileId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [schedule, overrides, bookings] = await Promise.all([
      prisma.availabilitySlot.findMany({ where: { cleanerProfileId } }),
      prisma.availabilityOverride.findMany({
        where: { cleanerProfileId, date: { gte: startDate, lte: endDate } },
      }),
      prisma.booking.findMany({
        where: {
          cleaner: { cleanerProfile: { id: cleanerProfileId } },
          date: { gte: startDate, lte: endDate },
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    const days = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      const daySlots = schedule.filter((s) => s.dayOfWeek === dayOfWeek);
      const dayOverride = overrides.find((o) => o.date.toISOString().split('T')[0] === dateStr);
      const dayBookings = bookings.filter(
        (b) => new Date(b.date).toISOString().split('T')[0] === dateStr
      );

      days.push({
        date: dateStr,
        dayOfWeek,
        isAvailable: daySlots.length > 0 && !dayOverride?.isBlocked,
        isBlocked: dayOverride?.isBlocked ?? false,
        blockReason: dayOverride?.reason,
        slots: daySlots.map((s) => ({ start: s.startTime, end: s.endTime })),
        bookingCount: dayBookings.length,
        bookings: dayBookings.map((b) => ({
          id: b.id,
          startTime: b.startTime,
          duration: Number(b.duration),
          serviceType: b.serviceType,
          status: b.status,
        })),
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
