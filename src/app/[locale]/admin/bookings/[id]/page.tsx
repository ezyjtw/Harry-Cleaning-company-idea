import Link from 'next/link';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

import BookingDetailClient from './BookingDetailClient';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBookingDetailPage({ params }: PageProps) {
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

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
      cleaner: {
        select: {
          id: true,
          name: true,
          email: true,
          cleanerProfile: {
            select: { stripeAccountId: true, verified: true, verificationStatus: true },
          },
        },
      },
      address: true,
      payment: true,
      refundRecords: { orderBy: { createdAt: 'desc' } },
      topupRecords: { orderBy: { createdAt: 'desc' } },
      review: true,
      dispute: { include: { evidence: true } },
      bookingAddons: { include: { addon: { select: { name: true, price: true } } } },
    },
  });

  if (!booking) {
    return (
      <div className="p-8 text-center text-gray-600">
        Booking not found.{' '}
        <Link href="/admin/bookings" className="underline text-blue-600">
          Back to bookings
        </Link>
      </div>
    );
  }

  const serialized = JSON.parse(
    JSON.stringify(booking, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );

  return <BookingDetailClient booking={serialized} />;
}
