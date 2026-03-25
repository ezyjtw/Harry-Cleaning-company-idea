import { prisma } from '@/lib/db/prisma';

export type FunnelType = 'booking' | 'cleaner_signup' | 'client_signup';

export type EventType =
  | 'FUNNEL_STEP'
  | 'PAGE_VIEW'
  | 'FORM_INTERACTION'
  | 'DROP_OFF'
  | 'FORM_ERROR'
  | 'CONVERSION';

// Booking funnel steps
export const BOOKING_FUNNEL_STEPS = {
  LANDING_VIEW: { step: 1, name: 'landing_view' },
  POSTCODE_ENTERED: { step: 2, name: 'postcode_entered' },
  SERVICE_SELECTED: { step: 3, name: 'service_selected' },
  PROPERTY_DETAILS: { step: 4, name: 'property_details' },
  QUOTE_VIEWED: { step: 5, name: 'quote_viewed' },
  CLEANER_SELECTED: { step: 6, name: 'cleaner_selected' },
  BOOKING_DETAILS: { step: 7, name: 'booking_details' },
  CONTACT_INFO: { step: 8, name: 'contact_info' },
  PAYMENT_STARTED: { step: 9, name: 'payment_started' },
  BOOKING_CONFIRMED: { step: 10, name: 'booking_confirmed' },
} as const;

// Cleaner signup funnel steps
export const CLEANER_SIGNUP_STEPS = {
  JOIN_PAGE_VIEW: { step: 1, name: 'join_page_view' },
  PERSONAL_INFO: { step: 2, name: 'personal_info' },
  EXPERIENCE: { step: 3, name: 'experience' },
  PRICING: { step: 4, name: 'pricing' },
  IDENTITY_VERIFICATION: { step: 5, name: 'identity_verification' },
  PAYOUT_SETUP: { step: 6, name: 'payout_setup' },
  REVIEW_SUBMIT: { step: 7, name: 'review_submit' },
  APPLICATION_COMPLETE: { step: 8, name: 'application_complete' },
} as const;

// Client signup funnel steps
export const CLIENT_SIGNUP_STEPS = {
  SIGNUP_PAGE_VIEW: { step: 1, name: 'signup_page_view' },
  EMAIL_ENTERED: { step: 2, name: 'email_entered' },
  PASSWORD_SET: { step: 3, name: 'password_set' },
  PROFILE_COMPLETED: { step: 4, name: 'profile_completed' },
  SIGNUP_COMPLETE: { step: 5, name: 'signup_complete' },
} as const;

interface TrackEventParams {
  sessionId: string;
  userId?: string;
  eventType: EventType;
  funnel?: FunnelType;
  funnelStep?: number;
  stepName?: string;
  page?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  deviceType?: string;
  browser?: string;
  ipAddress?: string;
  duration?: number;
}

export class AnalyticsTrackingService {
  /**
   * Track a single analytics event
   */
  static async track(params: TrackEventParams) {
    try {
      return await prisma.analyticsEvent.create({
        data: {
          sessionId: params.sessionId,
          userId: params.userId,
          eventType: params.eventType,
          funnel: params.funnel,
          funnelStep: params.funnelStep,
          stepName: params.stepName,
          page: params.page,
          referrer: params.referrer,
          metadata: params.metadata as Record<string, string> | undefined,
          deviceType: params.deviceType,
          browser: params.browser,
          ipAddress: params.ipAddress,
          duration: params.duration,
        },
      });
    } catch (error) {
      // Analytics should never break the main flow
      // eslint-disable-next-line no-console
      console.error('[AnalyticsTracking] Failed to track event:', error);
      return null;
    }
  }

  /**
   * Track a funnel step with automatic drop-off detection
   */
  static async trackFunnelStep(params: {
    sessionId: string;
    userId?: string;
    funnel: FunnelType;
    funnelStep: number;
    stepName: string;
    page?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    duration?: number;
  }) {
    return this.track({
      ...params,
      eventType: 'FUNNEL_STEP',
    });
  }

  /**
   * Track when a user drops off (closes page, navigates away, or times out)
   */
  static async trackDropOff(params: {
    sessionId: string;
    userId?: string;
    funnel: FunnelType;
    funnelStep: number;
    stepName: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    duration?: number;
  }) {
    return this.track({
      ...params,
      eventType: 'DROP_OFF',
    });
  }

  /**
   * Track a form interaction (field focus, validation error, etc.)
   */
  static async trackFormInteraction(params: {
    sessionId: string;
    userId?: string;
    funnel?: FunnelType;
    page?: string;
    metadata: Record<string, unknown>; // e.g. { field: "email", action: "focus" | "blur" | "error", errorMessage?: string }
    ipAddress?: string;
  }) {
    return this.track({
      ...params,
      eventType: 'FORM_INTERACTION',
    });
  }

