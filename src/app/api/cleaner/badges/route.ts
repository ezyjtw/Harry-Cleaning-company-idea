// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
// A7: cheap badge counts for the native tab bar — the web bell's countOnly
// pattern, shell-shaped. Three indexed COUNT queries, no row transfer; the
// shell polls this every 60 seconds with its Bearer token.
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { notOwnBookingWhere, paidVisibleWhere } from '@/lib/booking/own-booking';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [primaryOffers, backupOffers, messages, disputes, arrangements] = await Promise.all([
    // Live offers where this cleaner is the current primary holder — mirrors
    // the dashboard's offer semantics (cascade.service is the source of truth).
    // H10: cascadePhase null included (legacy/rescue-rebooked direct offers).
    prisma.booking.findMany({
      where: {
        cleanerId: user.id,
        status: 'AWAITING_CLEANER',
        // H53: no payment → no offer badge.
        ...paidVisibleWhere(),
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
        // H53: no payment → no offer badge.
        ...paidVisibleWhere(),
        // H38: own customer purchase never counts as an offer.
        ...notOwnBookingWhere(user.id),
        NOT: [{ declinedCleanerIds: { has: user.id } }, { reserveCleanerIds: { has: user.id } }],
      },
      select: { id: true },
      take: 50,
    }),
    prisma.message.count({ where: { receiverId: user.id, read: false } }),
    // H43: open disputes on this cleaner's bookings — their attention/payout is
    // on the line. Same seen-tracking pattern as offers (disputeIds below).
    prisma.dispute.findMany({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        booking: { cleanerId: user.id },
      },
      select: { id: true },
      take: 50,
    }),
    // F27: open regular-arrangement requests — they live on the Jobs page and
    // are time-boxed like offers, so they count into the Jobs badge (F10 law:
    // clears only when answered, never on viewing).
    prisma.recurringAgreement.findMany({
      where: { cleanerId: user.id, status: 'PENDING_CLEANER_ACCEPTANCE' },
      select: { id: true },
      take: 50,
    }),
  ]);

  // offerIds / disputeIds (additive — the native shell ignores them) let the
  // web sidebar track SEEN items so the badge clears on viewing and re-fires
  // for new ones.
  const offerIds = Array.from(new Set([...primaryOffers, ...backupOffers].map((b) => b.id)));
  const disputeIds = disputes.map((d) => d.id);
  const arrangementIds = arrangements.map((a) => a.id);
  return NextResponse.json({
    // F27: `offers` drives the native Jobs tab badge — arrangement requests
    // now respond from that surface, so they count here too. The web sidebar
    // sums the two id arrays itself.
    offers: offerIds.length + arrangementIds.length,
    offerIds,
    arrangementIds,
    messages,
    openDisputes: disputeIds.length,
    disputeIds,
  });
}
