import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';

// R1-C: holiday range — flags every occurrence of this cleaner's agreements in
// the range at once; each affected customer gets ONE batched email. This does
// NOT touch availability/blocked dates — block the dates separately as usual.
export async function POST(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const startDate = String(body?.startDate ?? '');
  const endDate = String(body?.endDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { error: 'startDate and endDate (YYYY-MM-DD) required' },
      { status: 400 }
    );
  }

  const { holidayCantMake } = await import('@/lib/services/occurrence-rescue.service');
  const result = await holidayCantMake({ cleanerId: user.id, startDate, endDate });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    flagged: result.flagged,
    customers: result.customers,
    message:
      result.flagged === 0
        ? 'No regular cleans fall in that range.'
        : `${result.flagged} regular clean(s) flagged — ${result.customers} customer(s) have been asked to choose. Your arrangements are unchanged.`,
  });
}
