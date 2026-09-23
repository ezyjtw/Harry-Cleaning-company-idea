import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface CreateBookingData {
  clientId?: string;
  cleanerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressId?: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  notes: string;
  totalPrice: number;
  platformFee: number;
  cleanerEarnings: number;
}

export interface BookingResult {
  id: string;
  cleanerId: string;
  customerName: string;
  serviceType: string;
  date: string;
  time: string;
  status: string;
  totalPrice: number;
}

// ─── Service Functions ──────────────────────────────────────

export async function createBooking(data: CreateBookingData): Promise<BookingResult> {
  const booking = await prisma.booking.create({
    data: {
      clientId: data.clientId || null,
      cleanerId: data.cleanerId,
      guestName: data.clientId ? null : data.customerName,
      guestEmail: data.clientId ? null : data.customerEmail,
      guestPhone: data.clientId ? null : data.customerPhone,
      addressId: data.addressId || null,
      date: new Date(data.date),
      startTime: data.time,
      duration: data.duration,
      serviceType: data.serviceType,
      notes: data.notes || null,
      totalPrice: data.totalPrice,
      platformFee: data.platformFee,
      cleanerEarnings: data.cleanerEarnings,
      status: 'PENDING',
    },
  });

  return {
    id: booking.id,
    cleanerId: booking.cleanerId,
    customerName: data.customerName,
    serviceType: booking.serviceType,
    date: booking.date.toISOString().split('T')[0],
    time: booking.startTime,
    status: booking.status.toLowerCase(),
    totalPrice: Number(booking.totalPrice),
  };
}

export async function getBookingById(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      cleaner: { select: { name: true, email: true } },
      address: true,
      payment: true,
    },
  });

  if (!booking) return null;

  return {
    id: booking.id,
    cleanerId: booking.cleanerId,
    customerName: booking.client?.name || booking.guestName || 'Guest',
    customerEmail: booking.client?.email || booking.guestEmail || '',
    serviceType: booking.serviceType,
    date: booking.date.toISOString().split('T')[0],
    time: booking.startTime,
    duration: Number(booking.duration),
    status: booking.status.toLowerCase(),
    totalPrice: Number(booking.totalPrice),
    cleanerEarnings: Number(booking.cleanerEarnings),
    platformFee: Number(booking.platformFee),
    notes: booking.notes,
    cleanerName: booking.cleaner.name || 'Unassigned',
    address: booking.address
      ? `${booking.address.line1}, ${booking.address.city} ${booking.address.postcode}`
      : '',
    paymentStatus: booking.payment?.status || null,
  };
}

export async function getBookingsByClient(clientId: string) {
  const bookings = await prisma.booking.findMany({
    where: { clientId },
    include: {
      cleaner: { select: { name: true } },
      address: { select: { line1: true, postcode: true } },
    },
    orderBy: { date: 'desc' },
  });

  return bookings.map((b) => ({
    id: b.id,
    cleanerName: b.cleaner.name || 'Unassigned',
    serviceType: b.serviceType,
    date: b.date.toISOString().split('T')[0],
    time: b.startTime,
    status: b.status.toLowerCase(),
    totalPrice: Number(b.totalPrice),
    address: b.address ? `${b.address.line1}, ${b.address.postcode}` : '',
  }));
}

export async function getBookingsByCleaner(cleanerId: string) {
  const bookings = await prisma.booking.findMany({
    where: { cleanerId },
    include: {
      client: { select: { name: true } },
      address: { select: { line1: true, postcode: true } },
    },
    orderBy: { date: 'desc' },
  });

  return bookings.map((b) => ({
    id: b.id,
    clientName: b.client?.name || b.guestName || 'Guest',
    serviceType: b.serviceType,
    date: b.date.toISOString().split('T')[0],
    time: b.startTime,
    status: b.status.toLowerCase(),
    totalPrice: Number(b.totalPrice),
    address: b.address ? `${b.address.line1}, ${b.address.postcode}` : '',
  }));
}

// (cancelBooking, updateBookingStatus and rescheduleBooking removed — THE
// FENCE + RECORD-TRUTH lanes, James-ruled: all three were naked lifecycle
// writes with no Stripe awareness and zero callers. Cancellation rides
// executeCancellation in cancellation.service; status transitions and
// reschedules live with their owning flows.)
