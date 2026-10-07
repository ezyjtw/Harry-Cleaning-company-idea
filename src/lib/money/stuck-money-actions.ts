// B4 (RENA-015): the stuck-money queue's actions, by name. Each runs the
// service function that owns the state (read Stripe, or move money through
// its keyed, idempotent path); every money move is audited there with the
// acting admin. The admin route is a thin door onto runStuckMoneyAction.

import type { AbnormalAction } from './abnormal-states';

export const STUCK_MONEY_ACTIONS: readonly AbnormalAction[] = [
  'RECONCILE_REFUND_SLICE',
  'ATTACH_REFUND_ID',
  'MARK_SLICE_NOT_EXECUTED',
  'RETRY_REFUND_REMAINDER',
  'RECONCILE_REVERSAL',
  'RECONCILE_BOOKING_REFUNDS',
  'APPLY_DASHBOARD_REFUND',
  'RELEASE_NOW',
  'RESUME_RELEASE',
  'ACCEPT_SHORTFALL_RELEASE',
  'ACKNOWLEDGE_CHARGEBACK',
  'SETTLE_LOST_CHARGEBACK',
  'RECONCILE_TOPUP',
  'REFUND_TOPUP',
  'RETRY_DISPUTE_MONEY',
  'SET_RELEASE_CLOCK',
  'RECONCILE_RECURRING_CHARGE',
  'RETRY_REVERT',
];

export async function runStuckMoneyAction(
  action: AbnormalAction,
  bookingId: string,
  refId: string,
  adminId: string,
  /** Free input some actions take (the refund id for ATTACH_REFUND_ID). */
  input?: string
): Promise<{ ok: boolean; message: string }> {
  switch (action) {
    case 'RECONCILE_REFUND_SLICE': {
      const { reconcileRefundSlice } = await import('@/lib/services/refund.service');
      const status = await reconcileRefundSlice(refId);
      return { ok: true, message: `Refund slice is ${status}` };
    }
    case 'ATTACH_REFUND_ID': {
      const { attachRefundToSlice } = await import('@/lib/services/refund.service');
      if (!input) return { ok: false, message: 'A Stripe refund id is required' };
      return attachRefundToSlice(refId, input.trim(), adminId);
    }
    case 'MARK_SLICE_NOT_EXECUTED': {
      const { markSliceNotExecuted } = await import('@/lib/services/refund.service');
      return markSliceNotExecuted(refId, adminId);
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
    case 'APPLY_DASHBOARD_REFUND': {
      const { applyExternalRefund } = await import('@/lib/services/refund.service');
      const r = await applyExternalRefund(refId);
      return {
        ok: r !== 'DEFERRED',
        message:
          r === 'DEFERRED'
            ? 'Still waiting: money in flight or a reversal pending'
            : `Dashboard refund ${r.toLowerCase()}`,
      };
    }
    case 'RELEASE_NOW': {
      const { releaseBookingFunds } = await import('@/lib/services/transfer.service');
      const r = await releaseBookingFunds(bookingId, { trigger: 'ADMIN', actorId: adminId });
      const ok = r.status === 'RELEASED' || r.status === 'ALREADY_RELEASED';
      return { ok, message: `${r.status}${r.reason ? `: ${r.reason}` : ''}` };
    }
    case 'RESUME_RELEASE': {
      // Refused while any hold remains; otherwise PAUSED to PENDING and release.
      const { resumeIfUnheld } = await import('@/lib/services/money-holds.service');
      const r = await resumeIfUnheld(bookingId, { trigger: 'ADMIN', actorId: adminId });
      const ok = r.status === 'RELEASED' || r.status === 'ALREADY_RELEASED';
      return { ok, message: `${r.status}${r.reason ? `: ${r.reason}` : ''}` };
    }
    case 'ACCEPT_SHORTFALL_RELEASE': {
      const { acceptShortfallAndRelease } = await import('@/lib/services/money-holds.service');
      const r = await acceptShortfallAndRelease(bookingId, adminId, input ?? '');
      return {
        ok: r.ok,
        message: r.ok ? 'Shortfall accepted; release resumed' : (r.error ?? 'Refused'),
      };
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
