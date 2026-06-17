import Link from 'next/link';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

import StuckMoneyClient from './StuckMoneyClient';

export const dynamic = 'force-dynamic';

export interface StuckRefund {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: string;
  stripeRefundId: string | null;
  failureReason: string | null;
  attempt: number;
  createdAt: string;
}

export interface StuckTopup {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: string;
  stripePaymentIntentId: string | null;
  failureReason: string | null;
  attempt: number;
  createdAt: string;
}

export default async function StuckMoneyPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div className="p-8 text-center text-red-600">
        Admin access required.{' '}
        <Link href="/login" className="underline">
          Login
        </Link>
      </div>
    );
  }

  const [stuckRefunds, stuckTopups] = await Promise.all([
    prisma.refundRecord.findMany({
      where: { status: { in: ['REVERSAL_ONLY', 'UNKNOWN'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.topupRecord.findMany({
      where: { status: 'UNKNOWN' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const refunds: StuckRefund[] = stuckRefunds.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    amount: Number(r.amount),
    reason: r.reason,
    status: r.status,
    stripeRefundId: r.stripeRefundId,
    failureReason: r.failureReason,
    attempt: r.attempt,
    createdAt: r.createdAt.toISOString(),
  }));

  const topups: StuckTopup[] = stuckTopups.map((t) => ({
    id: t.id,
    bookingId: t.bookingId,
    amount: Number(t.amount),
    reason: t.reason,
    status: t.status,
    stripePaymentIntentId: t.stripePaymentIntentId,
    failureReason: t.failureReason,
    attempt: t.attempt,
    createdAt: t.createdAt.toISOString(),
  }));

  return <StuckMoneyClient refunds={refunds} topups={topups} />;
}
