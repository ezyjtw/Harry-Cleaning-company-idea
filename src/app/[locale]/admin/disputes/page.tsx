import { prisma } from '@/lib/db/prisma';
import type { DisputeStatus } from '@/lib/types';

import DisputesList from './DisputesList';
import type { AdminDispute } from './DisputesList';

export const dynamic = 'force-dynamic';

// Map Prisma DisputeStatus enum values to UI status strings
function mapPrismaStatus(prismaStatus: string): DisputeStatus {
  switch (prismaStatus) {
    case 'OPEN':
      return 'open';
    case 'UNDER_REVIEW':
      return 'under-review';
    case 'RESOLVED':
      return 'resolved-customer'; // Default resolved mapping
    case 'DISMISSED':
      return 'resolved-cleaner'; // Dismissed maps to resolved for cleaner
    default:
      return 'open';
  }
}

async function getDisputes(): Promise<AdminDispute[]> {
  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      booking: {
        include: {
          client: { select: { name: true, role: true } },
          cleaner: { select: { name: true } },
        },
      },
      raisedBy: { select: { id: true, name: true, role: true } },
      evidence: { orderBy: { uploadedAt: 'asc' } },
    },
  });

  return disputes.map((d) => {
    const isFiledByCleaner = d.raisedBy?.role === 'CLEANER';

    // If there's a resolution note containing "split", map to resolved-split
    let status = mapPrismaStatus(d.status);
    if (d.status === 'RESOLVED' && d.resolution?.toLowerCase().includes('split')) {
      status = 'resolved-split';
    }
    if (d.status === 'RESOLVED' && d.resolution?.toLowerCase().includes('cleaner')) {
      status = 'resolved-cleaner';
    }

    return {
      id: d.id.substring(0, 8).toUpperCase(),
      bookingRef: d.booking.id.substring(0, 8).toUpperCase(),
      customerName: d.booking.client?.name || d.booking.guestName || 'Guest',
      cleanerName: d.booking.cleaner.name || 'Unassigned',
      reason: d.reason as AdminDispute['reason'],
      description: d.description,
      dateRaised: d.createdAt.toISOString().split('T')[0],
      status,
      amount: Number(d.booking.totalPrice),
      filedBy: isFiledByCleaner ? ('cleaner' as const) : ('customer' as const),
      // Evidence viewer links (auth'd party-or-admin decrypt-stream route). Full
      // dispute id is used in the URL even though the display id is truncated.
      evidence: d.evidence.map((ev) => ({
        id: ev.id,
        type: ev.type,
        fileName: ev.fileName,
        uploadedBy:
          ev.uploadedBy === d.booking.clientId
            ? ('customer' as const)
            : ev.uploadedBy === d.booking.cleanerId
              ? ('cleaner' as const)
              : ('Rena team' as const),
        url: `/api/disputes/${d.id}/evidence/${ev.id}`,
      })),
    };
  });
}

export default async function AdminDisputesPage() {
  const disputes = await getDisputes();

  return <DisputesList initialDisputes={disputes} />;
}
