import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { ADMIN_DESTRUCTIVE_ENABLED } from '@/lib/config/features';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

const VALID_STATUSES = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'REVIEWED',
  'CANCELLED',
  'DISPUTED',
  'CASCADE_EXHAUSTED',
] as const;

const VALID_CASCADE_PHASES = [
  'PRIMARY_OFFER',
  'BACKUP_OFFER',
  'COMBINED_OFFER',
  'CASCADE_EXHAUSTED',
  'PROVISIONAL_APPROVAL',
] as const;

export async function POST(request: NextRequest) {
  if (!ADMIN_DESTRUCTIVE_ENABLED) {
    return NextResponse.json({ error: 'Destructive admin actions are disabled' }, { status: 403 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId, status, cascadePhase } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  if (status === undefined && cascadePhase === undefined) {
    return NextResponse.json(
      { error: 'At least one of status or cascadePhase must be provided' },
      { status: 400 }
    );
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  if (
    cascadePhase !== undefined &&
    cascadePhase !== null &&
    !VALID_CASCADE_PHASES.includes(cascadePhase)
  ) {
    return NextResponse.json(
      { error: `Invalid cascadePhase. Valid: ${VALID_CASCADE_PHASES.join(', ')} or null` },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, cascadePhase: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const changes: Record<string, unknown> = {};
  const auditChanges: { field: string; from: string | null; to: string | null }[] = [];

  if (status !== undefined && status !== booking.status) {
    changes.status = status;
    auditChanges.push({ field: 'status', from: booking.status, to: status });
  }

  if (cascadePhase !== undefined && cascadePhase !== booking.cascadePhase) {
    changes.cascadePhase = cascadePhase;
    auditChanges.push({
      field: 'cascadePhase',
      from: booking.cascadePhase,
      to: cascadePhase,
    });
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ message: 'No changes — values already match' });
  }

  await prisma.booking.update({ where: { id: bookingId }, data: changes });

  await AuditService.log({
    userId: admin.id,
    action: 'ADMIN_STATUS_OVERRIDE',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { changes: auditChanges },
  }).catch(() => {});

  return NextResponse.json({ updated: auditChanges });
}
