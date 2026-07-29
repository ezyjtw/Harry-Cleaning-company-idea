'use client';

// R1-A: the standing-agreement surface, shared by both seats. Customers see it
// on the account home ("Your regular cleans"), cleaners on the availability
// page ("Your regular clients"). Either side ends the agreement from here —
// no lock-in (James-ruled) — behind an inline confirm that states exactly
// what happens: future scheduled cleans cancel, nothing further is charged.

import { useEffect, useState } from 'react';

import { serviceLabelFromSlug } from '@/lib/constants/services';

interface AgreementRow {
  id: string;
  role: 'CLEANER' | 'CUSTOMER';
  status: string;
  frequency: 'WEEKLY' | 'FORTNIGHTLY';
  dayOfWeek: number;
  startTime: string;
  duration: number;
  serviceType: string;
  otherPartyName: string;
  amount: number;
  nextOccurrence: string | null;
  // R1-C: skip target — the next occurrence and its money state.
  nextOccurrenceId: string | null;
  nextOccurrenceTime: string | null;
  nextOccurrencePaid: boolean;
  // F23: proposal fields — the request card / waiting row render from these.
  proposedStartDate: string | null;
  respondBy: string | null;
}

// F23: statuses this surface shows. PENDING renders as the cleaner's request
// card (accept/decline — the soft-hold's visible face) or the customer's
// waiting row; DECLINED/EXPIRED/ENDED rows never render here.
const VISIBLE_STATUSES = new Set(['ACTIVE', 'PENDING_CLEANER_ACCEPTANCE']);

