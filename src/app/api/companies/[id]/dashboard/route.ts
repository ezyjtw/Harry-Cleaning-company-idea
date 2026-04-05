import { NextResponse } from 'next/server';

import { getCompanyMemberSession } from '@/lib/auth/session';
import { CompanyService } from '@/lib/services/company.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const user = await getCompanyMemberSession(id);
    if (!user) {
      return NextResponse.json({ error: 'Access denied. You must be a member of this company.' }, { status: 403 });
    }

    const dashboard = await CompanyService.getCompanyDashboard(id);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
