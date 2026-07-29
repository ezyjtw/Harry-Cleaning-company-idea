import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

// F26: the admin door on the visibility switch — same flag the cleaner's own
// control writes, last-write-wins, audit-logged both directions. Hiding is
// discovery-only: existing bookings, agreements, and logins are untouched.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { visible } = body as { visible?: unknown };
  if (typeof visible !== 'boolean') {
    return NextResponse.json({ error: 'visible must be a boolean' }, { status: 400 });
  }

  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId: params.id },
    select: { id: true, userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
  }

  await prisma.cleanerProfile.update({
    where: { id: profile.id },
    data: { visibleInDirectory: visible },
  });

  await AuditService.log({
    userId: admin.id,
    action: visible ? 'ADMIN_CLEANER_SHOWN' : 'ADMIN_CLEANER_HIDDEN',
    entityType: 'CleanerProfile',
    entityId: profile.id,
    metadata: { cleanerUserId: profile.userId },
  });

  return NextResponse.json({ success: true, visible });
}
