import Link from 'next/link';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

import RenaFindQueueClient from './RenaFindQueueClient';
import type { QueueBooking } from './RenaFindQueueClient';

export const dynamic = 'force-dynamic';

export default async function RenaFindQueuePage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div className="p-8 text-center text-danger">
        Admin access required.{' '}
        <Link href="/login" className="underline">
          Login
        </Link>
      </div>
    );
  }

  const bookings = await prisma.booking.findMany({
    where: { cascadePhase: 'RENA_FIND_ADMIN_REVIEW' },
    include: {
      client: { select: { name: true } },
      cleaner: {
        select: {
          name: true,
          cleanerProfile: { select: { rating: true } },
        },
      },
      address: { select: { postcode: true } },
    },
    orderBy: { date: 'asc' },
  });

  const rows: QueueBooking[] = bookings.map((b) => {
    const primaryRating = b.cleaner.cleanerProfile ? Number(b.cleaner.cleanerProfile.rating) : 0;
    return {
      id: b.id,
      shortId: b.id.substring(0, 8).toUpperCase(),
      customer: b.client?.name || b.guestName || 'Guest',
      primaryCleaner: b.cleaner.name || 'Unknown',
      primaryRating,
      ratingFloor: primaryRating - 0.3,
      serviceType: b.serviceType,
      date: b.date.toISOString().split('T')[0],
      time: b.startTime,
      postcode: b.addressPostcode || b.address?.postcode || '—',
      earnings: Number(b.cleanerEarnings),
    };
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-4">
        <Link href="/admin/bookings" className="text-sm text-primary hover:underline">
          ← All bookings
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Rena-find: Admin Review Queue</h1>
      <p className="text-sm text-ink-3 mt-1">
        Bookings where Rena-find found no cleaner above the rating floor. Decide: reassign manually,
        rebroadcast with lower floor, or refund.
      </p>
      <div className="mt-1 text-sm text-ink-3">{rows.length} booking(s) awaiting decision</div>
      <RenaFindQueueClient bookings={rows} />
    </div>
  );
}
