// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
// A7: cheap badge counts for the native tab bar — the web bell's countOnly
// pattern, shell-shaped. Three indexed COUNT queries, no row transfer; the
// shell polls this every 60 seconds with its Bearer token.
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [primaryOffers, backupOffers, messages] = await Promise.all([
    // Live offers where this cleaner is the current primary holder — mirrors
    // the dashboard's offer semantics (cascade.service is the source of truth).
    prisma.booking.count({
      where: {
        cleanerId: user.id,
        status: 'AWAITING_CLEANER',
        cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] },
        NOT: { declinedCleanerIds: { has: user.id } },
      },
    }),
    prisma.booking.count({
      where: {
        backupCleanerIds: { has: user.id },
        status: 'AWAITING_CLEANER',
        cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER'] },
        NOT: { declinedCleanerIds: { has: user.id } },
      },
    }),
    prisma.message.count({ where: { receiverId: user.id, read: false } }),
  ]);

  return NextResponse.json({ offers: primaryOffers + backupOffers, messages });
}
