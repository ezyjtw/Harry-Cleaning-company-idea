import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { filterSlotAvailableCleaners } from '@/lib/availability/slot-eligibility';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// H7: batch slot-availability check for the backup-cleaner picker. "Of these
// cleaner ids, who is genuinely free for this exact slot?" — answered by THE
// shared slot-eligibility predicate (identical timesheet maths to search), so
// the picker can stop offering backups the offer machinery would have to drop.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`slot-avail:${ip}`, 60, 60 * 1000); // 60/min per IP
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const cleanerIds: unknown = body?.cleanerIds;
  const dateStr = typeof body?.date === 'string' ? body.date : '';
  const time = typeof body?.time === 'string' ? body.time : '';
  const duration = Number(body?.duration);

  if (!Array.isArray(cleanerIds) || cleanerIds.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'cleanerIds must be an array of ids.' }, { status: 400 });
  }
  if (cleanerIds.length === 0) return NextResponse.json({ availableIds: [] });
  if (cleanerIds.length > 100) {
    return NextResponse.json({ error: 'Too many cleaner ids.' }, { status: 400 });
  }
  if (!DATE_RE.test(dateStr) || !TIME_RE.test(time)) {
    return NextResponse.json(
      { error: 'date (YYYY-MM-DD) and time (HH:mm) are required.' },
      { status: 400 }
    );
  }
  if (Number.isNaN(duration) || duration < 1 || duration > 12) {
    return NextResponse.json(
      { error: 'duration must be between 1 and 12 hours.' },
      { status: 400 }
    );
  }

  const available = await filterSlotAvailableCleaners(cleanerIds as string[], {
    date: new Date(`${dateStr}T00:00:00`),
    startTime: time,
    durationHours: duration,
  });

  return NextResponse.json({ availableIds: Array.from(available) });
}
