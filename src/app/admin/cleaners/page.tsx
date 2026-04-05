import { prisma } from '@/lib/db/prisma';
import AdminCleanersClient from './AdminCleanersClient';

export interface CleanerRow {
  id: string;
  name: string;
  email: string;
  tier: string;
  rating: number;
  verified: boolean;
  activeBookings: number;
  completedJobs: number;
  status: 'active' | 'suspended' | 'pending-approval';
}

async function getCleaners(): Promise<{ cleaners: CleanerRow[]; total: number }> {
  const cleaners = await prisma.user.findMany({
    where: { role: 'CLEANER', isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      isSuspended: true,
      accountStatus: true,
      cleanerProfile: {
        select: {
          tier: true,
          rating: true,
          verified: true,
          completedJobs: true,
        },
      },
      _count: {
        select: {
          bookingsAsCleaner: {
            where: { status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'] } },
          },
        },
      },
    },
  });

  const rows: CleanerRow[] = cleaners.map((c) => {
    let status: CleanerRow['status'] = 'active';
    if (c.isSuspended || c.accountStatus === 'SUSPENDED') status = 'suspended';
    else if (!c.cleanerProfile?.verified) status = 'pending-approval';

    return {
      id: c.id.substring(0, 8).toUpperCase(),
      name: c.name || 'Unknown',
      email: c.email,
      tier: c.cleanerProfile?.tier?.toLowerCase() || 'starter',
      rating: Number(c.cleanerProfile?.rating || 0),
      verified: c.cleanerProfile?.verified || false,
      activeBookings: c._count.bookingsAsCleaner,
      completedJobs: c.cleanerProfile?.completedJobs || 0,
      status,
    };
  });

  return { cleaners: rows, total: rows.length };
}

export default async function AdminCleanersPage() {
  const { cleaners, total } = await getCleaners();
  return <AdminCleanersClient cleaners={cleaners} total={total} />;
}
