import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { paidVisibleWhere } from '@/lib/booking/own-booking';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { buildJobIcs } from '@/lib/services/job-ics';
import { getTransferAmountPence } from '@/lib/services/transfer-amount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// F8: serve the accepted job's .ics. The file carries the FULL ADDRESS, so the
// gate is the address law itself: the ASSIGNED cleaner, post-accept statuses
// only. Notes/keyAccess never ride (see job-ics.ts) — the description links to
// the job detail instead.
const POST_ACCEPT_STATUSES = ['ACCEPTED', 'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS'] as const;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'CLEANER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: params.id,
      cleanerId: user.id,
      status: { in: [...POST_ACCEPT_STATUSES] },
      ...paidVisibleWhere(),
    },
    // F24.1: occurrences must be visibly recurring — the .ics says so too.
    include: { agreement: { select: { frequency: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const fullAddress = [
    booking.addressLine1,
    booking.addressLine2,
    booking.addressCity,
    booking.addressPostcode,
  ]
    .filter(Boolean)
    .join(', ');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network';

  const ics = buildJobIcs({
    id: booking.id,
    serviceLabel: serviceLabelFromSlug(booking.serviceType),
    date: booking.date.toISOString().split('T')[0],
    startTime: booking.startTime,
    durationHours: Number(booking.duration),
    fullAddress,
    cleanerEarnings: getTransferAmountPence(Number(booking.cleanerEarnings)) / 100,
    detailUrl: `${appUrl}/cleaner/jobs/${booking.id}`,
    suppliesProvided: booking.suppliesProvided,
    recurringLabel: booking.agreement
      ? booking.agreement.frequency === 'WEEKLY'
        ? 'weekly'
        : 'every two weeks'
      : null,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="rena-clean-${booking.date.toISOString().split('T')[0]}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
