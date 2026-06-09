import { prisma } from '@/lib/db/prisma';

import AdminBookingsClient from './AdminBookingsClient';

export const dynamic = 'force-dynamic';

export interface BookingRow {
  id: string;
  fullId: string;
  customer: string;
  cleaner: string;
  serviceType: string;
  date: string;
  time: string;
  amount: number;
  refundedAmount: number;
  status:
    | 'pending'
    | 'awaiting_cleaner'
    | 'confirmed'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'disputed'
    | 'cascade_exhausted';
  paymentStatus: string;
}

function mapStatus(prismaStatus: string): BookingRow['status'] {
  switch (prismaStatus) {
    case 'PENDING':
      return 'pending';
    case 'AWAITING_CLEANER':
      return 'awaiting_cleaner';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'confirmed';
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'in-progress';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'DISPUTED':
      return 'disputed';
    case 'CASCADE_EXHAUSTED':
      return 'cascade_exhausted';
    default:
      return 'pending';
  }
}

async function getBookings(): Promise<{
  bookings: BookingRow[];
  total: number;
  serviceTypes: string[];
}> {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      client: { select: { name: true } },
      cleaner: { select: { name: true } },
      refundRecords: {
        where: { status: 'SUCCEEDED' },
        select: { amount: true },
      },
    },
  });

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id.substring(0, 8).toUpperCase(),
    fullId: b.id,
    customer: b.client?.name || b.guestName || 'Guest',
    cleaner: b.cleaner.name || 'Unassigned',
    serviceType: b.serviceType,
    date: b.date.toISOString().split('T')[0],
    time: b.startTime,
    amount: Number(b.totalPrice),
    refundedAmount: b.refundRecords.reduce((sum, r) => sum + Number(r.amount), 0),
    status: mapStatus(b.status),
    paymentStatus: b.paymentStatus,
  }));

  const serviceTypes = Array.from(new Set(rows.map((b) => b.serviceType)));

  return { bookings: rows, total: rows.length, serviceTypes };
}

export default async function AdminBookingsPage() {
  const { bookings, total, serviceTypes } = await getBookings();
  return <AdminBookingsClient bookings={bookings} total={total} serviceTypes={serviceTypes} />;
}
