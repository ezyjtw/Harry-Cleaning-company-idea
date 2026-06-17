import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import {
  expireBackupOrCombinedOffer,
  expirePrimaryOffer,
  expireProvisionalApproval,
} from '@/lib/services/cascade.service';

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      cascadePhase: true,
      cleanerId: true,
      backupCleanerIds: true,
      cascadeBackupExpiresAt: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      serviceType: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'AWAITING_CLEANER') {
    return NextResponse.json(
      { error: `Booking status is ${booking.status}, not AWAITING_CLEANER` },
      { status: 400 }
    );
  }

  if (!booking.cascadePhase) {
    return NextResponse.json({ error: 'No active cascade phase on this booking' }, { status: 400 });
  }

  const fromPhase = booking.cascadePhase;
  let advanced = false;

  if (booking.cascadePhase === 'PRIMARY_OFFER') {
    advanced = await expirePrimaryOffer(bookingId, booking);
  } else if (booking.cascadePhase === 'BACKUP_OFFER' || booking.cascadePhase === 'COMBINED_OFFER') {
    advanced = await expireBackupOrCombinedOffer(bookingId, booking.cascadePhase);
  } else if (booking.cascadePhase === 'PROVISIONAL_APPROVAL') {
    advanced = await expireProvisionalApproval(bookingId);
  }

  if (!advanced) {
    return NextResponse.json(
      { error: 'Cascade advance failed — booking may have been modified concurrently' },
      { status: 409 }
    );
  }

  const after = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, cascadePhase: true },
  });

  await AuditService.log({
    userId: admin.id,
    action: 'ADMIN_FORCE_CASCADE',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      fromPhase,
      toPhase: after?.cascadePhase ?? null,
      toStatus: after?.status ?? null,
    },
  }).catch(() => {});

  return NextResponse.json({
    fromPhase,
    toPhase: after?.cascadePhase ?? null,
    toStatus: after?.status ?? null,
  });
}
