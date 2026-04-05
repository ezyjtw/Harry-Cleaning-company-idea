import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCompanyMemberSession } from '@/lib/auth/session';
import { CompanyAnalyticsService } from '@/lib/services/company-analytics.service';
import { CompanyService } from '@/lib/services/company.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const user = await getCompanyMemberSession(id);
    if (!user) {
      return NextResponse.json({ error: 'Access denied. You must be a member of this company.' }, { status: 403 });
    }

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
