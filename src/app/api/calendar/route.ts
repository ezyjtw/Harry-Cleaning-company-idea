import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { generateICS } from '@/lib/utils/calendar';

/**
 * GET /api/calendar?title=...&date=...&time=...&duration=...&location=...&description=...
 *
 * Returns an .ics file download for adding a booking to any calendar app.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get('title') || 'Rena Cleaning';
  const date = params.get('date');
  const time = params.get('time') || '9:00 AM';
  const duration = parseFloat(params.get('duration') || '2');
  const location = params.get('location') || '';
  const description = params.get('description') || '';

  if (!date) {
    return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
  }

  const ics = generateICS({
    title,
    description,
    location,
    startDate: date,
    startTime: time,
    durationHours: duration,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="rena-booking.ics"`,
    },
  });
}
