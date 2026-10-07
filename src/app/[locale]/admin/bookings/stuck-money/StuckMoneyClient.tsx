'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import type { AbnormalAction, AbnormalRow, AbnormalStateName } from '@/lib/money/abnormal-states';

const STATE_HELP: Record<AbnormalStateName, string> = {
  REFUND_UNKNOWN:
    'A refund call ended without an answer. Reconcile reads Stripe; nothing is resent.',
  REFUND_FAILED:
    'A refund stopped short. Retry remainder reads Stripe first, then sends only what is missing.',
  REFUND_STALE_PENDING:
    'A refund has waited over ten minutes for Stripe. Reconcile reads its truth.',
  REVERSAL_UNKNOWN: 'A payout reversal ended without an answer. Reconcile reads the transfer.',
  TRANSFER_UNKNOWN:
    'A payout ended without an answer. Release now reconciles the transfer group first.',
  TRANSFER_FAILED: 'A payout was refused. Release now retries with a new key.',
  TRANSFER_RELEASING_STALE:
    'A payout has been in flight over ten minutes. Release now reconciles it.',
  TRANSFER_PAUSED_DISPUTE: 'The payout waits for the customer dispute.',
  TRANSFER_PAUSED_SHORTFALL:
    'Stripe received less than expected. Check Stripe, then clear the shortfall.',
  TRANSFER_PAUSED_CHARGEBACK: 'A card chargeback is open. The payout waits for its outcome.',
  CHARGEBACK_AFTER_RELEASE:
    'A chargeback arrived after the cleaner was paid. Deal with it, then record it.',
  CHARGEBACK_LOST: 'A chargeback was lost. The payout stays held until an admin decides.',
  REFUNDING_STALE:
    'A refund has held this booking over ten minutes. Reconcile reads Stripe and settles interrupted records.',
  TOPUP_UNKNOWN: 'A top-up outcome is unknown. Reconcile reads the payment intent.',
  TOPUP_FAILED: 'A top-up was declined while the booking still waits for approval.',
  TOPUP_STALE_PENDING:
    'A top-up is still pending after the window. Reconcile reads the payment intent.',
  TOPUP_WITHOUT_ASSIGNMENT:
    'A top-up was taken but the new cleaner could not be assigned. Refund the top-up.',
  SLICE_NEEDS_RECONCILE: 'A migrated payout is being filled from Stripe by the scheduler.',
  LEGACY_RECONCILE:
    'A migrated refund is not yet proven by Stripe. Reconcile reads it; refunds on this booking wait.',
  DISPUTE_RESOLVING:
    'A resolved dispute is waiting for its money step. It retries itself; Retry runs it now.',
  COMPLETED_NO_RELEASE_CLOCK:
    'A completed booking has no release time. Set it to release on the next tick.',
  RECURRING_CHARGE_UNKNOWN:
    'A regular-clean charge ended without an answer. It is never charged again while unknown.',
  REASSIGN_REVERT_CONFLICT:
    'A reassignment could not be reverted because the original cleaner lost the slot.',
};

const ACTION_LABEL: Record<AbnormalAction, string> = {
  RECONCILE_REFUND_SLICE: 'Reconcile with Stripe',
  RETRY_REFUND_REMAINDER: 'Retry remainder',
  RECONCILE_REVERSAL: 'Reconcile reversal',
  RECONCILE_BOOKING_REFUNDS: 'Reconcile',
  RELEASE_NOW: 'Release now',
  CLEAR_SHORTFALL: 'Clear shortfall',
  ACKNOWLEDGE_CHARGEBACK: 'Record as dealt with',
  SETTLE_LOST_CHARGEBACK: 'Release to cleaner anyway',
  RECONCILE_TOPUP: 'Reconcile',
  REFUND_TOPUP: 'Refund top-up',
  RETRY_DISPUTE_MONEY: 'Retry money step',
  SET_RELEASE_CLOCK: 'Set release clock',
  RECONCILE_RECURRING_CHARGE: 'Reconcile now',
  RETRY_REVERT: 'Retry revert',
};

