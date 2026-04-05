import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CompanyService } from '@/lib/services/company.service';
import { CompanyAnalyticsService } from '@/lib/services/company-analytics.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const full = searchParams.get('full') === 'true';
    const months = parseInt(searchParams.get('months') || '6');

    if (full) {
      const analytics = await CompanyAnalyticsService.getFullAnalytics(id, months);
      return NextResponse.json(analytics);
    }

    // Default: return the simpler performance metrics (used by dashboard)
    const metrics = await CompanyService.getCompanyPerformanceMetrics(id);
    return NextResponse.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
