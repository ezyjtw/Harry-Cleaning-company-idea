import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordCustomerAnswer } from '@/lib/services/stuck-jobs.service';

// Stuck-money reaper: the tokened "did this clean happen?" surface. The
// askToken IS the authorization (H8 matrix) — it was emailed to the booking's
// customer and identifies exactly one case. Reads booking display data only;
// the answer write moves no money (it informs the admin buttons).

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  const c = await prisma.stuckJobCase.findUnique({
    where: { askToken: token },
    select: {
      customerAnswer: true,
      resolvedAt: true,
      booking: {
        select: {
          serviceType: true,
          date: true,
          startTime: true,
          cleaner: { select: { name: true } },
        },
      },
    },
  });
  if (!c) {
    return NextResponse.json({ error: 'This link is not valid' }, { status: 404 });
  }

  return NextResponse.json({
    serviceType: c.booking.serviceType,
    date: c.booking.date.toISOString(),
    startTime: c.booking.startTime,
    cleanerName: c.booking.cleaner?.name ?? 'your cleaner',
    answered: c.customerAnswer !== null,
    resolved: c.resolvedAt !== null,
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`job-check:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const answer = body?.answer;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }
  if (answer !== 'YES' && answer !== 'NO') {
    return NextResponse.json({ error: 'Answer must be YES or NO' }, { status: 400 });
  }

  const result = await recordCustomerAnswer(token, answer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ message: 'Thank you — your answer has been recorded.' });
}
