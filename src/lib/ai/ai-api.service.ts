/**
 * AI Platform API Service
 * Exposes endpoints for AI agent actions with safety controls.
 */

import { prisma } from '@/lib/db/prisma';

export interface AIActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// Rate limiting for AI actions
const AI_RATE_LIMITS = new Map<string, { count: number; resetAt: number }>();
const MAX_AI_REQUESTS_PER_MINUTE = 30;

export class AIApiService {
  /**
   * Check rate limit for AI requests
   */
  static checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = AI_RATE_LIMITS.get(userId);

    if (!entry || now > entry.resetAt) {
      AI_RATE_LIMITS.set(userId, { count: 1, resetAt: now + 60000 });
      return true;
    }

    entry.count++;
    return entry.count <= MAX_AI_REQUESTS_PER_MINUTE;
  }

  /**
   * Get available cleaners for AI booking
   */
  static async getAvailableCleaners(
    _date: string,
    _postcode: string,
    _serviceType?: string
  ): Promise<AIActionResult> {
    const cleaners = await prisma.cleanerProfile.findMany({
      where: {
        verified: true,
        user: { isDeleted: false, accountStatus: 'ACTIVE' },
      },
      include: {
        user: { select: { name: true, email: true } },
        availabilitySlots: true,
      },
      take: 10,
      orderBy: { rating: 'desc' },
    });

    return {
      success: true,
      data: {
        cleaners: cleaners.map((c) => ({
          id: c.userId,
          name: c.user.name,
          rating: Number(c.rating),
          hourlyRateRegular: Number(c.hourlyRateRegular),
          tier: c.tier,
          specialties: c.specialties,
        })),
        count: cleaners.length,
      },
    };
  }

  /**
   * Create a booking via AI (requires confirmation)
   */
  static async createBooking(params: {
    clientId: string;
    cleanerId: string;
    date: string;
    startTime: string;
    duration: number;
    serviceType: string;
    addressId: string;
  }): Promise<AIActionResult> {
    return {
      success: true,
      requiresConfirmation: true,
      confirmationMessage: `Please confirm: Book a ${params.serviceType} cleaning on ${params.date} at ${params.startTime} for ${params.duration} hours?`,
      data: params as unknown as Record<string, unknown>,
    };
  }

  /**
   * Cancel a booking via AI (requires confirmation)
   */
  static async cancelBooking(bookingId: string, userId: string): Promise<AIActionResult> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.clientId !== userId && booking.cleanerId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      requiresConfirmation: true,
      confirmationMessage: `Cancel booking ${bookingId}? This action cannot be undone.`,
      data: { bookingId, currentStatus: booking.status },
    };
  }

  /**
   * Get schedule for AI
   */
  static async getSchedule(
    cleanerId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<AIActionResult> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    const bookings = await prisma.booking.findMany({
      where: {
        cleanerId,
        date: { gte: from, lte: to },
        status: { notIn: ['CANCELLED'] },
      },
      include: { address: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return {
      success: true,
      data: {
        bookings: bookings.map((b) => ({
          id: b.id,
          date: b.date.toISOString().split('T')[0],
          startTime: b.startTime,
          duration: Number(b.duration),
          serviceType: b.serviceType,
          status: b.status,
          address: `${b.address?.line1 ?? ''}, ${b.address?.postcode ?? ''}`,
        })),
      },
    };
  }

  /**
   * Update availability via AI (requires confirmation for blocking)
   */
  static async updateAvailability(
    cleanerId: string,
    action: 'block' | 'unblock',
    date: string,
    reason?: string
  ): Promise<AIActionResult> {
    if (action === 'block') {
      return {
        success: true,
        requiresConfirmation: true,
        confirmationMessage: `Block ${date} from your availability${reason ? ` (reason: ${reason})` : ''}?`,
        data: { cleanerId, action, date, reason },
      };
    }

    // Unblocking doesn't require confirmation
    await prisma.availabilityOverride.deleteMany({
      where: { cleanerProfile: { userId: cleanerId }, date: new Date(date) },
    });

    return { success: true, data: { message: `${date} has been unblocked` } };
  }

  /**
   * Log AI agent action for audit trail
   */
  static async logAction(
    userId: string,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'AI_AGENT_ACTION',
        entityType: 'AIAgent',
        entityId: `ai_${Date.now()}`,
        metadata: { action, ...details } as Record<string, string>,
      },
    });
  }
}
