import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { executeCancellation, previewCancellation } from '@/lib/services/cancellation.service';
import { bookingFullAddress } from '@/lib/utils/booking-address';

// UUID-like format validation (accepts standard UUID v4 format)
function isValidToken(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
    include: { cleaner: { select: { name: true, image: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // H22 sweep: guests get the same RESOLVED cleaner headshot account-holders
  // see (guest parity) — this endpoint previously shipped no image at all,
  // so the tokened confirmation page could only ever render initials.
  const { resolveProfileImageUrl } = await import('@/lib/storage/r2-client');
  const cleanerImage = await resolveProfileImageUrl(booking.cleaner.image);

  return NextResponse.json({
    booking: {
      id: booking.id,
      // P3 (ledger): a claimed booking (guest→account conversion backfilled
      // clientId) keeps its tokened view working, but the page tells the
      // customer it now lives in their account.
      claimed: booking.clientId !== null,
      guestToken: booking.guestToken,
      cleanerName: booking.cleaner.name || 'Assigned Cleaner',
      cleanerImage,
      // H5 rescue: during CLEANER_CANCELLED cleanerId is still the canceller —
      // the rescue panel needs it to exclude/label them in the rebook picker.
      cleanerId: booking.cleanerId,
      serviceType: booking.serviceType,
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      duration: Number(booking.duration),
      totalPrice: Number(booking.totalPrice),
      // A12: guests see their own address (read from booking columns, guest-safe).
      address: bookingFullAddress(booking),
      status: booking.status,
      cascadePhase: booking.cascadePhase,
      paymentStatus: booking.paymentStatus,
      // M3 rescue: the tokened tracking page renders the refund/rebook panel.
      rescueDeadline: booking.rescueDeadline ? booking.rescueDeadline.toISOString() : null,
      backupCleanerIds: booking.backupCleanerIds,
      // F9 (James-ruled): the guest confirmation page must speak the same
      // reassurance clause as the guest's own email — expose the net state.
      hasBackups: (booking.backupCleanerIds ?? []).length > 0,
      autoAssignBackup: !!booking.autoAssignBackup,
      postcode: booking.addressPostcode || '',
      guestEmail: booking.guestEmail || '',
      guestName: booking.guestName || '',
      notes: booking.notes || '',
      createdAt: booking.createdAt.toISOString(),
    },
  });
}

// Guest cancel-dialog parity (James-ruled): the tokened page gets the same
// read-only refund preview account-holders see — refund %, amount, and the
// live grace deadline — before the guest confirms. Token IS the authorization,
// exactly as on DELETE below; previewCancellation mutates nothing.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { token, dryRun } = body as { token?: string; dryRun?: boolean };

  if (!dryRun) {
    return NextResponse.json({ error: 'Only dryRun previews are supported here' }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }
  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
    select: { id: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const preview = await previewCancellation(booking.id);
  return NextResponse.json({ preview });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  // Token is the authorization; resolve it to a booking id then run the shared
  // cancellation path (policy + refund + teardown + email + notifications).
  const booking = await prisma.booking.findUnique({
    where: { guestToken: token },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const result = await executeCancellation({ bookingId: booking.id, cancelledBy: 'guest' });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    message: 'Booking cancelled successfully',
    booking: { id: booking.id, status: 'CANCELLED' },
    refundPercent: result.refundPercent,
    refundAmount: result.refundAmount,
    refundStatus: result.refundStatus,
  });
}
