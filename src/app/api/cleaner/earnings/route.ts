import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

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
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay() + 1); // Monday
      dateFrom.setHours(0, 0, 0, 0);
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
      totalPrice: true,
      cleanerEarnings: true,
      platformFee: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  // Summary
  let totalEarnings = 0;
  let totalFees = 0;
  for (const b of completedBookings) {
    totalEarnings += Number(b.cleanerEarnings);
    totalFees += Number(b.platformFee);
  }

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
    amount: Math.round(data.amount * 100) / 100,
  }));

  // Build payout-style entries (group by day)
  const payoutsByDate: Record<string, { amount: number; ids: string[] }> = {};
  for (const b of completedBookings) {
    const dateKey = b.completedAt ? b.completedAt.toISOString().split('T')[0] : 'unknown';
    if (!payoutsByDate[dateKey]) payoutsByDate[dateKey] = { amount: 0, ids: [] };
    payoutsByDate[dateKey].amount += Number(b.cleanerEarnings);
    payoutsByDate[dateKey].ids.push(b.id);
  }

  const payouts = Object.entries(payoutsByDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data], i) => ({
      id: `P-${String(i + 1).padStart(3, '0')}`,
      date,
      amount: Math.round(data.amount * 100) / 100,
      status: 'completed' as const,
      reference: `PAY-${date.replace(/-/g, '')}`,
      bookingCount: data.ids.length,
    }));

  return NextResponse.json({
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    platformCommission: Math.round(totalFees * 100) / 100,
    netEarnings: Math.round(totalEarnings * 100) / 100,
    bookingCount: completedBookings.length,
    payouts,
    breakdown,
    period,
  });
}
