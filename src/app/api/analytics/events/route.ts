import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AnalyticsTrackingService } from '@/lib/services/analytics-tracking.service';

const VALID_EVENT_TYPES = [
  'FUNNEL_STEP',
  'PAGE_VIEW',
  'FORM_INTERACTION',
  'DROP_OFF',
  'FORM_ERROR',
  'CONVERSION',
];

const VALID_FUNNELS = ['booking', 'cleaner_signup', 'client_signup'];

function sanitize(input: string): string {
  return input.trim().replace(/[<>]/g, '').slice(0, 500);
}

// ─── POST /api/analytics/events ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      userId,
      eventType,
      funnel,
      funnelStep,
      stepName,
      page,
      referrer,
      metadata,
      deviceType,
      browser,
      duration,
    } = body;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (funnel && !VALID_FUNNELS.includes(funnel)) {
      return NextResponse.json(
        { error: `funnel must be one of: ${VALID_FUNNELS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get IP from headers
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress =
      forwarded?.split(',').pop()?.trim() ?? request.headers.get('x-real-ip') ?? undefined;

    await AnalyticsTrackingService.track({
      sessionId: sanitize(sessionId),
      userId: userId ? sanitize(String(userId)) : undefined,
      eventType: eventType as Parameters<typeof AnalyticsTrackingService.track>[0]['eventType'],
      funnel: funnel as Parameters<typeof AnalyticsTrackingService.track>[0]['funnel'],
      funnelStep: funnelStep ? Number(funnelStep) : undefined,
      stepName: stepName ? sanitize(String(stepName)) : undefined,
      page: page ? sanitize(String(page)) : undefined,
      referrer: referrer ? sanitize(String(referrer)).slice(0, 2000) : undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      deviceType: deviceType ? sanitize(String(deviceType)) : undefined,
      browser: browser ? sanitize(String(browser)) : undefined,
      ipAddress,
      duration: duration ? Number(duration) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Analytics] Event capture error:', error);
    return NextResponse.json({ error: 'Failed to capture event' }, { status: 500 });
  }
}
