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

  const { holidayCantMake, blockHolidayDates } =
    await import('@/lib/services/occurrence-rescue.service');
  const result = await holidayCantMake({ cleanerId: user.id, startDate, endDate });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  // LB-1: also block the range so no NEW one-off bookings land while away.
  const { blocked } = await blockHolidayDates({ cleanerId: user.id, startDate, endDate }).catch(
    () => ({ blocked: 0 })
  );
  return NextResponse.json({
    success: true,
    flagged: result.flagged,
    customers: result.customers,
    blocked,
    message:
      (result.flagged === 0
        ? 'No regular cleans fall in that range.'
        : `${result.flagged} regular clean(s) flagged — ${result.customers} customer(s) have been asked to choose. Your arrangements are unchanged.`) +
      (blocked > 0
        ? ` ${blocked} date(s) blocked in your availability — unblock them any time under Blocked Dates.`
        : ''),
  });
}
