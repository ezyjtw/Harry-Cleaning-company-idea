'use client';

// M3 rescue: the customer's choice panel on a CLEANER_CANCELLED booking.
// Rendered by BOTH the registered booking page and the guest tracking page —
// guests pass their token and every action carries it (the F5 pattern).
// Choice 1 (full refund) posts to the proven cancel path; choice 2 (rebook)
// re-enters matching with the held payment — no card re-entry, ever.

import { useCallback, useEffect, useMemo, useState } from 'react';

interface AvailableCleaner {
  id: string;
  name: string;
  tier: string;
  rating: number;
  reviewCount: number;
  hourlyRateRegular: number | null;
  hourlyRateDeep: number | null;
  eotPrices: Record<string, number> | null;
  airbnbPrices: Record<string, number> | null;
  openStartTimes: string[];
}

export interface RescuePanelProps {
  bookingId: string;
  guestToken?: string | null;
  serviceType: string;
  date: string; // YYYY-MM-DD (original)
  time: string; // HH:mm (original)
  duration: number;
  postcode: string;
  totalPrice: number;
  backupCleanerIds?: string[];
  rescueDeadline?: string | null;
  /** e.g. '?rescue=rebook' from the email link — opens that path expanded. */
  initialAction?: string | null;
  onResolved?: () => void;
}

type Panel = 'choice' | 'rebooking' | 'refunded' | 'rebooked';

function bandFor(time: string): 'morning' | 'afternoon' | 'evening' {
  const h = Number(time.split(':')[0] || 9);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function deadlineLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const when = d.toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return hours > 0 ? `${when} (${hours}h ${mins}m from now)` : `${when} (${mins}m from now)`;
}

