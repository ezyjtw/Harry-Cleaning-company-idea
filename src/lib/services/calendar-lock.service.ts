import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export interface CreateBookingParams {
  clientId: string;
  cleanerId: string;
  addressId: string;
  serviceType: string;
  date: Date;
  startTime: string;
  duration: number;
  rooms?: Record<string, unknown>;
  extras?: string[];
  frequency?: string;
  notes?: string;
  totalPrice: number;
  platformFee: number;
  cleanerEarnings: number;
}

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
}

export class CalendarLockService {
  /**
   * Create a booking using a database transaction to prevent race conditions.
   * Uses Prisma's interactive transactions with serializable isolation.
   */
  static async createBookingWithLock(params: CreateBookingParams): Promise<CreateBookingResult> {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Re-validate availability inside the transaction
          const overlapping = await tx.booking.findMany({
            where: {
              cleanerId: params.cleanerId,
              date: params.date,
              status: { notIn: ['CANCELLED'] },
            },
          });

          // Check for time conflicts
          const startMinutes = this.timeToMinutes(params.startTime);
          const endMinutes = startMinutes + params.duration * 60;

          const hasConflict = overlapping.some((b) => {
            const bStart = this.timeToMinutes(b.startTime);
            const bEnd = bStart + Number(b.duration) * 60;
            return startMinutes < bEnd && endMinutes > bStart;
          });

          if (hasConflict) {
            throw new Error('CONFLICT: Time slot is no longer available');
          }

          // 2. Check for availability override (blocked date)
          const cleaner = await tx.cleanerProfile.findUnique({
            where: { userId: params.cleanerId },
          });

          if (cleaner) {
            const override = await tx.availabilityOverride.findFirst({
              where: {
                cleanerProfileId: cleaner.id,
                date: params.date,
                isBlocked: true,
              },
            });

            if (override) {
              throw new Error('BLOCKED: Cleaner has blocked this date');
            }
          }

          // 3. Create the booking atomically
          const booking = await tx.booking.create({
            data: {
              clientId: params.clientId,
              cleanerId: params.cleanerId,
              addressId: params.addressId,
              serviceType: params.serviceType,
              date: params.date,
              startTime: params.startTime,
              duration: params.duration,
              rooms: params.rooms ? (params.rooms as Prisma.InputJsonValue) : undefined,
              extras: params.extras ?? [],
              frequency: params.frequency,
              notes: params.notes,
              totalPrice: params.totalPrice,
              platformFee: params.platformFee,
              cleanerEarnings: params.cleanerEarnings,
              status: 'PENDING',
            },
          });

          return booking;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000, // 10 seconds
        }
      );

      return { success: true, bookingId: result.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('CONFLICT') || message.includes('BLOCKED')) {
        return { success: false, error: message };
      }
      return { success: false, error: 'Failed to create booking. Please try again.' };
    }
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
