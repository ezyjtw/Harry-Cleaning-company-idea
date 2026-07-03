'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import type { StuckRefund, StuckTopup } from './page';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    REVERSAL_ONLY: 'bg-danger/10 text-danger',
    UNKNOWN: 'bg-warning/10 text-warning',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-page text-ink-2'}`}
    >
      {status}
    </span>
  );
}

function RetryButton({ refundRecordId, amount }: { refundRecordId: string; amount: number }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleRetry = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const res = await fetch('/api/admin/bookings/retry-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundRecordId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: `${data.status ?? 'Failed'}: ${data.error}` });
      } else {
        setResult({
          ok: true,
          message: `Refund of £${(data.amountRefunded ?? amount).toFixed(2)} succeeded`,
        });
      }
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setState('idle');
    }
  }, [refundRecordId, amount]);

  return (
    <div className="inline-flex items-center gap-2">
      {state === 'confirming' ? (
        <>
          <span className="text-xs text-ink-3">Retry £{amount.toFixed(2)} refund?</span>
          <button
            onClick={handleRetry}
            className="px-2 py-1 text-xs font-medium text-white rounded bg-danger hover:bg-danger"
          >
            Yes, retry
          </button>
          <button
            onClick={() => {
              setState('idle');
              setResult(null);
            }}
            className="px-2 py-1 text-xs font-medium text-ink-2 rounded border border-line hover:bg-page"
          >
            No
          </button>
        </>
      ) : state === 'loading' ? (
        <span className="text-xs text-ink-3">Processing…</span>
      ) : (
        <button
          onClick={() => setState('confirming')}
          className="px-2 py-1 text-xs font-medium text-danger rounded border border-danger/20 hover:bg-danger/10"
        >
          Retry refund
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

export default function StuckMoneyClient({
  refunds,
  topups,
}: {
  refunds: StuckRefund[];
  topups: StuckTopup[];
}) {
  const total = refunds.length + topups.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/bookings" className="text-sm text-primary hover:underline">
          &larr; All bookings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-1">Stuck Money</h1>
        <p className="text-ink-3 mt-1">
          {total === 0
            ? 'No stuck records — all clear.'
            : `${total} record${total !== 1 ? 's' : ''} requiring investigation`}
        </p>
      </div>

      {refunds.length > 0 && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
          <div className="px-6 py-3 bg-danger/10 border-b border-line">
            <h2 className="text-sm font-semibold text-danger uppercase tracking-wider">
              Stuck Refunds ({refunds.length})
            </h2>
            <p className="text-xs text-danger mt-0.5">
              REVERSAL_ONLY = cleaner&apos;s share clawed back but customer refund failed. UNKNOWN =
              outcome uncertain.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-ink-3 uppercase border-b border-line">
                  <th className="px-6 py-2">Booking</th>
                  <th className="px-6 py-2">Amount</th>
                  <th className="px-6 py-2">Status</th>
                  <th className="px-6 py-2">Reason</th>
                  <th className="px-6 py-2">Stripe Refund ID</th>
                  <th className="px-6 py-2">Failure</th>
                  <th className="px-6 py-2">Date</th>
                  <th className="px-6 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-page">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/bookings/${r.bookingId}`}
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {r.bookingId.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-medium">£{r.amount.toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-3 text-ink-2 max-w-xs truncate">{r.reason}</td>
                    <td className="px-6 py-3 text-xs text-ink-3 font-mono">
                      {r.stripeRefundId || '—'}
                    </td>
                    <td className="px-6 py-3 text-danger text-xs">{r.failureReason || '—'}</td>
                    <td className="px-6 py-3 text-ink-2 text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="px-6 py-3">
                      {r.status === 'REVERSAL_ONLY' && (
                        <RetryButton refundRecordId={r.id} amount={r.amount} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topups.length > 0 && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="px-6 py-3 bg-warning/10 border-b border-line">
            <h2 className="text-sm font-semibold text-warning uppercase tracking-wider">
              Stuck Topups ({topups.length})
            </h2>
            <p className="text-xs text-warning mt-0.5">
              UNKNOWN = topup payment outcome uncertain. Check Stripe dashboard for the PI status.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-ink-3 uppercase border-b border-line">
                  <th className="px-6 py-2">Booking</th>
                  <th className="px-6 py-2">Amount</th>
                  <th className="px-6 py-2">Status</th>
                  <th className="px-6 py-2">Reason</th>
                  <th className="px-6 py-2">Stripe PI</th>
                  <th className="px-6 py-2">Failure</th>
                  <th className="px-6 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topups.map((t) => (
                  <tr key={t.id} className="hover:bg-page">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/bookings/${t.bookingId}`}
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {t.bookingId.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-medium">£{t.amount.toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-3 text-ink-2 max-w-xs truncate">{t.reason}</td>
                    <td className="px-6 py-3 text-xs text-ink-3 font-mono">
                      {t.stripePaymentIntentId || '—'}
                    </td>
                    <td className="px-6 py-3 text-danger text-xs">{t.failureReason || '—'}</td>
                    <td className="px-6 py-3 text-ink-2 text-xs">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
