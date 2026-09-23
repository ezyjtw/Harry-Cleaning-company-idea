import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// F26 companion (Appearance item 7, James-ruled): the visibility flags for the
// customer's OWN past cleaners. The public directory APIs rightly refuse to
// serve hidden profiles at all (F26: gone from discovery), but MY CLEANERS
// needs the truth to render the quiet "Not currently taking bookings" row —
// so this authed read serves ONLY the flag, only for cleaners the customer
// has completed bookings with. No new fields: it reads the existing
// visibleInDirectory switch and nothing else.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const past = await prisma.booking.findMany({
    where: { clientId: user.id, status: { in: ['COMPLETED', 'REVIEWED'] } },
    select: { cleanerId: true },
    distinct: ['cleanerId'],
  });
  const ids = past.map((b) => b.cleanerId);
  if (ids.length === 0) return NextResponse.json({ visibility: {} });

  const profiles = await prisma.cleanerProfile.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, visibleInDirectory: true },
  });

  const visibility: Record<string, boolean> = {};
  for (const p of profiles) visibility[p.userId] = p.visibleInDirectory;
  return NextResponse.json({ visibility });
}
