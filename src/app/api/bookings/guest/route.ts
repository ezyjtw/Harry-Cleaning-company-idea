import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { executeCancellation, previewCancellation } from '@/lib/services/cancellation.service';
import { bookingFullAddress } from '@/lib/utils/booking-address';

// Token format validation. Two legitimate shapes exist: checkout guest tokens
// are UUIDs (crypto.randomUUID), and R1-A occurrence tokens are 48-char hex
// (randomBytes(24)) — the per-occurrence tokened links of recurring guests.
function isValidToken(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hexRegex = /^[0-9a-f]{48}$/i;
  return uuidRegex.test(token) || hexRegex.test(token);
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

  // R1-A (amended, guest-end ruling): the tokened page is the guest's end
  // surface, so expose their ACTIVE agreement with this cleaner (covers both
  // the trial booking's token and any occurrence's token — same guestEmail).
  const activeAgreement = booking.guestEmail
    ? await prisma.recurringAgreement.findFirst({
        where: {
          cleanerId: booking.cleanerId,
          status: 'ACTIVE',
          guestEmail: { equals: booking.guestEmail, mode: 'insensitive' },
        },
        select: {
          id: true,
          frequency: true,
          dayOfWeek: true,
          startTime: true,
          bookings: {
            // R1-C: next occurrence (uncharged or paid) — skip target.
            where: {
              OR: [
                { status: 'SCHEDULED' },
                { status: { in: ['ACCEPTED', 'CONFIRMED'] }, paymentStatus: 'SUCCEEDED' },
              ],
              date: { gte: new Date() },
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              paymentStatus: true,
              guestToken: true,
            },
            orderBy: { date: 'asc' },
            take: 1,
          },
        },
      })
    : null;

  return NextResponse.json({
    activeAgreement: activeAgreement
      ? {
          id: activeAgreement.id,
          frequency: activeAgreement.frequency,
          dayOfWeek: activeAgreement.dayOfWeek,
          startTime: activeAgreement.startTime,
          nextOccurrence: activeAgreement.bookings[0]?.date.toISOString().split('T')[0] ?? null,
          // R1-C: the skip action targets the next occurrence (its OWN token
          // authorizes the skip — per-occurrence tokened links, guest parity).
          nextOccurrenceId: activeAgreement.bookings[0]?.id ?? null,
          nextOccurrenceTime: activeAgreement.bookings[0]?.startTime ?? null,
          nextOccurrencePaid: activeAgreement.bookings[0]?.paymentStatus === 'SUCCEEDED',
          nextOccurrenceToken: activeAgreement.bookings[0]?.guestToken ?? null,
        }
      : null,
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
      // LB-7: the setup page re-submits / displays the trial's supplies answer.
      suppliesProvided: booking.suppliesProvided,
      totalPrice: Number(booking.totalPrice),
      // A12: guests see their own address (read from booking columns, guest-safe).
      address: bookingFullAddress(booking),
      // R1-A (amended): structured address for the regular-clean setup page —
      // the agreement checkout re-submits the SAME address the guest already
      // gave us (their own data, token-authorized).
      addressLine1: booking.addressLine1 || '',
      addressLine2: booking.addressLine2 || '',
      addressCity: booking.addressCity || '',
      addressPostcode: booking.addressPostcode || '',
      guestPhone: booking.guestPhone || '',
      status: booking.status,
      cascadePhase: booking.cascadePhase,
      paymentStatus: booking.paymentStatus,
      // R1-C: occurrences select the no-charge can't-make variant.
      agreementId: booking.agreementId,
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
