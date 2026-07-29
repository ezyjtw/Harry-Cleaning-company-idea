import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// H79 (one-truth law): this page, the dashboard's weekly figure and the PDF
// statement all read the SAME ledger — cleaner's net (cleanerEarnings) on
// COMPLETED/REVIEWED bookings keyed by completedAt. Release state is shown
// honestly per day: the old "Payout History" fabricated payout references
// (PAY-yyyymmdd, status always "completed") for money that was often still
// PENDING or PAUSED — a lie on a money surface, removed.

function startOfWeekMonday(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // H79: the old `getDate() - getDay() + 1` jumped to NEXT Monday on Sundays,
  // rendering an empty "This Week" one day in seven. (getDay()+6)%7 is the
  // days-since-Monday distance, correct all week.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export async function GET(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';

  const now = new Date();
  let dateFrom: Date;

  switch (period) {
    case 'week': {
      dateFrom = startOfWeekMonday(now);
      break;
    }
    case 'year': {
      dateFrom = new Date(now.getFullYear(), 0, 1);
      break;
    }
    default: {
      // month
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
  }

  const completedBookings = await prisma.booking.findMany({
    where: {
      cleanerId: user.id,
      status: { in: ['COMPLETED', 'REVIEWED'] },
      completedAt: { gte: dateFrom },
    },
    select: {
      id: true,
      serviceType: true,
      // LR-2/F24.3 payload law: no customer figure is even SELECTED here.
      cleanerEarnings: true,
      platformFee: true,
      completedAt: true,
      transferStatus: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  // Summary — M6: this endpoint reports the cleaner's NET earnings only. The
  // customer's 6% service fee was previously summed here and returned mislabeled
  // as "platformCommission"; the field is REMOVED (not relabeled) — commission
  // figures live on the statement (statement.service), which uses the true
  // platformCommissionAmount snapshot.
  //
  // H79: net-first with an HONEST release split — "paid out" is money whose
  // transfer has actually RELEASED; everything else earned is "pending release"
  // (escrow hold, dispute pause, release queue). earned = paidOut + pending.
  let totalEarnings = 0;
  let paidOut = 0;
  for (const b of completedBookings) {
    const net = Number(b.cleanerEarnings);
    totalEarnings += net;
    if (b.transferStatus === 'RELEASED') paidOut += net;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Group by service type
  const byService: Record<string, { count: number; amount: number }> = {};
  for (const b of completedBookings) {
    const key = b.serviceType;
    if (!byService[key]) byService[key] = { count: 0, amount: 0 };
    byService[key].count++;
    byService[key].amount += Number(b.cleanerEarnings);
  }

  const breakdown = Object.entries(byService).map(([type, data]) => ({
    type,
    count: data.count,
    amount: round2(data.amount),
  }));

  // H79: honest earnings-by-day (replaces the fabricated payout ledger) —
  // each day shows how much of its earned net has actually been released.
  const byDay: Record<string, { amount: number; released: number; count: number }> = {};
  for (const b of completedBookings) {
    const dateKey = b.completedAt ? b.completedAt.toISOString().split('T')[0] : 'unknown';
    if (!byDay[dateKey]) byDay[dateKey] = { amount: 0, released: 0, count: 0 };
    const net = Number(b.cleanerEarnings);
    byDay[dateKey].amount += net;
    if (b.transferStatus === 'RELEASED') byDay[dateKey].released += net;
    byDay[dateKey].count++;
  }

  const days = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, d]) => ({
      date,
      amount: round2(d.amount),
      released: round2(d.released),
      pending: round2(d.amount - d.released),
      bookingCount: d.count,
    }));

  return NextResponse.json({
    totalEarnings: round2(totalEarnings),
    netEarnings: round2(totalEarnings),
    paidOut: round2(paidOut),
    pendingRelease: round2(totalEarnings - paidOut),
    bookingCount: completedBookings.length,
    days,
    breakdown,
    period,
  });
}
