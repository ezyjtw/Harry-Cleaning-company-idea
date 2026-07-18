import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { ADMIN_DESTRUCTIVE_ENABLED } from '@/lib/config/features';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

// SECURITY (S3): break-glass status override, now with guardrails. There is
// deliberately NO force path around the money blocks: every money-crossing
// operation has its own safer tool (admin/refund + retry-refund for refunds,
// release-funds for stuck transfers, dispute resolution for pause/split), so
// this tool never needs to cross a money boundary — a force flag would simply
// re-open the S3 hole behind one extra click.

const VALID_STATUSES = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'REVIEWED',
  'CANCELLED',
  'DISPUTED',
  'CASCADE_EXHAUSTED',
  'CLEANER_CANCELLED',
] as const;

type Status = (typeof VALID_STATUSES)[number];

// CascadePhase list, minus RENA_FIND (James-ruled, H22 merge): the wider-network
// broadcast phase may only ever be entered with customer consent — booking-time
// opt-in or rescue-① — never set by hand. Admins who need a rebroadcast use the
// rena-find-rebroadcast tool, which enforces the consent flag.
const VALID_CASCADE_PHASES = [
  'PRIMARY_OFFER',
  'BACKUP_OFFER',
  'COMBINED_OFFER',
  'CASCADE_EXHAUSTED',
  'PROVISIONAL_APPROVAL',
  'PHASE2_RESERVE',
  'RENA_FIND_ADMIN_REVIEW',
] as const;

// S3a: legal transitions, derived from the real lifecycle (PENDING → payment →
// AWAITING_CLEANER → offer/accept → CONFIRMED/ACCEPTED → EN_ROUTE → IN_PROGRESS
// → COMPLETED → REVIEWED, with DISPUTED / CANCELLED / CASCADE_EXHAUSTED as
// branches). Admin-grade: each state also allows the one-step-backward
// "un-stick" corrections support genuinely needs, but never a jump that
// fabricates history (e.g. PENDING → COMPLETED) and never OUT of CANCELLED —
// cancellation is owned by the cancel/refund services, and reviving a cancelled
// booking here would resurrect state whose money may already be refunded.
const LEGAL_TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ['AWAITING_CLEANER', 'CANCELLED'],
  AWAITING_CLEANER: ['ACCEPTED', 'CONFIRMED', 'CANCELLED', 'CASCADE_EXHAUSTED'],
  ACCEPTED: ['CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS', 'AWAITING_CLEANER', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'AWAITING_CLEANER', 'CANCELLED'],
  EN_ROUTE: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['EN_ROUTE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['IN_PROGRESS', 'REVIEWED', 'DISPUTED'],
  REVIEWED: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [], // terminal — no override resurrects a cancelled booking
  CASCADE_EXHAUSTED: ['AWAITING_CLEANER', 'CANCELLED'],
  // M3 rescue holding state: admin can hand it back to matching or cancel it
  // (cancel via override skips the refund — use the cancel tools for money);
  // nothing transitions INTO it manually — only a cleaner's cancel creates it.
  CLEANER_CANCELLED: ['AWAITING_CLEANER', 'CANCELLED'],
};

// S3b: transfer states in which money is IN FLIGHT — no override may touch the
// booking at all while one of these is set.
const TRANSFER_IN_FLIGHT = ['RELEASING', 'REFUNDING', 'UNKNOWN'];
// With the transfer EXECUTED (RELEASED), only cosmetic post-completion moves are
// allowed; anything else would contradict moved money or re-arm machinery.
const RELEASED_SAFE_TARGETS: Status[] = ['COMPLETED', 'REVIEWED'];