export default function RescuePanel(props: RescuePanelProps) {
  const [panel, setPanel] = useState<Panel>(
    props.initialAction === 'rebook' ? 'rebooking' : 'choice'
  );
  const [busy, setBusy] = useState(false);
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string>('');

  // Rebook picker state
  const [date, setDate] = useState(props.date);
  const [band, setBand] = useState<'morning' | 'afternoon' | 'evening'>(bandFor(props.time));
  const [cleaners, setCleaners] = useState<AvailableCleaner[] | null>(null);
  const [loadingCleaners, setLoadingCleaners] = useState(false);
  const [picked, setPicked] = useState<{ cleanerId: string; name: string; time: string } | null>(
    null
  );

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/bookings/${props.bookingId}/rescue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ...(props.guestToken ? { guestToken: props.guestToken } : {}),
        }),
      });
      return { res, data: await res.json().catch(() => null) };
    },
    [props.bookingId, props.guestToken]
  );

  const chooseRefund = async () => {
    if (!confirmingRefund) {
      setConfirmingRefund(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post({ choice: 'refund' });
      if (res.ok) {
        setResultMsg(data?.message || 'Your full refund is on its way.');
        setPanel('refunded');
        props.onResolved?.();
      } else if (data?.alreadyResolved) {
        setResultMsg('This booking was already resolved — refresh to see its latest status.');
        setPanel('refunded');
        props.onResolved?.();
      } else {
        setError(data?.error || 'Could not process the refund — please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const loadCleaners = useCallback(async () => {
    setLoadingCleaners(true);
    setError(null);
    setPicked(null);
    try {
      const params = new URLSearchParams({
        date,
        band,
        duration: String(props.duration),
        service: props.serviceType,
        postcode: props.postcode,
      });
      const res = await fetch(`/api/cleaners/available?${params}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.cleaners)) {
        // Backups the customer originally chose surface first.
        const backups = new Set(props.backupCleanerIds ?? []);
        const sorted = [...(data.cleaners as AvailableCleaner[])].sort(
          (a, b) => Number(backups.has(b.id)) - Number(backups.has(a.id))
        );
        setCleaners(sorted);
      } else {
        setCleaners([]);
        setError(data?.error || 'Could not load available cleaners.');
      }
    } catch {
      setCleaners([]);
      setError('Network error — please try again.');
    } finally {
      setLoadingCleaners(false);
    }
  }, [date, band, props.duration, props.serviceType, props.postcode, props.backupCleanerIds]);

  useEffect(() => {
    if (panel === 'rebooking') loadCleaners();
  }, [panel, loadCleaners]);

  const confirmRebook = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post({
        choice: 'rebook',
        cleanerId: picked.cleanerId,
        date,
        startTime: picked.time,
      });
      if (res.ok) {
        setResultMsg(data?.message || `Request sent to ${picked.name}.`);
        setPanel('rebooked');
        props.onResolved?.();
      } else {
        setError(data?.error || 'Could not rebook — please try again.');
        if (res.status === 409) props.onResolved?.();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const deadline = useMemo(() => deadlineLabel(props.rescueDeadline), [props.rescueDeadline]);
  const isBackup = (id: string) => (props.backupCleanerIds ?? []).includes(id);

  // ── Terminal states ──
  if (panel === 'refunded' || panel === 'rebooked') {
    return (
      <div className="rounded-xl border border-trust/30 bg-trust/10 p-5">
        <h2 className="font-newsreader text-lg font-semibold text-ink">
          {panel === 'refunded' ? 'Refund confirmed' : 'Rebooking requested'}
        </h2>
        <p className="mt-1 font-jost text-sm text-ink-2">{resultMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-danger/25 bg-danger/5 p-5">
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
        Action needed
      </p>
      <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
        Your cleaner has had to cancel
      </h2>
      <p className="mt-2 font-jost text-sm text-ink-2">
        We&rsquo;re really sorry about the disruption. <strong>Your payment is safe</strong> — choose
        a full refund, or let us help you rebook and your money simply moves to the new booking.
      </p>
      {deadline && (
        <p className="mt-2 font-jost text-[13px] text-ink-3">
          No choice needed by <strong>{deadline}</strong>? We&rsquo;ll refund you in full
          automatically.
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 font-jost text-sm text-danger">
          {error}
        </div>
      )}

      {panel === 'choice' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPanel('rebooking')}
            className="rounded-[10px] bg-primary px-4 py-3 font-jost text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            Help me rebook
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={chooseRefund}
            className={`rounded-[10px] px-4 py-3 font-jost text-sm font-medium disabled:opacity-50 ${
              confirmingRefund
                ? 'bg-danger text-white'
                : 'border border-line bg-surface text-ink-2 hover:bg-page'
            }`}
          >
            {busy
              ? 'Processing…'
              : confirmingRefund
                ? 'Tap again to confirm the full refund'
                : 'Refund me in full'}
          </button>
        </div>
      )}

      {panel === 'rebooking' && (
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="font-jost text-sm text-ink-2">
              Date
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
              {(['morning', 'afternoon', 'evening'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBand(b)}
                  className={`rounded-full px-3 py-1.5 font-jost text-[13px] font-medium capitalize ${
                    band === b ? 'bg-primary text-white' : 'text-ink-2'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {loadingCleaners && (
              <>
                <div className="h-16 animate-pulse rounded-xl bg-line" />
                <div className="h-16 animate-pulse rounded-xl bg-line" />
              </>
            )}
            {!loadingCleaners && cleaners && cleaners.length === 0 && (
              <p className="rounded-lg border border-line bg-surface px-4 py-3 font-jost text-sm text-ink-2">
                No cleaners are genuinely free for that date and time — try another day or take
                the full refund.
              </p>
            )}
            {!loadingCleaners &&
              cleaners?.map((c) => (
                <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-jost text-sm font-semibold text-ink">
                        {c.name}
                        {isBackup(c.id) && (
                          <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                            Your backup choice
                          </span>
                        )}
                      </p>
                      <p className="font-jost text-[12px] text-ink-3">
                        {c.rating > 0 ? `★ ${c.rating.toFixed(1)} (${c.reviewCount})` : 'New cleaner'}
                        {c.hourlyRateRegular ? ` · from £${Number(c.hourlyRateRegular).toFixed(2)}/hr` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.openStartTimes.map((t) => {
                      const selected = picked?.cleanerId === c.id && picked.time === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPicked({ cleanerId: c.id, name: c.name, time: t })}
                          className={`rounded-full px-3 py-1 font-jost text-[12px] font-medium ${
                            selected
                              ? 'bg-primary text-white'
                              : 'border border-line bg-page text-ink-2'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          <p className="mt-3 font-jost text-[12px] text-ink-3">
            Exact pricing is confirmed when your chosen cleaner accepts: if they cost less, we
            refund the difference automatically; if more, we&rsquo;ll ask you to approve it before
            anything is charged.
            {props.guestToken
              ? " If they cost more, we'll email you a secure link to approve the difference — nothing is charged until you do."
              : ''}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={!picked || busy}
              onClick={confirmRebook}
              className="rounded-[10px] bg-primary px-5 py-2.5 font-jost text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy
                ? 'Sending…'
                : picked
                  ? `Rebook with ${picked.name} at ${picked.time}`
                  : 'Pick a cleaner and time'}
            </button>
            <button
              type="button"
              onClick={() => setPanel('choice')}
              className="font-jost text-sm text-ink-3 underline"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
