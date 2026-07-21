import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * H106 (James-ruled): admin broom for INCOMPLETE signups only — a User with
 * role CLEANER and NO CleanerProfile (a step-0 account whose wizard never
 * finished). This is NOT H103 account deletion: an incomplete signup has no
 * profile, no bookings, no money, no documents. The guard is STRUCTURAL —
 * any profile on the row refuses server-side, regardless of what the UI sent.
 */
export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      cleanerProfile: { select: { id: true } },
      _count: { select: { bookingsAsClient: true, bookingsAsCleaner: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  // Structural guard — every condition server-side, none of them UI trust.
  if (user.role !== 'CLEANER' || user.cleanerProfile) {
    return NextResponse.json(
      { error: 'Only incomplete cleaner signups (no profile) can be removed here.' },
      { status: 400 }
    );
  }
  if (user._count.bookingsAsClient > 0 || user._count.bookingsAsCleaner > 0) {
    return NextResponse.json(
      { error: 'This account has bookings — not an incomplete signup.' },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    // Verify/reset tokens are keyed by email identifier, not relation.
    prisma.verificationToken.deleteMany({
      where: { identifier: { in: [user.email, `reset:${user.email}`] } },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  await AuditService.log({
    userId: admin.id,
    action: 'INCOMPLETE_SIGNUP_REMOVED',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email, name: user.name },
  });

  // eslint-disable-next-line no-console
  console.log(`[AdminBroom] incomplete signup removed: ${user.email} (by ${admin.id})`);

  return NextResponse.json({ ok: true });
}
