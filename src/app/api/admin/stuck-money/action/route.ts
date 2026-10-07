// POST /api/admin/stuck-money/action { action, bookingId, refId }
//
// B4 (RENA-015): the stuck-money queue's actions, by name. Each one runs the
// service function that owns the state (read Stripe, or move money through
// its keyed, idempotent path); every money move is audited there with the
// acting admin. Replaces /api/admin/bookings/retry-refund.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { log } from '@/lib/log';
import type { AbnormalAction } from '@/lib/money/abnormal-states';

const ACTIONS: readonly AbnormalAction[] = [
  'RECONCILE_REFUND_SLICE',
  'RETRY_REFUND_REMAINDER',
  'RECONCILE_REVERSAL',
  'RECONCILE_BOOKING_REFUNDS',
  'RELEASE_NOW',
  'CLEAR_SHORTFALL',
  'ACKNOWLEDGE_CHARGEBACK',
  'SETTLE_LOST_CHARGEBACK',
  'RECONCILE_TOPUP',
  'REFUND_TOPUP',
  'RETRY_DISPUTE_MONEY',
  'SET_RELEASE_CLOCK',
  'RECONCILE_RECURRING_CHARGE',
  'RETRY_REVERT',
];

async function run(
  action: AbnormalAction,
  bookingId: string,
  refId: string,
  adminId: string
): Promise<{ ok: boolean; message: string }> {
  switch (action) {
    case 'RECONCILE_REFUND_SLICE': {
      const { reconcileRefundSlice } = await import('@/lib/services/refund.service');
      const status = await reconcileRefundSlice(refId);
      return { ok: true, message: `Refund slice is ${status}` };
    }
    case 'RETRY_REFUND_REMAINDER': {
      const { retryRefundRemainder } = await import('@/lib/services/refund.service');
      const r = await retryRefundRemainder(refId, adminId);
      const ok = r.status === 'REFUNDED' || r.status === 'PARTIALLY_REFUNDED';
      return { ok, message: ok ? `Refunded (${r.status})` : `${r.status}: ${r.reason ?? ''}` };
    }
    case 'RECONCILE_REVERSAL': {
      const { reconcileReversal } = await import('@/lib/services/refund.service');
      const status = await reconcileReversal(refId);
      return { ok: true, message: `Reversal is ${status}` };
    }
    case 'RECONCILE_BOOKING_REFUNDS': {
      const { recoverStaleRefunding } = await import('@/lib/services/refund.service');
      const r = await recoverStaleRefunding(bookingId);
      return { ok: true, message: `Transfer is now ${r.transferStatus ?? 'unknown'}` };
    }
    case 'RELEASE_NOW': {
      const { releaseBookingFunds } = await import('@/lib/services/transfer.service');
      const r = await releaseBookingFunds(bookingId, { trigger: 'ADMIN', actorId: adminId });
      const ok = r.status === 'RELEASED' || r.status === 'ALREADY_RELEASED';
      return { ok, message: `${r.status}${r.reason ? `: ${r.reason}` : ''}` };
    }
    case 'CLEAR_SHORTFALL': {
      const { clearShortfall } = await import('@/lib/services/money-holds.service');
      const r = await clearShortfall(bookingId, adminId);
      return { ok: r.ok, message: r.ok ? 'Shortfall cleared' : (r.error ?? 'Refused') };
    }
    case 'ACKNOWLEDGE_CHARGEBACK': {
      const { acknowledgeChargebackAfterRelease } =
        await import('@/lib/services/money-holds.service');
      const r = await acknowledgeChargebackAfterRelease(refId, adminId);
      return { ok: r.ok, message: r.ok ? 'Recorded as dealt with' : (r.error ?? 'Refused') };
    }
    case 'SETTLE_LOST_CHARGEBACK': {
      const { settleLostChargeback } = await import('@/lib/services/money-holds.service');
      const r = await settleLostChargeback(refId, adminId);
      return { ok: r.ok, message: r.ok ? 'Hold lifted' : (r.error ?? 'Refused') };
    }
    case 'RECONCILE_TOPUP': {
      const { reconcileTopup } = await import('@/lib/services/topup.service');
      const status = await reconcileTopup(refId);
      return { ok: true, message: `Top-up is ${status}` };
    }
    case 'REFUND_TOPUP': {
      const { refundFlaggedTopup } = await import('@/lib/services/refund.service');
      const r = await refundFlaggedTopup(refId, adminId);
      const ok = r.status === 'REFUNDED' || r.status === 'PARTIALLY_REFUNDED';
      return { ok, message: ok ? 'Top-up refunded' : `${r.status}: ${r.reason ?? ''}` };
    }
    case 'RETRY_DISPUTE_MONEY': {
      const { runDisputeMoneyStep } = await import('@/lib/services/dispute-resolution.service');
      const { AuditService } = await import('@/lib/services/audit.service');
      await AuditService.log({
        userId: adminId,
        action: 'DISPUTE_MONEY_RETRIED',
        entityType: 'Dispute',
        entityId: refId,
        metadata: { bookingId },
      }).catch(() => {});
      const r = await runDisputeMoneyStep(refId);
      return {
        ok: r.disputeStatus === 'RESOLVED',
        message:
          r.disputeStatus === 'RESOLVED'
            ? 'Dispute resolved'
            : `Still ${r.disputeStatus}: ${r.lastMoneyError ?? ''}`,
      };
    }
    case 'SET_RELEASE_CLOCK': {
      const { setReleaseClock } = await import('@/lib/services/transfer.service');
      const ok = await setReleaseClock(bookingId, adminId);
      return { ok, message: ok ? 'Release clock set to now' : 'Booking no longer qualifies' };
    }
    case 'RECONCILE_RECURRING_CHARGE': {
      const { reconcileUnknownOccurrenceCharge } =
        await import('@/lib/services/recurring-charge.service');
      const r = await reconcileUnknownOccurrenceCharge(bookingId);
      return { ok: r !== 'PENDING', message: `Charge outcome: ${r}` };
    }
    case 'RETRY_REVERT': {
      const { retryAdminRevert } = await import('@/lib/services/cascade.service');
      const r = await retryAdminRevert(bookingId, adminId);
      return { ok: r.ok, message: r.outcome };
    }
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  let body: { action?: unknown; bookingId?: unknown; refId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { action, bookingId, refId } = body;
  if (typeof action !== 'string' || !ACTIONS.includes(action as AbnormalAction)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (typeof bookingId !== 'string' || !bookingId || typeof refId !== 'string' || !refId) {
    return NextResponse.json({ error: 'bookingId and refId are required' }, { status: 400 });
  }
  try {
    const result = await run(action as AbnormalAction, bookingId, refId, admin.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    log.error('stuck_money', 'action_failed', { action, bookingId }, err);
    return NextResponse.json(
      { ok: false, message: 'The action failed; nothing further was changed. Check the logs.' },
      { status: 500 }
    );
  }
}
