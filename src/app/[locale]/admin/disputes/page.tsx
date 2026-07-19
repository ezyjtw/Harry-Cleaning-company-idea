import { prisma } from '@/lib/db/prisma';
import type { DisputeStatus } from '@/lib/types';

import DisputesList from './DisputesList';
import type { AdminDispute } from './DisputesList';

export const dynamic = 'force-dynamic';

// H61: the resolution FLAVOUR is derived from what actually happened to the
// money, not from string-sniffing the admin's free-text note (which mislabeled
// any note mentioning "cleaner"). refund-customer resolutions cancel the
// booking; split resolutions leave a SUCCEEDED refund record tagged
// "(split)"; everything else released to the cleaner.
function mapPrismaStatus(d: {
  status: string;
  booking: { status: string; refundRecords: { reason: string }[] };
}): DisputeStatus {
  switch (d.status) {
    case 'OPEN':
      return 'open';
    case 'UNDER_REVIEW':
      return 'under-review';
    case 'DISMISSED':
      return 'dismissed';
    case 'RESOLVED': {
      if (d.booking.status === 'CANCELLED') return 'resolved-customer'; // refunded in full
      if (d.booking.refundRecords.some((r) => r.reason.startsWith('Dispute resolved (split)'))) {
        return 'resolved-split'; // refunded partially
      }
      return 'resolved-cleaner'; // no refund — released to cleaner
    }
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
          refundRecords: { where: { status: 'SUCCEEDED' }, select: { reason: true } },
        },
      },
      raisedBy: { select: { id: true, name: true, role: true } },
      evidence: { orderBy: { uploadedAt: 'asc' } },
    },
  });

  return disputes.map((d) => {
    const isFiledByCleaner = d.raisedBy?.role === 'CLEANER';
    const status = mapPrismaStatus(d);

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
