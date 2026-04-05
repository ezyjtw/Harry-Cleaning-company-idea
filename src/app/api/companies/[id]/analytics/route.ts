import { NextResponse } from 'next/server';

import { CompanyService } from '@/lib/services/company.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const metrics = await CompanyService.getCompanyPerformanceMetrics(id);
    return NextResponse.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
