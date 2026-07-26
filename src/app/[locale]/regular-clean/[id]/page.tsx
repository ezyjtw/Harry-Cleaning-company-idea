'use client';

// R1-A (amended): "Set up your regular clean" — the post-completion landing
// for the make-it-regular CTA. [id] is the CLEANER. Context comes from the
// completed booking (?from=bookingId for account holders, ?token= for guests):
// service, duration and address are REUSED from the clean they just had — this
// page only collects frequency + slot, then runs the NORMAL checkout (the
// first occurrence is a plain paid booking; the agreement rides alongside it
// server-side, occurrences mint on payment success).

import { Elements } from '@stripe/react-stripe-js';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import StripeCheckoutForm from '@/components/booking/StripeCheckoutForm';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import stripePromise, { stripeAppearance, stripeFonts } from '@/lib/stripe-client';

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
  // LB-7: the trial booking's supplies answer — occurrences inherit it. Null
  // when the trial predates the question (the page then asks it).
  suppliesProvided: boolean | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const QUOTE_SLUG: Record<string, string> = {
  regular: 'regular',
  deep: 'deep',
  'same-day': 'regular',
  same_day: 'regular',
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Next date (YYYY-MM-DD, local) falling on dayOfWeek, strictly after today. */
function nextDateFor(dayOfWeek: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== dayOfWeek);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  // LB-7: fallback answer for trials that predate the supplies question —
  // when the trial HAS an answer, it is inherited and this stays unused.
  const [suppliesFallback, setSuppliesFallback] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerSessionSecret, setCustomerSessionSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [createdBooking, setCreatedBooking] = useState<{
    id: string;
    guestToken: string | null;
  } | null>(null);
  const [saveCard, setSaveCard] = useState(true);

  // The cleaner's open slots (public read — same source the offer used).
  useEffect(() => {
    if (!cleanerId) return;
    fetch(`/api/cleaners/${cleanerId}/recurring-slots`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSlots(data?.slots ?? []))
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
            suppliesProvided: typeof b.suppliesProvided === 'boolean' ? b.suppliesProvided : null,
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
            email: '', // filled server-side from the session for account holders
            phone: b.client?.phone || '',
            isGuest: false,
            suppliesProvided: typeof b.suppliesProvided === 'boolean' ? b.suppliesProvided : null,
          });
          return;
        }
        throw new Error('This link is missing its booking context.');
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
  }, [fromBookingId, guestToken]);

  // Account holders: the POST requires an email — read the session.
  useEffect(() => {
    if (guestToken) return;
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (s?.user?.email) {
          setContext((prev) =>
            prev ? { ...prev, email: s.user.email, name: s.user.name || prev.name } : prev
          );
        }
      })
      .catch(() => {});
  }, [guestToken]);

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

  // Per-clean price — the server's own quote (the checkout re-computes it, so
  // this can never drift past the API's tolerance).
  useEffect(() => {
    if (!context) return;
    fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanerId,
        serviceSlug: QUOTE_SLUG[context.serviceType] || 'regular',
        hours: context.duration,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setQuoteTotal(data?.customerTotal ?? null))
      .catch(() => {});
  }, [cleanerId, context]);

  const selectedSlot = slotIndex !== null && slots ? slots[slotIndex] : null;

  const timeOptions = useMemo(() => {
    if (!selectedSlot || !context) return [];
    const startM = timeToMinutes(selectedSlot.start);
    const endM = timeToMinutes(selectedSlot.end) - context.duration * 60;
    const opts: string[] = [];
    for (let m = startM; m <= endM; m += 30) opts.push(minutesToTime(m));
    return opts;
  }, [selectedSlot, context]);

  const firstDate = selectedSlot ? nextDateFor(selectedSlot.dayOfWeek) : null;

  const usualSlotIndex = useMemo(() => {
    if (!slots || !context) return -1;
    const dow = new Date(`${context.date}T00:00:00`).getDay();
    return slots.findIndex(
      (s) => s.dayOfWeek === dow && s.start <= context.startTime && s.end > context.startTime
    );
  }, [slots, context]);

  // LB-7: the answer that rides the agreement — inherited from the trial
  // when it has one, otherwise asked on this page (required either way).
  const effectiveSupplies = context ? (context.suppliesProvided ?? suppliesFallback) : null;

  const confirm = async () => {
    if (!context || !selectedSlot || !time || !firstDate || submitting) return;
    if (effectiveSupplies === null) {
      setSubmitError('Please tell us whether cleaning supplies will be provided.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId,
          name: context.name,
          email: context.email,
          phone: context.phone || undefined,
          addressLine1: context.addressLine1,
          addressLine2: context.addressLine2 || undefined,
          addressCity: context.addressCity,
          addressPostcode: context.addressPostcode,
          date: firstDate,
          time,
          duration: context.duration,
          serviceType: QUOTE_SLUG[context.serviceType] || 'regular',
          suppliesProvided: effectiveSupplies,
          ...(quoteTotal !== null ? { totalPrice: quoteTotal } : {}),
          isGuest: context.isGuest,
          recurring: { frequency },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Something went wrong (${res.status}).`);
      }
      setCreatedBooking(
        data.booking ? { id: data.booking.id, guestToken: data.booking.guestToken ?? null } : null
      );
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setCustomerSessionSecret(data.customerSessionClientSecret || null);
        setPaymentIntentId(data.booking?.stripePaymentIntentId || '');
      } else {
        throw new Error('Payment could not be started — please try again.');
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Payment step: the normal checkout (F7 saved-card tile for accounts) ──
  if (clientSecret) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <h1 className="font-newsreader text-3xl font-semibold text-ink text-center">
          Confirm your first regular clean
        </h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2 text-center">
          You&rsquo;re paying for the first clean now — future cleans are confirmed and paid closer
          to each date.
        </p>
        <div className="mt-6 bg-primary-soft p-5" style={{ border: '0.5px solid #E4E9F0' }}>
          <div className="grid gap-2 font-jost text-sm font-light">
            <div className="flex justify-between">
              <span className="text-ink-3">Cleaner</span>
              <span className="font-normal text-ink">{cleanerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Repeats</span>
              <span className="font-normal text-ink">
                {frequency === 'WEEKLY' ? 'Weekly' : 'Every two weeks'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">First clean</span>
              <span className="font-normal text-ink">
                {firstDate} at {time}
              </span>
            </div>
            {quoteTotal !== null && (
              <div
                className="flex justify-between pt-2 mt-2"
                style={{ borderTop: '0.5px solid #E4E9F0' }}
              >
                <span className="font-normal text-ink">Per clean</span>
                <span className="font-newsreader text-2xl font-medium text-primary">
                  &pound;{quoteTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: stripeAppearance,
            fonts: stripeFonts,
            // F7: present → PaymentElement shows the customer's saved cards.
            ...(customerSessionSecret
              ? { customerSessionClientSecret: customerSessionSecret }
              : {}),
          }}
        >
          <StripeCheckoutForm
            total={quoteTotal ?? 0}
            bookingId={createdBooking?.id || ''}
            paymentIntentId={paymentIntentId}
            saveCard={saveCard}
            onSaveCardChange={setSaveCard}
            isGuest={!!guestToken}
            guestToken={createdBooking?.guestToken ?? null}
            onBack={() => setClientSecret(null)}
          />
        </Elements>
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
      </div>

      {/* Summary + confirm */}
      <div className="mt-4 p-4" style={{ border: '0.5px solid #E4E9F0' }}>
        <div className="grid gap-1.5 font-jost text-sm font-light">
          <div className="flex justify-between">
            <span className="text-ink-3">First clean</span>
            <span className="font-normal text-ink">
              {firstDate
                ? `${new Date(`${firstDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${time}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Then</span>
            <span className="font-normal text-ink">
              {frequency === 'WEEKLY' ? 'every week' : 'every two weeks'}, same slot
            </span>
          </div>
          {quoteTotal !== null && (
            <div className="flex justify-between">
              <span className="text-ink-3">Per clean</span>
              <span className="font-normal text-ink">&pound;{quoteTotal.toFixed(2)}</span>
            </div>
          )}
          {/* LB-7: the inherited supplies answer, shown so the customer knows
              every future clean carries it ("as before"). */}
          {context.suppliesProvided !== null && (
            <div className="flex justify-between">
              <span className="text-ink-3">Supplies</span>
              <span className="font-normal text-ink">
                {context.suppliesProvided
                  ? 'you provide — as before'
                  : 'cleaner brings — as before'}
              </span>
            </div>
          )}
        </div>
        {/* LB-7: a trial from before the question existed has no answer to
            inherit — ask it here (required, no guessed default). */}
        {context.suppliesProvided === null && (
          <div className="mt-3">
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Will cleaning supplies be provided?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: true, label: 'I’ll provide supplies and equipment' },
                  { value: false, label: 'Please bring your own supplies' },
                ] as { value: boolean; label: string }[]
              ).map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setSuppliesFallback(opt.value)}
                  className={`px-4 py-2 font-jost text-sm transition ${
                    suppliesFallback === opt.value ? 'bg-primary text-white' : 'bg-page text-ink-2'
                  }`}
                  style={{ border: '0.5px solid #E4E9F0' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 font-jost text-[12px] font-light text-ink-3">
          You pay for the first clean now. Each future clean is confirmed and paid closer to the
          date. No lock-in — you or {cleanerName} can end the arrangement at any time, and anything
          not yet charged is simply cancelled.
        </p>
        {submitError && <p className="mt-2 font-jost text-sm text-danger">{submitError}</p>}
        <button
          type="button"
          disabled={submitting || !selectedSlot || !time}
          onClick={confirm}
          className="mt-4 w-full rounded-[10px] bg-primary px-6 py-3 font-jost text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? 'Setting up…' : 'Continue to payment'}
        </button>
      </div>
    </div>
  );
}
