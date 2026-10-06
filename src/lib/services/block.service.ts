// UGC block (James-ordered, Apple 1.2 / Play content rating): the one place
// that answers "is this pair blocked?". A block in EITHER direction counts.
// Consumers: messaging (send refused, canSend false), browse (/api/cleaners
// hides blocked cleaners from the viewer), offers (MatchingService drops
// blocked pairs for every offer path), the cleaner's job door, and a new
// cleaner-first booking request. Existing bookings are never touched: a block
// changes who can reach whom from now on, not any booking already made.
import { prisma } from '@/lib/db/prisma';

/** Every user id blocked in either direction with `userId`. */
export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return ids;
}

/** True when either user has blocked the other. */
export async function isBlockedPair(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}
