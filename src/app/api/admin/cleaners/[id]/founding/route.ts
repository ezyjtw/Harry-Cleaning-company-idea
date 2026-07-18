import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

// F-B: admin-settable founding-cleaner flag (the auto-flag covers the first N
// go-lives; this endpoint lets James grant or revoke it per cleaner).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { founding } = body as { founding?: unknown };
  if (typeof founding !== 'boolean') {
    return NextResponse.json({ error: 'founding must be a boolean' }, { status: 400 });
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
    data: { foundingCleaner: founding },
  });

  await AuditService.log({
    userId: admin.id,
    action: founding ? 'CLEANER_FOUNDING_GRANTED' : 'CLEANER_FOUNDING_REVOKED',
    entityType: 'CleanerProfile',
    entityId: profile.id,
    metadata: { cleanerUserId: profile.userId },
  });

  return NextResponse.json({ success: true, founding });
}
