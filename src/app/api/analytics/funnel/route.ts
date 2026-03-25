import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AnalyticsTrackingService } from '@/lib/services/analytics-tracking.service';
import type { FunnelType } from '@/lib/services/analytics-tracking.service';

// ─── GET /api/analytics/funnel?funnel=booking&from=2025-01-01&to=2025-12-31 ──

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const funnel = searchParams.get('funnel') as FunnelType | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const view = searchParams.get('view') ?? 'funnel'; // funnel | dropoffs | errors | timing

    if (!funnel || !['booking', 'cleaner_signup', 'client_signup'].includes(funnel)) {
      return NextResponse.json(
        { error: 'funnel query param required (booking, cleaner_signup, client_signup)' },
        { status: 400 }
      );
    }

    const dateFrom = from ? new Date(from) : undefined;
    const dateTo = to ? new Date(to) : undefined;

    let data;
    switch (view) {
      case 'dropoffs':
        data = await AnalyticsTrackingService.getDropOffAnalysis(funnel, dateFrom, dateTo);
        break;
      case 'errors':
        data = await AnalyticsTrackingService.getFormErrorAnalysis(funnel, dateFrom, dateTo);
        break;
      case 'timing':
        data = await AnalyticsTrackingService.getStepTimingAnalysis(funnel, dateFrom, dateTo);
        break;
      default:
        data = await AnalyticsTrackingService.getFunnelAnalytics(funnel, dateFrom, dateTo);
        break;
    }

    return NextResponse.json({ funnel, view, data });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Analytics] Funnel query error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}