// Actions that move money ask for a second tap.
const MOVES_MONEY: AbnormalAction[] = [
  'RETRY_REFUND_REMAINDER',
  'RELEASE_NOW',
  'CLEAR_SHORTFALL',
  'SETTLE_LOST_CHARGEBACK',
  'REFUND_TOPUP',
  'RETRY_DISPUTE_MONEY',
];

function fmtAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function ActionButton({ row, action }: { row: AbnormalRow; action: AbnormalAction }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const go = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const res = await fetch('/api/admin/stuck-money/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, bookingId: row.bookingId, refId: row.refId }),
      });
      const data = await res.json().catch(() => null);
      setResult({ ok: !!data?.ok, message: data?.message ?? data?.error ?? `HTTP ${res.status}` });
      if (data?.ok) router.refresh();
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setState('idle');
    }
  }, [action, row.bookingId, row.refId, router]);

  const label = ACTION_LABEL[action];
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {state === 'confirming' ? (
        <>
          <span className="text-xs text-ink-3">{label}?</span>
          <button
            onClick={go}
            className="px-2 py-1 text-xs font-medium text-white rounded bg-danger hover:bg-danger"
          >
            Yes
          </button>
          <button
            onClick={() => setState('idle')}
            className="px-2 py-1 text-xs font-medium text-ink-2 rounded border border-line hover:bg-page"
          >
            No
          </button>
        </>
      ) : state === 'loading' ? (
        <span className="text-xs text-ink-3">Working…</span>
      ) : (
        <button
          onClick={() => (MOVES_MONEY.includes(action) ? setState('confirming') : go())}
          className="px-2 py-1 text-xs font-medium text-primary rounded border border-line hover:bg-page"
        >
          {label}
        </button>
      )}
      {result && (
        <span className={`text-xs ${result.ok ? 'text-trust' : 'text-danger'}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}

export default function StuckMoneyClient({ rows }: { rows: AbnormalRow[] }) {
  const groups = new Map<AbnormalStateName, AbnormalRow[]>();
  for (const r of rows) groups.set(r.state, [...(groups.get(r.state) ?? []), r]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/bookings" className="text-sm text-primary hover:underline">
          &larr; All bookings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-1">Stuck Money</h1>
        <p className="text-ink-3 mt-1">
          {rows.length === 0
            ? 'Nothing is stuck. All clear.'
            : `${rows.length} item${rows.length !== 1 ? 's' : ''} across ${groups.size} state${groups.size !== 1 ? 's' : ''}, oldest first`}
        </p>
      </div>

      {Array.from(groups.entries()).map(([state, list]) => (
        <div key={state} className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
          <div className="px-6 py-3 bg-page border-b border-line">
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
              {state.replace(/_/g, ' ')} ({list.length})
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">{STATE_HELP[state]}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-ink-3 uppercase border-b border-line">
                  <th className="px-6 py-2">Booking</th>
                  <th className="px-6 py-2">Age</th>
                  <th className="px-6 py-2">Amount</th>
                  <th className="px-6 py-2">Detail</th>
                  <th className="px-6 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.key} className="hover:bg-page align-top">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/bookings/${r.bookingId}`}
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {r.bookingId.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-2">
                      {fmtAge(r.ageSeconds)}
                      {r.persistent && (
                        <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-danger/10 text-danger">
                          persistent
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-medium">
                      {r.amountPence === null ? '—' : `£${(r.amountPence / 100).toFixed(2)}`}
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-2 max-w-xs">{r.detail ?? '—'}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-2">
                        {r.actions.map((a) => (
                          <ActionButton key={a} row={r} action={a} />
                        ))}
                        {r.links.map((l) => (
                          <a
                            key={l.href}
                            href={l.href}
                            target={l.href.startsWith('http') ? '_blank' : undefined}
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