// R1-C skip policy copy (James-ruled): unpaid free at any distance; paid free
// before 24h; inside 24h the charge stands.
function skipCopy(a: AgreementRow): string {
  if (!a.nextOccurrencePaid) {
    return 'Skip this clean? Nothing has been charged for it — skipping is free, and your regular arrangement carries on as normal.';
  }
  const start = new Date(`${a.nextOccurrence}T${a.nextOccurrenceTime || '00:00'}:00`);
  const inside24h = start.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
  return inside24h
    ? "Skip this clean? Inside 24 hours the charge stands — your cleaner committed this time. You can still skip, but this clean won't be refunded."
    : "Skip this clean? You'll be refunded in full, and your regular arrangement carries on as normal.";
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatNext(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function RecurringAgreementsCard({
  role,
  className,
}: {
  role: 'CLEANER' | 'CUSTOMER';
  className?: string;
}) {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // R1-C: customer skip of the next occurrence (customer seat only).
  const [confirmingSkipId, setConfirmingSkipId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [skipMsg, setSkipMsg] = useState<string | null>(null);

  // LR-1: customer withdraws their own pending request.
  const [confirmingWithdrawId, setConfirmingWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const refresh = async () => {
    const data = await fetch('/api/agreements').then((r) => (r.ok ? r.json() : null));
    if (!data) return;
    const rows: AgreementRow[] = role === 'CLEANER' ? data.asCleaner : data.asCustomer;
    setAgreements((rows || []).filter((a) => VISIBLE_STATUSES.has(a.status)));
  };

  useEffect(() => {
    fetch('/api/agreements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const rows: AgreementRow[] = role === 'CLEANER' ? data.asCleaner : data.asCustomer;
        setAgreements((rows || []).filter((a) => VISIBLE_STATUSES.has(a.status)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const withdraw = async (id: string) => {
    setWithdrawingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${id}/withdraw`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not withdraw — please try again.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw — please try again.');
      // The world may have moved (e.g. the cleaner accepted) — show the truth.
      await refresh();
    } finally {
      setWithdrawingId(null);
      setConfirmingWithdrawId(null);
    }
  };

  const endAgreement = async (id: string) => {
    setEndingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${id}/end`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not end the agreement — please try again.');
      }
      setAgreements((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not end the agreement — please try again.');
    } finally {
      setEndingId(null);
      setConfirmingId(null);
    }
  };

  if (agreements.length === 0) return null;

  return (
    <section data-testid="recurring-agreements" className={className}>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-newsreader text-lg font-semibold text-ink">
            {role === 'CLEANER' ? 'Your regular clients' : 'Your regular cleans'}
          </h2>
          <p className="mt-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            No lock-in &middot; either side can end any time
          </p>
        </div>
        <div>
          {agreements.map((a, i) => (
            <div key={a.id} className={`px-6 py-4 ${i > 0 ? 'border-t border-line' : ''}`}>
              {a.status === 'PENDING_CLEANER_ACCEPTANCE' ? (
                // F23: the pending request — cleaner seat gets the accept/
                // decline card; customer seat the honest waiting row. This is
                // the soft-hold: visible as pending, blocking nothing.
                role === 'CLEANER' ? (
                  // F27 (James-ruled): the respond surface moved to the Jobs
                  // page (canonical). This seat keeps an honest pointer so a
                  // cleaner who lands here still finds the request.
                  <div data-testid="arrangement-request-pointer">
                    <p className="font-jost text-sm text-ink">
                      Regular arrangement request from {a.otherPartyName} waiting
                    </p>
                    <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                      {a.frequency === 'WEEKLY' ? 'Every week' : 'Every two weeks'} &middot;{' '}
                      {DAY_NAMES[a.dayOfWeek]}s at {a.startTime} &middot; {a.duration}h
                      {a.proposedStartDate && <> &middot; from {formatNext(a.proposedStartDate)}</>}
                    </p>
                    <a
                      href="/cleaner/jobs"
                      className="mt-2 inline-block rounded-[10px] bg-primary px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:bg-primary-hover"
                    >
                      Respond from My Jobs
                    </a>
                  </div>
                ) : (
                  <div data-testid="arrangement-waiting">
                    <p className="font-jost text-sm text-ink">
                      Waiting for {a.otherPartyName} to accept
                    </p>
                    <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                      {a.frequency === 'WEEKLY' ? 'Every week' : 'Every two weeks'} &middot;{' '}
                      {DAY_NAMES[a.dayOfWeek]}s at {a.startTime}
                      {a.proposedStartDate && <> &middot; from {formatNext(a.proposedStartDate)}</>}
                    </p>
                    <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                      Nothing is charged unless they accept — we&rsquo;ll email you either way
                      within 48 hours.
                    </p>
                    {/* LR-1: the customer's own exit while the request is open. */}
                    {confirmingWithdrawId !== a.id ? (
                      <button
                        type="button"
                        data-testid="arrangement-withdraw"
                        onClick={() => setConfirmingWithdrawId(a.id)}
                        className="mt-2 font-jost text-[12px] text-ink-3 underline transition hover:text-danger"
                      >
                        Withdraw request
                      </button>
                    ) : (
                      <div className="mt-3 rounded-[10px] border border-line bg-page p-4">
                        <p className="font-jost text-sm text-ink">
                          Withdraw your request to {a.otherPartyName}? Nothing has been charged.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            data-testid="arrangement-withdraw-confirm"
                            disabled={withdrawingId === a.id}
                            onClick={() => withdraw(a.id)}
                            className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                          >
                            {withdrawingId === a.id ? 'Withdrawing…' : 'Yes, withdraw it'}
                          </button>
                          <button
                            type="button"
                            disabled={withdrawingId === a.id}
                            onClick={() => setConfirmingWithdrawId(null)}
                            className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[12px] text-ink transition hover:bg-page"
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-jost text-sm text-ink">
                        {serviceLabelFromSlug(a.serviceType)} with {a.otherPartyName}
                      </p>
                      <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                        {a.frequency === 'WEEKLY' ? 'Weekly' : 'Every two weeks'} &middot;{' '}
                        {DAY_NAMES[a.dayOfWeek]}s at {a.startTime}
                        {formatNext(a.nextOccurrence) && (
                          <> &middot; next clean {formatNext(a.nextOccurrence)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-newsreader text-lg font-medium text-ink">
                        £{a.amount.toFixed(2)}
                      </p>
                      {role === 'CUSTOMER' &&
                        a.nextOccurrenceId &&
                        confirmingSkipId !== a.id &&
                        confirmingId !== a.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmingSkipId(a.id)}
                            className="font-jost text-[12px] text-ink-3 underline transition hover:text-ink"
                          >
                            Skip next clean
                          </button>
                        )}
                      {confirmingId !== a.id && confirmingSkipId !== a.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(a.id)}
                          className="font-jost text-[12px] text-ink-3 underline transition hover:text-danger"
                        >
                          {role === 'CLEANER' ? 'End arrangement' : 'End regular clean'}
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmingSkipId === a.id && (
                    <div className="mt-3 rounded-[10px] border border-line bg-page p-4">
                      <p className="font-jost text-sm text-ink">{skipCopy(a)}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={skippingId === a.id}
                          onClick={async () => {
                            setSkippingId(a.id);
                            setError(null);
                            try {
                              const res = await fetch(`/api/bookings/${a.nextOccurrenceId}/skip`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: '{}',
                              });
                              const data = await res.json().catch(() => null);
                              if (!res.ok) throw new Error(data?.error || 'Could not skip.');
                              setSkipMsg(data?.message ?? 'Skipped.');
                              // refresh next-occurrence info
                              const ref = await fetch('/api/agreements').then((r) =>
                                r.ok ? r.json() : null
                              );
                              if (ref) {
                                const rows: AgreementRow[] =
                                  role === 'CLEANER' ? ref.asCleaner : ref.asCustomer;
                                setAgreements(
                                  (rows || []).filter((x) => VISIBLE_STATUSES.has(x.status))
                                );
                              }
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Could not skip.');
                            } finally {
                              setSkippingId(null);
                              setConfirmingSkipId(null);
                            }
                          }}
                          className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                        >
                          {skippingId === a.id ? 'Skipping…' : 'Yes, skip it'}
                        </button>
                        <button
                          type="button"
                          disabled={skippingId === a.id}
                          onClick={() => setConfirmingSkipId(null)}
                          className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[12px] text-ink transition hover:bg-page"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                  {confirmingId === a.id && (
                    <div className="mt-3 rounded-[10px] border border-danger/25 bg-danger/5 p-4">
                      <p className="font-jost text-sm text-ink">
                        End this regular clean? All upcoming scheduled cleans are cancelled and
                        nothing further is charged.{' '}
                        {role === 'CLEANER'
                          ? 'Your client will be told, and these slots reopen for other bookings.'
                          : 'Your cleaner will be told. Any clean that already happened is unaffected.'}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={endingId === a.id}
                          onClick={() => endAgreement(a.id)}
                          className="rounded-[10px] bg-danger px-4 py-2 font-jost text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {endingId === a.id ? 'Ending…' : 'Yes, end it'}
                        </button>
                        <button
                          type="button"
                          disabled={endingId === a.id}
                          onClick={() => setConfirmingId(null)}
                          className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[12px] text-ink transition hover:bg-page"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {skipMsg && <p className="px-6 pb-2 font-jost text-sm text-trust">{skipMsg}</p>}
          {error && <p className="px-6 pb-4 font-jost text-sm text-danger">{error}</p>}
        </div>
      </div>
    </section>
  );
}
