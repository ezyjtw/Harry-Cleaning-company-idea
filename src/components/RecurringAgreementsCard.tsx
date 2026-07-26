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

  useEffect(() => {
    fetch('/api/agreements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const rows: AgreementRow[] = role === 'CLEANER' ? data.asCleaner : data.asCustomer;
        setAgreements((rows || []).filter((a) => a.status === 'ACTIVE'));
      })
      .catch(() => {});
  }, [role]);

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
                  {confirmingId !== a.id && (
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
              {confirmingId === a.id && (
                <div className="mt-3 rounded-[10px] border border-danger/25 bg-danger/5 p-4">
                  <p className="font-jost text-sm text-ink">
                    End this regular clean? All upcoming scheduled cleans are cancelled and nothing
                    further is charged.{' '}
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
            </div>
          ))}
          {error && <p className="px-6 pb-4 font-jost text-sm text-danger">{error}</p>}
        </div>
      </div>
    </section>
  );
}
