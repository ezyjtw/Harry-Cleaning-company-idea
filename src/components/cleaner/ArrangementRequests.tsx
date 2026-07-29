'use client';

// F27 (James-ruled): regular arrangement request cards live on the JOBS page —
// the canonical respond surface, web and app shell alike. The availability
// page's Repeat tab keeps "Your regular clients" but points requests here.
// (The old placement lost both doors: the request email linked the availability
// page without ?tab=repeat, and the dashboard notice's client-side navigation
// mounted the page before the URL committed, so the tab param read stale.)

import { useCallback, useEffect, useState } from 'react';

import { recurringFrequencyLabel } from '@/components/cleaner/RegularCleanChip';

interface RequestRow {
  id: string;
  status: string;
  frequency: 'WEEKLY' | 'FORTNIGHTLY';
  dayOfWeek: number;
  startTime: string;
  duration: number;
  otherPartyName: string;
  amount: number;
  proposedStartDate: string | null;
  respondBy: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function respondByLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ArrangementRequests({
  variant = 'portal',
  className,
  onResolved,
}: {
  /** 'portal' = web jobs list; 'app' = the L2 shell's jobs surface. */
  variant?: 'portal' | 'app';
  className?: string;
  /** Fired after an accept/decline lands, so the host list can refetch
   *  (accept mints occurrences that belong in it). */
  onResolved?: () => void;
}) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [confirmingDeclineId, setConfirmingDeclineId] = useState<string | null>(null);
  const [acceptedMsg, setAcceptedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agreements');
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const rows: RequestRow[] = Array.isArray(data?.asCleaner) ? data.asCleaner : [];
      setRequests(rows.filter((a) => a.status === 'PENDING_CLEANER_ACCEPTANCE'));
    } catch {
      /* best-effort — the nav badge still points here */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const respond = async (row: RequestRow, action: 'ACCEPT' | 'DECLINE') => {
    setRespondingId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/cleaner/arrangements/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not respond — please try again.');
      if (action === 'ACCEPT') {
        setAcceptedMsg(
          `Accepted — ${row.otherPartyName}'s regular clean is set up and the cleans are on your schedule.`
        );
      }
      await refresh();
      onResolved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not respond — please try again.');
      // The world may have moved (withdrawn/expired) — show the truth.
      await refresh();
    } finally {
      setRespondingId(null);
      setConfirmingDeclineId(null);
    }
  };

  if (requests.length === 0 && !acceptedMsg && !error) return null;

  const shellClass =
    variant === 'app'
      ? 'rounded-2xl border border-primary/25 bg-primary-soft p-4'
      : 'rounded-xl border border-primary/25 bg-primary-soft p-5';

  return (
    <section data-testid="arrangement-requests" className={className}>
      {acceptedMsg && (
        <p className="mb-3 font-jost text-sm text-trust" data-testid="arrangement-accepted-note">
          {acceptedMsg}
        </p>
      )}
      {error && <p className="mb-3 font-jost text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {requests.map((a) => (
          <div key={a.id} className={shellClass} data-testid="arrangement-request">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
              Regular arrangement request
            </p>
            <p className="mt-1 font-jost text-sm text-ink">
              Regular arrangement request from {a.otherPartyName}
            </p>
            <p className="mt-0.5 font-jost text-sm font-light text-ink-2">
              Every {DAY_NAMES[a.dayOfWeek]} at {a.startTime} &middot;{' '}
              {recurringFrequencyLabel(a.frequency)} &middot; {a.duration}h
              {a.proposedStartDate && <> &middot; from {shortDate(a.proposedStartDate)}</>}
            </p>
            <p className="mt-1 font-jost text-sm text-ink">
              You&rsquo;d earn <span className="font-medium">£{a.amount.toFixed(2)}</span> per clean
            </p>
            {a.respondBy && (
              <p className="mt-0.5 font-jost text-[12px] text-ink-3">
                Respond by {respondByLabel(a.respondBy)} — after that the request expires and the
                customer is told.
              </p>
            )}
            {confirmingDeclineId === a.id ? (
              <div
                className="mt-3 rounded-[10px] border border-line bg-surface p-4"
                data-testid="arrangement-decline-confirm"
              >
                <p className="font-jost text-sm text-ink">
                  Decline {a.otherPartyName}&rsquo;s request? They&rsquo;ll be told straight away —
                  nothing has been charged.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    data-testid="arrangement-decline-yes"
                    disabled={respondingId === a.id}
                    onClick={() => respond(a, 'DECLINE')}
                    className="rounded-[10px] bg-danger px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {respondingId === a.id ? 'Declining…' : 'Yes, decline it'}
                  </button>
                  <button
                    type="button"
                    disabled={respondingId === a.id}
                    onClick={() => setConfirmingDeclineId(null)}
                    className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[12px] text-ink transition hover:bg-page"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  data-testid="arrangement-accept"
                  disabled={respondingId === a.id}
                  onClick={() => respond(a, 'ACCEPT')}
                  className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                >
                  {respondingId === a.id ? 'Working…' : 'Accept'}
                </button>
                <button
                  type="button"
                  data-testid="arrangement-decline"
                  disabled={respondingId === a.id}
                  onClick={() => setConfirmingDeclineId(a.id)}
                  className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[12px] text-ink transition hover:bg-page"
                >
                  Decline
                </button>
              </div>
            )}
            <p className="mt-2 font-jost text-[12px] font-light text-ink-3">
              Nothing is charged to {a.otherPartyName} unless you accept.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
