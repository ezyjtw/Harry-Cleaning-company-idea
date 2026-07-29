import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { notOwnBookingWhere, paidVisibleWhere } from '@/lib/booking/own-booking';
import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import type { ServiceSlug } from '@/lib/services/pricing.service';
import { cleanerEarningsBreakdown, pricingService } from '@/lib/services/pricing.service';
import { bookingFullAddress, bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';

export async function GET(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // comma-separated statuses
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  // F6a: ABANDONED (never-paid) is NOT cleaner business — no offer ever fired.
  // It can neither be requested explicitly nor ride the unfiltered default.
  // F6a + R1-A: ABANDONED (never-paid) and SCHEDULED (future occurrence,
  // pre-charge) are NOT cleaner-jobs business — neither requestable nor
  // riding the unfiltered default. SCHEDULED lives on the calendar instead.
  const HIDDEN_FROM_JOBS = ['ABANDONED', 'SCHEDULED'];
  const statusIn = statusFilter
    ? statusFilter
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => !HIDDEN_FROM_JOBS.includes(s))
    : undefined;

  const baseStatusFilter = statusIn ? { in: statusIn } : { notIn: HIDDEN_FROM_JOBS as never[] };

  // Primary path: bookings assigned to this cleaner, excluding those that moved
  // past their cascade phase (BACKUP_OFFER means primary's turn is over)
  const primaryWhereWithCascade: Record<string, unknown> = {
    cleanerId: user.id,
    OR: [{ cascadePhase: null }, { cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] } }],
    NOT: { declinedCleanerIds: { has: user.id } },
  };
  if (baseStatusFilter) {
    primaryWhereWithCascade.status = baseStatusFilter;
  }

  // Backup/combined path: bookings where this cleaner is a backup being offered.
  // PHASE2_RESERVE is included so re-opened jobs are still acceptable (at-or-below),
  // but cleaners already held in reserve are excluded — they can't re-accept.
  const backupWhere: Record<string, unknown> = {
    backupCleanerIds: { has: user.id },
    cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'PHASE2_RESERVE', 'RENA_FIND'] },
    status: 'AWAITING_CLEANER',
    NOT: [{ declinedCleanerIds: { has: user.id } }, { reserveCleanerIds: { has: user.id } }],
  };

  // Provisional path: cleaner provisionally accepted, awaiting customer approval
  const provisionalWhere: Record<string, unknown> = {
    provisionalCleanerId: user.id,
    cascadePhase: 'PROVISIONAL_APPROVAL',
    status: 'AWAITING_CLEANER',
  };

  // Reserve path: cleaner is held in reserve (pending — promoted only if no
  // at-or-below cleaner accepts). Visible while the booking is still resolving.
  const reserveWhere: Record<string, unknown> = {
    reserveCleanerIds: { has: user.id },
    cascadePhase: { in: ['PHASE2_RESERVE', 'PROVISIONAL_APPROVAL'] },
    status: 'AWAITING_CLEANER',
  };

  // H14: the backup/provisional/reserve branches are ALL offer states pinned
  // to AWAITING_CLEANER — previously they ignored the caller's status filter,
  // so a pending offer rendered on every tab (Upcoming, On the way, Completed).
  // They now ride along ONLY when the requested statuses include
  // AWAITING_CLEANER (or no filter was given) — offers live in Pending alone.
  const includeOfferBranches = !statusIn || statusIn.includes('AWAITING_CLEANER');
  // H38: the viewer's OWN customer purchase never appears through the job door.
  const where = includeOfferBranches
    ? {
        AND: [
          notOwnBookingWhere(user.id),
          // H53: no payment → no visibility. Guards the null-cascade primary
          // branch, which would otherwise show a freshly-created (unpaid,
          // cascadePhase-null) cleaner-first booking as a phantom offer.
          paidVisibleWhere(),
          { OR: [primaryWhereWithCascade, backupWhere, provisionalWhere, reserveWhere] },
        ],
      }
    : {
        AND: [notOwnBookingWhere(user.id), paidVisibleWhere(), { OR: [primaryWhereWithCascade] }],
      };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        client: { select: { name: true } },
        address: { select: { line1: true, city: true, postcode: true } },
        // F24.1: occurrences must be visibly recurring on every surface.
        agreement: { select: { frequency: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  const jobs = await Promise.all(
    bookings.map(async (b) => {
      const isPrimary = b.cleanerId === user.id;
      const isProvisional =
        b.cascadePhase === 'PROVISIONAL_APPROVAL' &&
        (b as Record<string, unknown>).provisionalCleanerId === user.id;
      const isReserve = (b.reserveCleanerIds ?? []).includes(user.id);

      let viewerEarnings: number | null = null;
      // F24.3: the viewer's own breakdown (backup seat prices at THEIR rates).
      let viewerBreakdown: ReturnType<typeof cleanerEarningsBreakdown> = null;

      const isRenaFind = b.cascadePhase === 'RENA_FIND' && b.backupCleanerIds.includes(user.id);

      if (!isPrimary && !isProvisional && !isRenaFind) {
        try {
          const pricingSlug = normalizeToPricingSlug(b.serviceType);
          const propertySize = b.propertySize
            ? propertySizeEnumToSlug(b.propertySize as Parameters<typeof propertySizeEnumToSlug>[0])
            : undefined;
          const quote = await pricingService.calculateQuote({
            cleanerId: user.id,
            serviceSlug: pricingSlug as ServiceSlug,
            hours: Number(b.duration),
            propertySize,
            addons: b.extras,
          });
          viewerEarnings = quote.cleanerPayout;
          viewerBreakdown = cleanerEarningsBreakdown({
            serviceType: b.serviceType,
            customerSubtotal: quote.cleanerListedPrice,
            cleanerEarnings: quote.cleanerPayout,
            extras: b.extras,
          });
        } catch {
          // If quoting fails, fall back to stored values — better than hiding the job
        }
      }

      return {
        id: b.id,
        clientName: b.client?.name || b.guestName || 'Guest',
        // A12: read address from the booking columns (legacy relation fallback in helper).
        address:
          b.status === 'PENDING' || b.status === 'AWAITING_CLEANER'
            ? bookingPostcode(b) || 'TBD'
            : `${bookingLine1(b)}, ${bookingPostcode(b)}`,
        fullAddress:
          b.cleanerId === user.id &&
          b.status !== 'PENDING' &&
          b.status !== 'AWAITING_CLEANER' &&
          b.status !== 'CASCADE_EXHAUSTED'
            ? bookingFullAddress(b)
            : undefined,
        date: b.date.toISOString().split('T')[0],
        time: b.startTime,
        serviceType: b.serviceType,
        // F24.3: customer-side money (total, 6% service fee) no longer rides
        // to cleaner clients at all — the breakdown below is the cleaner's own
        // arithmetic and the only money this payload carries.
        cleanerEarnings: Number(b.cleanerEarnings),
        // F24.1: non-null frequency marks a recurring occurrence.
        recurringFrequency: b.agreement?.frequency ?? null,
        // F24.3: the cleaner's own arithmetic from the stored snapshot —
        // "Your rate £X − Rena fee (N%) £Y = You receive £Z". Null when the
        // stored numbers don't reconcile to the penny (render labelled net).
        earningsBreakdown: cleanerEarningsBreakdown({
          serviceType: b.serviceType,
          customerSubtotal: b.customerSubtotal,
          cleanerEarnings: Number(b.cleanerEarnings),
          extras: b.extras,
        }),
        status: b.status.toLowerCase(),
        paymentStatus: b.paymentStatus,
        duration: Number(b.duration),
        notes: b.notes,
        cleanerNotes: b.cleanerNotes,
        bedrooms: (b.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
        extras: b.extras,
        cascadePhase: b.cascadePhase,
        isPrimary,
        isProvisional,
        isReserve,
        viewerEarnings,
        viewerBreakdown,
      };
    })
  );

  return NextResponse.json({
    jobs,
    total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}
