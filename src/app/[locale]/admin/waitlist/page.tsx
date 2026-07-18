import { prisma } from '@/lib/db/prisma';

import AdminWaitlistClient from './AdminWaitlistClient';

export const dynamic = 'force-dynamic';

export interface WaitlistRow {
  id: string;
  email: string;
  postcode: string;
  source: string;
  date: string;
}

// F-A: out-of-area interest, newest first — so James can email people the
// moment cleaners reach their area.
async function getWaitlist(): Promise<{ rows: WaitlistRow[]; total: number }> {
  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return {
    rows: entries.map((e) => ({
      id: e.id,
      email: e.email,
      postcode: e.postcode,
      source: e.source,
      date: e.createdAt.toISOString().split('T')[0],
    })),
    total: entries.length,
  };
}

export default async function AdminWaitlistPage() {
  const { rows, total } = await getWaitlist();
  return <AdminWaitlistClient rows={rows} total={total} />;
}
