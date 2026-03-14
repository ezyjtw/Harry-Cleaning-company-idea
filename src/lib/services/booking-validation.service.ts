import { prisma } from '@/lib/db/prisma';

export interface BookingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BookingRequest {
  cleanerId: string;
  date: Date;
  startTime: string; // "HH:mm"
  duration: number; // hours
  serviceType: string;
  addressPostcode: string;
}

export class BookingValidationService {
  /**
   * Validate a complete booking request
   */
  static async validate(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate booking is in the future
    const bookingDateTime = this.parseDateTime(request.date, request.startTime);
    if (bookingDateTime <= new Date()) {
      errors.push('Booking must be in the future');
    }

    // 2. Validate minimum booking duration
    if (request.duration < 1) {
      errors.push('Minimum booking duration is 1 hour');
    }
    if (request.duration > 10) {
      errors.push('Maximum booking duration is 10 hours');
    }

    // 3. Check cleaner exists and is active
    const cleaner = await prisma.cleanerProfile.findUnique({
      where: { userId: request.cleanerId },
      include: { user: true },
    });

    if (!cleaner) {
      errors.push('Cleaner not found');
      return { valid: false, errors, warnings };
    }

    if (!cleaner.verified) {
      errors.push('Cleaner is not verified');
    }

    // 4. Check cleaner availability for the day
    const dayOfWeek = request.date.getDay();
    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { cleanerProfileId: cleaner.id, dayOfWeek },
    });

    if (availabilitySlots.length === 0) {
      errors.push('Cleaner is not available on this day');
    } else {
      const isWithinSlot = availabilitySlots.some((slot) => {
        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        const bookingStart = this.timeToMinutes(request.startTime);
        const bookingEnd = bookingStart + request.duration * 60;
        return bookingStart >= slotStart && bookingEnd <= slotEnd;
      });

      if (!isWithinSlot) {
        errors.push('Booking time is outside cleaner availability hours');
      }
    }

    // 5. Check for availability overrides (blocked days)
    const override = await prisma.availabilityOverride.findFirst({
      where: {
        cleanerProfileId: cleaner.id,
        date: request.date,
        isBlocked: true,
      },
    });

    if (override) {
      errors.push('Cleaner has blocked this date');
    }

    // 6. Check for overlapping bookings
    const overlapping = await this.findOverlappingBookings(
      request.cleanerId,
      request.date,
      request.startTime,
      request.duration
    );

    if (overlapping.length > 0) {
      errors.push('Booking conflicts with an existing booking');
    }

    // 7. Check service area
    if (cleaner.location) {
      const cleanerAreas = cleaner.location.split(',').map((a) => a.trim().toUpperCase());
      const bookingPrefix = request.addressPostcode.split(' ')[0].toUpperCase();
      if (!cleanerAreas.some((area) => bookingPrefix.startsWith(area))) {
        warnings.push('Booking address may be outside cleaner service area');
      }
    }

    // 8. Check minimum gap between bookings
    const nearbyBookings = await this.findNearbyBookings(
      request.cleanerId,
      request.date,
      request.startTime
    );
    if (nearbyBookings.tooClose) {
      warnings.push(
        'Less than 30 minutes between this and another booking — travel time may be tight'
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Find bookings that overlap with the requested time
   */
  static async findOverlappingBookings(
    cleanerId: string,
    date: Date,
    startTime: string,
    duration: number
  ) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await prisma.booking.findMany({
      where: {
        cleanerId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
    });

    const requestStart = this.timeToMinutes(startTime);
    const requestEnd = requestStart + duration * 60;

    return existingBookings.filter((booking) => {
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = bookingStart + Number(booking.duration) * 60;
      return requestStart < bookingEnd && requestEnd > bookingStart;
    });
  }

  /**
   * Check if there's adequate travel time between bookings
   */
  static async findNearbyBookings(
    cleanerId: string,
    date: Date,
    startTime: string
  ): Promise<{ tooClose: boolean; gap: number }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        cleanerId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { startTime: 'asc' },
    });

    const requestStartMins = this.timeToMinutes(startTime);
    const MIN_GAP_MINUTES = 30;

    for (const booking of bookings) {
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = bookingStart + Number(booking.duration) * 60;
      const gap = Math.min(
        Math.abs(requestStartMins - bookingEnd),
        Math.abs(bookingStart - requestStartMins)
      );

      if (gap < MIN_GAP_MINUTES && gap > 0) {
        return { tooClose: true, gap };
      }
    }

    return { tooClose: false, gap: MIN_GAP_MINUTES };
  }

  // Helper methods
  private static parseDateTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(hours, minutes, 0, 0);
    return dt;
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