export async function POST(request: NextRequest) {
  if (!ADMIN_DESTRUCTIVE_ENABLED) {
    return NextResponse.json({ error: 'Destructive admin actions are disabled' }, { status: 403 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId, status, cascadePhase } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  // S3c: a reason is REQUIRED on every use — this is a break-glass tool and the
  // audit trail must say why it was pulled.
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 5) {
    return NextResponse.json(
      { error: 'A reason is required (min 5 characters) for every status override.' },
      { status: 400 }
    );
  }

  if (status === undefined && cascadePhase === undefined) {
    return NextResponse.json(
      { error: 'At least one of status or cascadePhase must be provided' },
      { status: 400 }
    );
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  if (
    cascadePhase !== undefined &&
    cascadePhase !== null &&
    !VALID_CASCADE_PHASES.includes(cascadePhase)
  ) {
    return NextResponse.json(
      { error: `Invalid cascadePhase. Valid: ${VALID_CASCADE_PHASES.join(', ')} or null` },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      cascadePhase: true,
      paymentStatus: true,
      transferStatus: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // ── S3b: money-moved hard blocks (no force path — see docblock) ──

  // Fully refunded = settled money: nothing may be overridden.
  if (booking.paymentStatus === 'REFUNDED') {
    return NextResponse.json(
      {
        error:
          'This booking is REFUNDED — settled money. Overrides are blocked; use the refund/booking tools for any follow-up.',
      },
      { status: 409 }
    );
  }

  // Money in flight: never touch mid-operation.
  if (TRANSFER_IN_FLIGHT.includes(booking.transferStatus)) {
    return NextResponse.json(
      {
        error: `Transfer is ${booking.transferStatus} (money in flight) — retry after it settles.`,
      },
      { status: 409 }
    );
  }

  if (status !== undefined && status !== booking.status) {
    // Transfer already executed: only cosmetic post-completion moves.
    if (booking.transferStatus === 'RELEASED' && !RELEASED_SAFE_TARGETS.includes(status)) {
      return NextResponse.json(
        {
          error:
            'Funds for this booking were already released. Only COMPLETED ⇄ REVIEWED corrections are allowed; cancellations/disputes on released money must go through the dispute/refund tools.',
        },
        { status: 409 }
      );
    }
    // Partially refunded: cancellation implies refund machinery this tool does not run.
    if (booking.paymentStatus === 'PARTIALLY_REFUNDED' && status === 'CANCELLED') {
      return NextResponse.json(
        {
          error:
            'This booking has a partial refund — cancel it through the cancellation/refund flow so the remaining money is handled, not via override.',
        },
        { status: 409 }
      );
    }

    // ── S3a: legal-transition check ──
    const from = booking.status as Status;
    const allowed = LEGAL_TRANSITIONS[from] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Illegal transition ${from} → ${status}. Allowed from ${from}: ${
            allowed.length > 0 ? allowed.join(', ') : '(none — terminal state)'
          }.`,
        },
        { status: 409 }
      );
    }
  }

  // Cascade-phase overrides only make sense while the booking is still being
  // matched — block them once money has moved.
  if (
    cascadePhase !== undefined &&
    cascadePhase !== booking.cascadePhase &&
    booking.transferStatus === 'RELEASED'
  ) {
    return NextResponse.json(
      { error: 'Funds already released — cascade phase can no longer be overridden.' },
      { status: 409 }
    );
  }

  const changes: Record<string, unknown> = {};
  const auditChanges: { field: string; from: string | null; to: string | null }[] = [];

  if (status !== undefined && status !== booking.status) {
    changes.status = status;
    auditChanges.push({ field: 'status', from: booking.status, to: status });
  }

  if (cascadePhase !== undefined && cascadePhase !== booking.cascadePhase) {
    changes.cascadePhase = cascadePhase;
    auditChanges.push({
      field: 'cascadePhase',
      from: booking.cascadePhase,
      to: cascadePhase,
    });
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ message: 'No changes — values already match' });
  }

  await prisma.booking.update({ where: { id: bookingId }, data: changes });

  // S3d: full audit — actor, booking, from→to, and the required reason.
  await AuditService.log({
    userId: admin.id,
    action: 'ADMIN_STATUS_OVERRIDE',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { changes: auditChanges, reason },
  }).catch(() => {});

  return NextResponse.json({ updated: auditChanges });
}
