import { prisma } from '@/lib/db/prisma';

import AdminCleanersClient from './AdminCleanersClient';

export const dynamic = 'force-dynamic';

export interface CleanerRow {
  id: string;
  fullId: string;
  name: string;
  email: string;
  tier: string;
  rating: number;
  verified: boolean;
  activeBookings: number;
  completedJobs: number;
  docCount: number;
  hasSelfie: boolean;
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
          id: true,
          tier: true,
          rating: true,
          verified: true,
          completedJobs: true,
        },
      },
      _count: {
        select: {
          bookingsAsCleaner: {
            where: {
              status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'] },
            },
          },
        },
      },
    },
  });

  const profileIds = cleaners.map((c) => c.cleanerProfile?.id).filter((id): id is string => !!id);

  const docCounts =
    profileIds.length > 0
      ? await prisma.documentUpload.groupBy({
          by: ['profileId', 'documentType'],
          where: { profileId: { in: profileIds }, isDestroyed: false },
        })
      : [];

  const docCountMap = new Map<string, { total: number; hasSelfie: boolean }>();
  for (const row of docCounts) {
    if (!row.profileId) continue;
    const entry = docCountMap.get(row.profileId) || { total: 0, hasSelfie: false };
    entry.total++;
    if (row.documentType === 'selfie') entry.hasSelfie = true;
    docCountMap.set(row.profileId, entry);
  }

  const rows: CleanerRow[] = cleaners.map((c) => {
    let status: CleanerRow['status'] = 'active';
    if (c.isSuspended || c.accountStatus === 'SUSPENDED') status = 'suspended';
    else if (!c.cleanerProfile?.verified) status = 'pending-approval';

    const docInfo = c.cleanerProfile?.id ? docCountMap.get(c.cleanerProfile.id) : undefined;

    return {
      id: c.id.substring(0, 8).toUpperCase(),
      fullId: c.id,
      name: c.name || 'Unknown',
      email: c.email,
      tier: c.cleanerProfile?.tier?.toLowerCase() || 'starter',
      rating: Number(c.cleanerProfile?.rating || 0),
      verified: c.cleanerProfile?.verified || false,
      activeBookings: c._count.bookingsAsCleaner,
      completedJobs: c.cleanerProfile?.completedJobs || 0,
      docCount: docInfo?.total || 0,
      hasSelfie: docInfo?.hasSelfie || false,
      status,
    };
  });

  return { cleaners: rows, total: rows.length };
}

export default async function AdminCleanersPage() {
  const { cleaners, total } = await getCleaners();
  return <AdminCleanersClient cleaners={cleaners} total={total} />;
}
