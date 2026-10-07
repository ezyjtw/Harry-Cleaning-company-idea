// B3 gate (James-ruled, R2 boundary): a top-up taken without its assignment
// (TOPUP_WITHOUT_ASSIGNMENT) raises the booking's captured, charged and
// refundable money, never automatically the cleaner's earnings or releasable
// money. Every cleaner-side figure that reads the captured total (the transfer's
// charge headroom, the cleaner's share of a refund or chargeback) reads it net
// of flagged top-ups, so those figures are exactly what they were before the
// flag. Refunding the flagged charge itself is B4.

import prisma from '@/lib/db/prisma';

export const TOPUP_WITHOUT_ASSIGNMENT = 'TOPUP_WITHOUT_ASSIGNMENT';

/** The pounds charged by flagged top-ups on this booking (0 when none). */
export async function flaggedTopupPounds(bookingId: string): Promise<number> {
  const rows = await prisma.topupRecord.findMany({
    where: {
      bookingId,
      status: 'SUCCEEDED',
      failureReason: { startsWith: TOPUP_WITHOUT_ASSIGNMENT },
    },
    select: { amount: true },
  });
  return Math.round(rows.reduce((sum, r) => sum + Number(r.amount), 0) * 100) / 100;
}
