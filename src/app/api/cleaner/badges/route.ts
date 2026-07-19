// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
// A7: cheap badge counts for the native tab bar — the web bell's countOnly
// pattern, shell-shaped. Three indexed COUNT queries, no row transfer; the
// shell polls this every 60 seconds with its Bearer token.
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { notOwnBookingWhere } from '@/lib/booking/own-booking';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [primaryOffers, backupOffers, messages] = await Promise.all([
    // Live offers where this cleaner is the current primary holder — mirrors
    // the dashboard's offer semantics (cascade.service is the source of truth).
    // H10: cascadePhase null included (legacy/rescue-rebooked direct offers).
    prisma.booking.findMany({
      where: {
        cleanerId: user.id,
        status: 'AWAITING_CLEANER',
        // H38: own customer purchase never counts as an offer.
        AND: [
          notOwnBookingWhere(user.id),
          {
            OR: [
              { cascadePhase: null },
              { cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] } },
            ],
          },
        ],
        NOT: { declinedCleanerIds: { has: user.id } },
      },
      select: { id: true },
      take: 50,
    }),
    // H10: every phase a backup can act on — BACKUP/COMBINED plus the Phase-2
    // reopen and Rena-Find broadcasts. Held reserves are waiting, not acting.
    prisma.booking.findMany({
      where: {
        backupCleanerIds: { has: user.id },
        status: 'AWAITING_CLEANER',
        cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'PHASE2_RESERVE', 'RENA_FIND'] },
        // H38: own customer purchase never counts as an offer.
        ...notOwnBookingWhere(user.id),
        NOT: [{ declinedCleanerIds: { has: user.id } }, { reserveCleanerIds: { has: user.id } }],
      },
      select: { id: true },
      take: 50,
    }),
    prisma.message.count({ where: { receiverId: user.id, read: false } }),
  ]);

  // offerIds (additive — the native shell ignores it) lets the web sidebar
  // track SEEN offers so the badge clears on viewing and re-fires for new ones.
  const offerIds = Array.from(new Set([...primaryOffers, ...backupOffers].map((b) => b.id)));
  return NextResponse.json({ offers: offerIds.length, offerIds, messages });
}
