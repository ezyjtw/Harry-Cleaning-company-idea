import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  getAvailableCleanersForBand,
  TIME_BANDS,
  type TimeBand,
} from '@/lib/services/availability-query.service';
import { isValidPostcode } from '@/lib/utils/postcode';

// A-timefirst: cross-cleaner availability for the time-first front door.
// "Which cleaners are available for [date] [band] in [postcode] for [service]?"
// Thin wrapper over MatchingService.findMatches (see availability-query.service).
//
// GET /api/cleaners/available?date=YYYY-MM-DD&band=afternoon&duration=2&service=regular&postcode=SW1A1AA
//   200 → { date, band, cleaners: [...] }
//   400 → invalid params
//   429 → rate limited
//
// Discovery only — booking still goes through the normal cleaner-first flow.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`avail-cleaners:${ip}`, 30, 60 * 1000); // 30/min per IP
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date')?.trim() ?? '';
  const band = searchParams.get('band')?.trim() as TimeBand | '';
  const durationStr = searchParams.get('duration')?.trim() ?? '';
  const serviceType = searchParams.get('service')?.trim() ?? '';
  const postcode = searchParams.get('postcode')?.trim() ?? '';

  if (!DATE_REGEX.test(dateStr)) {
    return NextResponse.json({ error: 'date required in YYYY-MM-DD format.' }, { status: 400 });
  }
  if (!band || !(band in TIME_BANDS)) {
    return NextResponse.json(
      { error: 'band must be one of: morning, afternoon, evening.' },
      { status: 400 }
    );
  }
  const duration = durationStr ? parseFloat(durationStr) : 2;
  if (Number.isNaN(duration) || duration < 1 || duration > 12) {
    return NextResponse.json(
      { error: 'duration must be between 1 and 12 hours.' },
      { status: 400 }
    );
  }
  if (!serviceType) {
    return NextResponse.json({ error: 'service is required.' }, { status: 400 });
  }
  if (!isValidPostcode(postcode)) {
    return NextResponse.json({ error: 'A valid UK postcode is required.' }, { status: 400 });
  }

  // Noon-local avoids any date-boundary shift when findMatches reads getDay().
  const date = new Date(`${dateStr}T12:00:00`);

  const result = await getAvailableCleanersForBand({
    date,
    band,
    duration,
    serviceType,
    postcode,
  });

  return NextResponse.json(result);
}
