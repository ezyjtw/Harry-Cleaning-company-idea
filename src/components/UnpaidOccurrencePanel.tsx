'use client';

// R1-C: the NO-CHARGE variant of the rescue choice — an UNPAID occurrence the
// cleaner can't make. Choices: reschedule with the same cleaner (stays
// SCHEDULED, charges at its new T-48h) or skip (nothing charged). Cover is
// deliberately absent pre-charge (H53: unpaid work never enters offer flows) —
// the paid rescue keeps the full three-way. Rendered INSTEAD of RescuePanel by
// the booking surfaces; the rescue machinery itself is untouched.

import { useState } from 'react';

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 20; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 20) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function UnpaidOccurrencePanel(props: {
  bookingId: string;
  guestToken?: string | null;
  cleanerName?: string | null;
  date: string; // YYYY-MM-DD (original)
  time: string; // HH:mm (original)
  onResolved?: () => void;
}) {
  const [date, setDate] = useState(tomorrowISO());
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState<'reschedule' | 'skip' | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cleanerFirst = (props.cleanerName || 'your cleaner').trim().split(/\s+/)[0];

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...(props.guestToken ? { token: props.guestToken } : {}) }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  };

  if (done) {
    return (
      <div className="rounded-xl border border-trust/30 bg-trust/10 p-5">
        <h2 className="font-newsreader text-lg font-semibold text-ink">All sorted</h2>
        <p className="mt-1 font-jost text-sm text-ink-2">{done}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-danger/25 bg-danger/5 p-5"
      data-testid="unpaid-occurrence-panel"
    >
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
        Action needed
      </p>
      <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
        {cleanerFirst} can&rsquo;t make this clean
      </h2>
      <p className="mt-2 font-jost text-sm text-ink-2">
        <strong>Nothing has been charged</strong> for this visit, and your regular arrangement is
        unaffected. Pick a new date with {cleanerFirst}, or skip this one.
      </p>
      <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
        If you don&rsquo;t choose in time, this one visit is simply skipped — nothing is charged.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 font-jost text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {/* Reschedule — same cleaner, new date. */}
        <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
          <p className="font-jost text-sm font-semibold text-ink">
            Pick a new date with {cleanerFirst}
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="font-jost text-sm text-ink-2">
              Date
              <input
                type="date"
                value={date}
                min={tomorrowISO()}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06]"
              />
            </label>
            <label className="font-jost text-sm text-ink-2">
              Time
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06]"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('reschedule');
                setError(null);
                try {
                  const { res, data } = await post(
                    `/api/bookings/${props.bookingId}/reschedule-occurrence`,
                    { date, time }
                  );
                  if (res.ok) {
                    setDone(data?.message || 'Rescheduled.');
                    props.onResolved?.();
                  } else {
                    setError(data?.error || 'Could not reschedule — try another slot.');
                  }
                } catch {
                  setError('Network error — please try again.');
                } finally {
                  setBusy(null);
                }
              }}
              className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy === 'reschedule' ? 'Checking…' : 'Reschedule'}
            </button>
          </div>
          <p className="mt-1.5 font-jost text-[12px] font-light text-ink-3">
            The new slot is checked against {cleanerFirst}&rsquo;s real availability. Payment is
            taken closer to the new date, as normal.
          </p>
        </div>

        {/* Skip — nothing charged. */}
        {!confirmingSkip ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirmingSkip(true)}
            className="block w-full rounded-[10px] border border-line bg-surface px-4 py-3 text-left hover:bg-page disabled:opacity-50"
          >
            <span className="block font-jost text-sm font-semibold text-ink">Skip this clean</span>
            <span className="mt-0.5 block font-jost text-[12px] text-ink-3">
              Nothing is charged. Your next regular clean goes ahead as normal.
            </span>
          </button>
        ) : (
          <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
            <p className="font-jost text-sm text-ink">
              Skip this clean? Nothing has been charged, and your regular arrangement carries on.
            </p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy('skip');
                  setError(null);
                  try {
                    const { res, data } = await post(`/api/bookings/${props.bookingId}/skip`, {});
                    if (res.ok) {
                      setDone(data?.message || 'Skipped — nothing was charged.');
                      props.onResolved?.();
                    } else {
                      setError(data?.error || 'Could not skip — please try again.');
                    }
                  } catch {
                    setError('Network error — please try again.');
                  } finally {
                    setBusy(null);
                    setConfirmingSkip(false);
                  }
                }}
                className="rounded-[10px] bg-danger px-4 py-2 font-jost text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === 'skip' ? 'Skipping…' : 'Yes, skip it'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setConfirmingSkip(false)}
                className="font-jost text-[13px] text-ink-2 underline disabled:opacity-50"
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 font-jost text-[12px] font-light text-ink-3">
        Cover cleaners become available once a clean is confirmed and paid — for this one, pick a
        new date or skip.
      </p>
    </div>
  );
}
