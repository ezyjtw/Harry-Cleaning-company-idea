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
    // Documents awaiting admin review (uploaded, not yet verified, not destroyed).
    prisma.documentUpload.count({ where: { isVerified: false, isDestroyed: false } }),
    // Mirrors the Rena-Find queue page's list.
    prisma.booking.count({ where: { cascadePhase: 'RENA_FIND_ADMIN_REVIEW' } }),
  ]);

  return NextResponse.json({ verificationPending, renaFindQueue });
}