  /**
   * Get funnel conversion data for a specific funnel
   */
  static async getFunnelAnalytics(funnel: FunnelType, dateFrom?: Date, dateTo?: Date) {
    const where: Record<string, unknown> = {
      funnel,
      eventType: 'FUNNEL_STEP',
    };

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    // Get unique sessions per step
    const stepData = await prisma.analyticsEvent.groupBy({
      by: ['funnelStep', 'stepName'],
      where: where as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { sessionId: true },
    });

    // Get unique sessions (not duplicate counts)
    const uniqueSessionsByStep = await Promise.all(
      stepData.map(async (step) => {
        const uniqueSessions = await prisma.analyticsEvent.findMany({
          where: {
            funnel,
            eventType: 'FUNNEL_STEP',
            funnelStep: step.funnelStep,
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                  },
                }
              : {}),
          },
          distinct: ['sessionId'],
          select: { sessionId: true },
        });

        return {
          step: step.funnelStep,
          stepName: step.stepName,
          uniqueSessions: uniqueSessions.length,
        };
      })
    );

    // Sort by step number
    const sorted = uniqueSessionsByStep
      .filter((s) => s.step !== null)
      .sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

    // Calculate conversion rates between steps
    return sorted.map((step, index) => {
      const previousSessions = index > 0 ? sorted[index - 1].uniqueSessions : step.uniqueSessions;
      const dropOffRate =
        previousSessions > 0
          ? Math.round(((previousSessions - step.uniqueSessions) / previousSessions) * 10000) / 100
          : 0;
      const conversionRate =
        sorted[0].uniqueSessions > 0
          ? Math.round((step.uniqueSessions / sorted[0].uniqueSessions) * 10000) / 100
          : 0;

      return {
        step: step.step,
        stepName: step.stepName,
        uniqueSessions: step.uniqueSessions,
        dropOffRate,
        overallConversionRate: conversionRate,
      };
    });
  }

  /**
   * Get drop-off reasons — what step people leave on and any metadata
   */
  static async getDropOffAnalysis(funnel: FunnelType, dateFrom?: Date, dateTo?: Date) {
    const where: Record<string, unknown> = {
      funnel,
      eventType: 'DROP_OFF',
    };

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const dropOffs = await prisma.analyticsEvent.groupBy({
      by: ['funnelStep', 'stepName'],
      where: where as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { sessionId: true },
      _avg: { duration: true },
    });

    return dropOffs
      .filter((d) => d.funnelStep !== null)
      .sort((a, b) => (b._count.sessionId ?? 0) - (a._count.sessionId ?? 0))
      .map((d) => ({
        step: d.funnelStep,
        stepName: d.stepName,
        dropOffCount: d._count.sessionId,
        avgTimeOnStep: d._avg.duration ? Math.round(d._avg.duration) : null,
      }));
  }

  /**
   * Get form error analytics — which fields cause the most friction
   */
  static async getFormErrorAnalysis(funnel?: FunnelType, dateFrom?: Date, dateTo?: Date) {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        eventType: 'FORM_ERROR',
        ...(funnel ? { funnel } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      select: { metadata: true, stepName: true },
    });

    // Aggregate error counts by field
    const errorCounts: Record<string, { count: number; messages: Record<string, number> }> = {};
    for (const event of events) {
      const meta = event.metadata as Record<string, string> | null;
      const field = meta?.field ?? 'unknown';
      const message = meta?.errorMessage ?? 'unknown';

      if (!errorCounts[field]) {
        errorCounts[field] = { count: 0, messages: {} };
      }
      errorCounts[field].count++;
      errorCounts[field].messages[message] = (errorCounts[field].messages[message] ?? 0) + 1;
    }

    return Object.entries(errorCounts)
      .map(([field, data]) => ({
        field,
        errorCount: data.count,
        topErrors: Object.entries(data.messages)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([message, count]) => ({ message, count })),
      }))
      .sort((a, b) => b.errorCount - a.errorCount);
  }

  /**
   * Get average time spent on each funnel step
   */
  static async getStepTimingAnalysis(funnel: FunnelType, dateFrom?: Date, dateTo?: Date) {
    const timings = await prisma.analyticsEvent.groupBy({
      by: ['funnelStep', 'stepName'],
      where: {
        funnel,
        eventType: 'FUNNEL_STEP',
        duration: { not: null },
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      _avg: { duration: true },
      _max: { duration: true },
      _min: { duration: true },
      _count: { sessionId: true },
    });

    return timings
      .filter((t) => t.funnelStep !== null)
      .sort((a, b) => (a.funnelStep ?? 0) - (b.funnelStep ?? 0))
      .map((t) => ({
        step: t.funnelStep,
        stepName: t.stepName,
        avgDuration: t._avg.duration ? Math.round(t._avg.duration) : null,
        maxDuration: t._max.duration,
        minDuration: t._min.duration,
        sampleSize: t._count.sessionId,
      }));
  }
}
