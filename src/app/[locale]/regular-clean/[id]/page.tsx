'use client';

// F23 (James-ruled): "Set up your regular clean" — the post-completion landing
// for the make-it-regular CTA. [id] is the CLEANER. Context comes from the
// completed booking (?from=bookingId for account holders, ?token= for guests):
// service and address are REUSED from the clean they just had; the customer
// chooses frequency + slot + hours + START DATE. Submitting sends a REQUEST
// (PENDING_CLEANER_ACCEPTANCE) — NOTHING is charged and nothing is booked
// until the cleaner accepts within 48 hours. On accept the first clean is
// charged to the saved card; decline/timeout → honest email, no money moved.

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { serviceLabelFromSlug } from '@/lib/constants/services';

interface EligibleSlot {
  dayOfWeek: number;
  start: string;
  end: string;
}

interface BookingContext {
  id: string;
  serviceType: string;
  duration: number;
  startTime: string;
  date: string; // YYYY-MM-DD
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressPostcode: string;
  name: string;
  email: string;
  phone: string;
  isGuest: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const QUOTE_SLUG: Record<string, string> = {
  regular: 'regular',
  deep: 'deep',
  'same-day': 'regular',
  same_day: 'regular',
};

// Mirrors the server's proposal rules: first clean at least 3 days out (the
// cleaner has 48h to accept), at most 8 weeks (the R1 cap).
const MIN_START_DAYS = 3;
const MAX_START_DAYS = 56;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** F23: the customer-chosen start date — every date on this weekday inside
 *  the [3 days, 8 weeks] window. */
function candidateStartDates(dayOfWeek: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + MIN_START_DAYS);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  const limit = new Date();
  limit.setHours(12, 0, 0, 0);
  limit.setDate(limit.getDate() + MAX_START_DAYS);
  while (d <= limit) {
    out.push(toYmd(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export default function RegularCleanSetupPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cleanerId = String(params?.id || '');
  const fromBookingId = searchParams.get('from');
  const guestToken = searchParams.get('token');

  const [cleanerName, setCleanerName] = useState<string>('your cleaner');
  const [slots, setSlots] = useState<EligibleSlot[] | null>(null);
  const [context, setContext] = useState<BookingContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [frequency, setFrequency] = useState<'WEEKLY' | 'FORTNIGHTLY'>('WEEKLY');
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [time, setTime] = useState<string>('');
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  // F20 item 3: the customer chooses hours — defaults to the trial clean's
  // duration once context loads; the server quote and fit check both key on it.
  const [hours, setHours] = useState<number | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState<number>(30);
  // F23: the customer chooses the first-clean date.
  const [startDate, setStartDate] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentRespondBy, setSentRespondBy] = useState<string | null>(null);

  // The cleaner's open slots (public read — same source the offer used).
  useEffect(() => {
    if (!cleanerId) return;
    fetch(`/api/cleaners/${cleanerId}/recurring-slots`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setSlots(data?.slots ?? []);
        if (typeof data?.bufferMinutes === 'number') setBufferMinutes(data.bufferMinutes);
      })
      .catch(() => setSlots([]));
  }, [cleanerId]);

  // Context booking — account (?from=) or guest (?token=).
  useEffect(() => {
    (async () => {
      try {
        if (guestToken) {
          const res = await fetch(`/api/bookings/guest?token=${encodeURIComponent(guestToken)}`);
          if (!res.ok) throw new Error('We could not find that booking.');
          const data = await res.json();
          const b = data.booking;
          setCleanerName(b.cleanerName || 'your cleaner');
          setContext({
            id: b.id,
            serviceType: b.serviceType,
            duration: Number(b.duration) || 2,
            startTime: b.time,
            date: b.date,
            addressLine1: b.addressLine1 || '',
            addressLine2: b.addressLine2 || '',
            addressCity: b.addressCity || '',
            addressPostcode: b.addressPostcode || '',
            name: b.guestName || 'there',
            email: b.guestEmail || '',
            phone: b.guestPhone || '',
            isGuest: true,
          });
          return;
        }
        if (fromBookingId) {
          const res = await fetch(`/api/bookings/${fromBookingId}`);
          if (res.status === 401) throw new Error('Please sign in to set up your regular clean.');
          if (!res.ok) throw new Error('We could not find that booking.');
          const b = await res.json();
          setCleanerName(b.cleaner?.name || 'your cleaner');
          setContext({
            id: b.id,
            serviceType: b.serviceType,
            duration: Number(b.duration) || 2,
            startTime: b.startTime,
            date: (b.date || '').split('T')[0],
            addressLine1: b.addressLine1 || b.address?.line1 || '',
            addressLine2: b.addressLine2 || b.address?.line2 || '',
            addressCity: b.addressCity || b.address?.city || '',
            addressPostcode: b.addressPostcode || b.address?.postcode || '',
            name: b.client?.name || 'there',
            email: '',
            phone: b.client?.phone || '',
            isGuest: false,
          });
          return;
        }
        throw new Error('This link is missing its booking context.');
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
  }, [fromBookingId, guestToken]);

  // Default slot: the one covering the clean they just had, else the first.
  useEffect(() => {
    if (!slots || slots.length === 0 || !context || slotIndex !== null) return;
    const dow = new Date(`${context.date}T00:00:00`).getDay();
    const usualIdx = slots.findIndex(
      (s) => s.dayOfWeek === dow && s.start <= context.startTime && s.end > context.startTime
    );
    const idx = usualIdx >= 0 ? usualIdx : 0;
    setSlotIndex(idx);
    setTime(usualIdx >= 0 ? context.startTime : slots[idx].start);
  }, [slots, context, slotIndex]);

  // F20 item 3: hours default to the trial clean's duration, freely changeable.
  useEffect(() => {
    if (context && hours === null) setHours(context.duration);
  }, [context, hours]);

  // Per-clean price — the server's own quote (the proposal re-computes it, so
  // this can never drift). Re-quotes on every hours change; no client
  // arithmetic anywhere.
  useEffect(() => {
    if (!context || hours === null) return;
    setQuoteTotal(null);
    fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanerId,
        serviceSlug: QUOTE_SLUG[context.serviceType] || 'regular',
        hours,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setQuoteTotal(data?.customerTotal ?? null))
      .catch(() => {});
  }, [cleanerId, context, hours]);

  const selectedSlot = slotIndex !== null && slots ? slots[slotIndex] : null;

  // F20 item 3: start times that leave room for the chosen hours PLUS the
  // cleaner's buffer inside the regulars window (mirrors the server's rule).
  const timeOptions = useMemo(() => {
    if (!selectedSlot || !context || hours === null) return [];
    const startM = timeToMinutes(selectedSlot.start);
    const endM = timeToMinutes(selectedSlot.end) - hours * 60 - bufferMinutes;
    const opts: string[] = [];
    for (let m = startM; m <= endM; m += 30) opts.push(minutesToTime(m));
    return opts;
  }, [selectedSlot, context, hours, bufferMinutes]);

  // Honest fit error — the slot's true capacity, never a clamp.
  const slotFitsMaxHours = useMemo(() => {
    if (!selectedSlot) return null;
    const cap = timeToMinutes(selectedSlot.end) - timeToMinutes(selectedSlot.start) - bufferMinutes;
    return Math.max(0, Math.floor(cap / 30) / 2);
  }, [selectedSlot, bufferMinutes]);
  const hoursDontFit =
    hours !== null && selectedSlot !== null && timeOptions.length === 0 && slots !== null;

  // F23: the start-date choices for the selected slot's weekday.
  const startDateOptions = useMemo(
    () => (selectedSlot ? candidateStartDates(selectedSlot.dayOfWeek) : []),
    [selectedSlot]
  );

  // Slot changes can invalidate the chosen date — snap to the first valid one.
  useEffect(() => {
    if (startDateOptions.length === 0) return;
    if (!startDateOptions.includes(startDate)) setStartDate(startDateOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateOptions]);

  const usualSlotIndex = useMemo(() => {
    if (!slots || !context) return -1;
    const dow = new Date(`${context.date}T00:00:00`).getDay();
    return slots.findIndex(
      (s) => s.dayOfWeek === dow && s.start <= context.startTime && s.end > context.startTime
    );
  }, [slots, context]);

  // Hours changes can invalidate the picked start time — snap to a valid one,
  // never submit a time the fit rule rejects.
  useEffect(() => {
    if (!time || timeOptions.length === 0) return;
    if (!timeOptions.includes(time)) setTime(timeOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOptions]);

  const confirm = async () => {
    if (!context || !selectedSlot || !time || !startDate || submitting || hours === null) return;
    if (hoursDontFit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/recurring/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId,
          frequency,
          startDate,
          time,
          duration: hours,
          ...(guestToken ? { guestToken } : { fromBookingId: context.id }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Something went wrong (${res.status}).`);
      }
      // Empty string = sent but respondBy missing — still show the sent state.
      setSentRespondBy(typeof data?.respondBy === 'string' ? data.respondBy : '');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sent state: the request is with the cleaner — nothing charged. ──
  if (sentRespondBy !== null) {
    const respondByLabel = sentRespondBy
      ? new Date(sentRespondBy).toLocaleString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div
          className="rounded-2xl border border-line bg-surface p-8 text-center"
          data-testid="proposal-sent"
        >
          <h1 className="font-newsreader text-3xl font-semibold text-ink">
            Request sent to {cleanerName}
          </h1>
          <p className="mt-3 font-jost text-sm font-light text-ink-2">
            {cleanerName} has 48 hours to accept your regular clean
            {respondByLabel ? ` (by ${respondByLabel})` : ''}. We&rsquo;ll email you either way.
          </p>
          <p className="mt-3 font-jost text-sm font-light text-ink-2">
            <strong>Nothing has been charged.</strong> If {cleanerName} accepts, your first clean on{' '}
            {startDate
              ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : 'the chosen date'}{' '}
            is charged to your saved card then, and future cleans are charged 48 hours before each
            visit. If they can&rsquo;t commit, no money moves.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">
            Set up a regular clean
          </h1>
          <p className="mt-2 font-jost text-sm text-ink-3">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!slots || !context) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-line" />
          <div className="h-48 rounded-2xl bg-line" />
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    // Never a dead-end CTA upstream — but the link may be old; say it plainly.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">
            No regular slots open right now
          </h1>
          <p className="mt-2 font-jost text-sm text-ink-3">
            {cleanerName} doesn&rsquo;t currently have slots open to regular clients. You can still
            book one-off cleans as usual.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 bg-page">
      <h1 className="font-newsreader text-3xl font-semibold text-ink">Set up your regular clean</h1>
      <p className="mt-2 font-jost text-sm font-light text-ink-2">
        A standing {serviceLabelFromSlug(QUOTE_SLUG[context.serviceType] || 'regular')} with{' '}
        {cleanerName} at {context.addressLine1}. Same address, same standard — no lock-in, end it
        any time.
      </p>

      {/* Frequency */}
      <div className="mt-6 p-4" style={{ border: '0.5px solid #E4E9F0' }}>
        <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">How often?</p>
        <div className="mt-3 flex gap-2">
          {(
            [
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'FORTNIGHTLY', label: 'Every two weeks' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFrequency(opt.value)}
              className={`px-4 py-2 font-jost text-sm transition ${
                frequency === opt.value ? 'bg-primary text-white' : 'bg-page text-ink-2'
              }`}
              style={{ border: '0.5px solid #E4E9F0' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slot picker */}
      <div className="mt-4 p-4" style={{ border: '0.5px solid #E4E9F0' }}>
        <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Which slot?</p>
        <div className="mt-3 space-y-2">
          {slots.map((s, i) => (
            <label
              key={`${s.dayOfWeek}-${s.start}`}
              className={`flex cursor-pointer items-center justify-between gap-3 p-3 transition ${
                slotIndex === i ? 'bg-primary-soft' : 'bg-page'
              }`}
              style={{ border: '0.5px solid #E4E9F0' }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="slot"
                  checked={slotIndex === i}
                  onChange={() => {
                    setSlotIndex(i);
                    setTime(
                      i === usualSlotIndex && context.startTime >= s.start
                        ? context.startTime
                        : s.start
                    );
                  }}
                />
                <span className="font-jost text-sm text-ink">
                  {DAY_NAMES[s.dayOfWeek]}s, {s.start}&ndash;{s.end}
                </span>
              </span>
              {i === usualSlotIndex && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-jost text-[11px] font-medium text-primary">
                  Your usual slot
                </span>
              )}
            </label>
          ))}
        </div>

        {/* F20 item 3: the customer chooses hours — the booking wizard's
            control, defaulting to the trial clean's duration. */}
        <div className="mt-4">
          <label className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            How many hours?
          </label>
          <select
            value={hours ?? context.duration}
            onChange={(e) => setHours(Number(e.target.value))}
            data-testid="regular-hours"
            className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => (
              <option key={h} value={h}>
                {h} hour{h !== 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
        {hoursDontFit && (
          <p className="mt-2 font-jost text-[13px] text-danger" data-testid="hours-fit-error">
            {cleanerName}&rsquo;s regular slot on{' '}
            {selectedSlot ? DAY_NAMES[selectedSlot.dayOfWeek] : ''}s fits up to {slotFitsMaxHours}{' '}
            hours — choose fewer hours or a different slot.
          </p>
        )}

        {selectedSlot && timeOptions.length > 0 && (
          <div className="mt-4">
            <label className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Start time
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* F23: the customer chooses the FIRST clean's date. */}
        {selectedSlot && startDateOptions.length > 0 && (
          <div className="mt-4">
            <label className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              First clean on
            </label>
            <select
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="regular-start-date"
              className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {startDateOptions.map((d) => (
                <option key={d} value={d}>
                  {new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary + send request */}
      <div className="mt-4 p-4" style={{ border: '0.5px solid #E4E9F0' }}>
        <div className="grid gap-1.5 font-jost text-sm font-light">
          <div className="flex justify-between">
            <span className="text-ink-3">First clean</span>
            <span className="font-normal text-ink">
              {startDate
                ? `${new Date(`${startDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${time}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Then</span>
            <span className="font-normal text-ink">
              {frequency === 'WEEKLY' ? 'every week' : 'every two weeks'}, same slot
            </span>
          </div>
          {quoteTotal !== null && hours !== null && (
            <div className="flex justify-between">
              <span className="text-ink-3">Per clean</span>
              <span className="font-normal text-ink" data-testid="per-clean-summary">
                &pound;{quoteTotal.toFixed(2)} &middot; {hours} hour{hours !== 1 ? 's' : ''},{' '}
                {frequency === 'WEEKLY' ? 'every week' : 'every two weeks'}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 font-jost text-[12px] font-light text-ink-3">
          Nothing is charged now. {cleanerName} has 48 hours to accept your request — if they do,
          your first clean is charged to your saved card and future cleans are charged 48 hours
          before each visit. If they can&rsquo;t commit, we&rsquo;ll tell you straight away and no
          money moves. No lock-in — either of you can end the arrangement at any time.
        </p>
        {submitError && <p className="mt-2 font-jost text-sm text-danger">{submitError}</p>}
        <button
          type="button"
          data-testid="send-request"
          disabled={submitting || !selectedSlot || !time || !startDate || hoursDontFit}
          onClick={confirm}
          className="mt-4 w-full rounded-[10px] bg-primary px-6 py-3 font-jost text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? 'Sending…' : `Send request to ${cleanerName}`}
        </button>
      </div>
    </div>
  );
}
