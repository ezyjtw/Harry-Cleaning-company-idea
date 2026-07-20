'use client';

import { useCallback, useEffect, useState } from 'react';

// Stuck-money reaper: the admin "Needs attention" queue. Detection and nudges
// are automatic; EVERY money movement is a button on this page, armed only
// 5 days after the scheduled end, double-confirmed, and service-guarded.

interface OpenCase {
  id: string;
  bookingId: string;
  bookingRef: string;
  serviceType: string;
  date: string;
  startTime: string;
  status: string;
  totalPrice: number;
  cleanerEarnings: number;
  customerName: string;
  isGuest: boolean;
  cleanerName: string;
  scheduledEndAt: string;
  daysStuck: number;
  nudge1At: string | null;
  nudge2At: string | null;
  customerAskedAt: string | null;
  customerAnswer: 'YES' | 'NO' | null;
  actionsArmed: boolean;
}

interface ResolvedCase {
  id: string;
  bookingRef: string;
  serviceType: string;
  date: string;
  resolution: string | null;
  resolvedAt: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminStuckJobsPage() {
  const [open, setOpen] = useState<OpenCase[]>([]);
  const [resolved, setResolved] = useState<ResolvedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stuck-jobs');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const d = await res.json();
        setOpen(d.open || []);
        setResolved(d.resolved || []);
      }
    } catch {
      setStatusMessage('Failed to load the queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const act = async (id: string, action: 'ask' | 'force-complete' | 'cancel-refund') => {
    setBusyId(id);
    setStatusMessage('');
    setConfirming(null);
    try {
      const res = await fetch(`/api/admin/stuck-jobs/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(
          action === 'ask'
            ? 'Question sent to the customer.'
            : action === 'force-complete'
              ? `Marked complete — payment releases ${d?.released === 'immediate' ? 'now (customer confirmed)' : 'after a 24h dispute window'}.`
              : `Cancelled and refunded £${(d?.refunded ?? 0).toFixed ? d.refunded.toFixed(2) : d?.refunded}.`
        );
        await fetchQueue();
      } else {
        setStatusMessage(`Error: ${d?.error || 'Action failed.'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setBusyId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 lg:p-10">
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-5 py-4">
          <p className="text-sm font-medium text-danger">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Needs attention — stuck jobs</h1>
        <p className="mt-1 text-sm text-ink-2">
          Paid jobs past their scheduled end that were never marked complete. Nudges are automatic;
          money only moves when you press a button here. Buttons arm 5 days after the scheduled end.
        </p>
      </header>

      {statusMessage && (
        <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{statusMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-line" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <p className="text-sm text-ink-3">No stuck jobs — nothing needs attention.</p>
      ) : (
        <div className="space-y-4">
          {open.map((c) => (
            <div key={c.id} className="rounded-lg border border-amber-200 bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">
                  {c.serviceType} · {fmtDate(c.date)} at {c.startTime}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {c.daysStuck} day{c.daysStuck === 1 ? '' : 's'} stuck · {c.status}
                </span>
                {c.customerAnswer === 'YES' && (
                  <span className="rounded-full bg-trust/10 px-2 py-0.5 text-xs font-medium text-trust">
                    Customer: it happened
                  </span>
                )}
                {c.customerAnswer === 'NO' && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                    Customer: it did NOT happen
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-3">Ref: {c.bookingRef}</span>
              </div>
              <p className="mt-2 text-sm text-ink-2">
                {c.customerName}
                {c.isGuest ? ' (guest)' : ''} ← {c.cleanerName} · charged £{c.totalPrice.toFixed(2)}{' '}
                · cleaner would earn £{c.cleanerEarnings.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                Nudges: {c.nudge1At ? `#1 ${fmtDate(c.nudge1At)}` : 'none yet'}
                {c.nudge2At ? ` · #2 ${fmtDate(c.nudge2At)}` : ''}
                {c.customerAskedAt ? ` · customer asked ${fmtDate(c.customerAskedAt)}` : ''}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!c.customerAnswer && (
                  <button
                    onClick={() => act(c.id, 'ask')}
                    disabled={busyId === c.id}
                    className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink-2 hover:bg-page disabled:opacity-50"
                  >
                    {c.customerAskedAt ? 'Ask the customer again' : 'Ask the customer'}
                  </button>
                )}
                {confirming?.id === c.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {confirming.action === 'force-complete'
                        ? `Mark complete and release £${c.cleanerEarnings.toFixed(2)} to ${c.cleanerName}?`
                        : `Cancel and refund £${c.totalPrice.toFixed(2)} to ${c.customerName}?`}
                    </span>
                    <button
                      onClick={() =>
                        act(c.id, confirming.action as 'force-complete' | 'cancel-refund')
                      }
                      disabled={busyId === c.id}
                      className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Working…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-sm text-ink-3 hover:text-ink-2"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirming({ id: c.id, action: 'force-complete' })}
                      disabled={!c.actionsArmed || busyId === c.id || c.customerAnswer === 'NO'}
                      title={
                        !c.actionsArmed
                          ? 'Arms 5 days after the scheduled end'
                          : c.customerAnswer === 'NO'
                            ? 'Blocked — the customer says it did not happen'
                            : undefined
                      }
                      className="rounded-lg bg-trust px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Force-complete (pays cleaner)
                    </button>
                    <button
                      onClick={() => setConfirming({ id: c.id, action: 'cancel-refund' })}
                      disabled={!c.actionsArmed || busyId === c.id}
                      title={!c.actionsArmed ? 'Arms 5 days after the scheduled end' : undefined}
                      className="rounded-lg border border-danger/30 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-40"
                    >
                      Cancel &amp; refund customer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-ink">Recently resolved</h2>
          <div className="space-y-2">
            {resolved.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5"
              >
                <span className="text-sm text-ink-2">
                  {c.serviceType} · {fmtDate(c.date)} · Ref {c.bookingRef}
                </span>
                <span className="ml-auto rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink-3">
                  {c.resolution?.replace(/-/g, ' ')}
                  {c.resolvedAt ? ` · ${fmtDate(c.resolvedAt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
