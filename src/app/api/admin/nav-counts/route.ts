import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// F11: pending-count badges for the admin sidebar (same cheap countOnly
// pattern as the notification bell — two indexed counts, polled every 60s).
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const [verificationPending, renaFindQueue] = await Promise.all([
    // Queue restructure: the unit is CLEANERS awaiting action (distinct
    // profiles with unverified docs), matching the per-cleaner queue page.
    prisma.documentUpload
      .findMany({
        where: { isVerified: false, isDestroyed: false, profileId: { not: null } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      .then((rows) => rows.length),
    // Mirrors the Rena-Find queue page's list.
    prisma.booking.count({ where: { cascadePhase: 'RENA_FIND_ADMIN_REVIEW' } }),
  ]);

  return NextResponse.json({ verificationPending, renaFindQueue });
}
