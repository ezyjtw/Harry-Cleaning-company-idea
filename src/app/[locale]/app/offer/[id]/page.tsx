'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { suppliesLabel } from '@/lib/booking/supplies';
import { bedroomsLabel } from '@/lib/constants/services';

interface Offer {
  assigned?: boolean;
  keyAccess?: string;
  keyAccessNote?: string;
  suppliesProvided?: boolean | null;
  fullAddress?: string;
  id: string;
  status: string;
  cascadePhase: string | null;
  cascadeExpiresAt: string | null;
  clientName: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  cleanerEarnings: number;
  notes: string | null;
  bedrooms?: number;
  // B3: offer context — travelMinutes from the cleaner's home point (crow-flies
  // 25 mph convention) + their other active jobs on that date.
  context?: { travelMinutes: number | null; sameDayJobs: number };
}

// H104: shared guidance vocabulary for the assigned view.
const KEY_ACCESS_LABELS: Record<string, string> = {
  'i-will-be-home': 'The customer will be home to let you in',
  'key-under-mat': 'Key left out (under mat)',
  lockbox: 'Lockbox on site',
  'with-concierge': 'Key with concierge/reception',
  other: 'Other arrangement — see note',
};
function splitFocus(notes: string | null | undefined): {
  focus: string | null;
  rest: string | null;
} {
  if (!notes) return { focus: null, rest: null };
  const lines = notes.split('\n');
  const i = lines.findIndex((l) => l.trim().startsWith('Focus:'));
  if (i === -1) return { focus: null, rest: notes.trim() || null };
  return {
    focus: lines[i].trim().replace(/^Focus:\s*/, '') || null,
    rest: [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim() || null,
  };
}

type Tier = 'normal' | 'amber' | 'danger' | 'expired';

// Native-shell haptic bridge. No-op in a normal browser — changes nothing on web.
function haptic(style: 'light' | 'medium' | 'success' | 'error') {
  (
    window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }
  ).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'haptic', style }));
}

function serviceLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Staged urgency: normal → amber under 10 min → danger under 3 min → expired.
function windowState(expiresAt: string | null, now: number): { text: string; tier: Tier } {
  if (!expiresAt) return { text: '', tier: 'normal' };
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { text: 'Offer expired', tier: 'expired' };
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const clock =
    mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m left to respond`
      : `${mins}m ${String(secs).padStart(2, '0')}s left to respond`;
  if (diff < 3 * 60000) return { text: clock, tier: 'danger' };
  if (diff < 10 * 60000) return { text: clock, tier: 'amber' };
  return { text: clock, tier: 'normal' };
}

// C4: the pill timer is dead — the window now drains as a thin ring around the
// pay figure. Navy while there's time, amber under 10 minutes, red under 3
// (same thresholds as before, via windowState).
const RING_TIER: Record<Exclude<Tier, 'expired'>, string> = {
  normal: 'text-primary',
  amber: 'text-warning',
  danger: 'text-danger',
};

function PayRing({
  amount,
  remainingMs,
  initialMs,
  tier,
}: {
  amount: number;
  remainingMs: number | null;
  initialMs: number | null;
  tier: Exclude<Tier, 'expired'>;
}) {
  const SIZE = 176;
  const STROKE = 5;
  const R = (SIZE - STROKE) / 2 - 1;
  const C = 2 * Math.PI * R;
  // The ring is full at the moment the offer is opened and drains to zero at
  // the window's close (fraction of the remaining window, captured on load).
  const fraction =
    remainingMs !== null && initialMs && initialMs > 0
      ? Math.max(0, Math.min(1, remainingMs / initialMs))
      : 1;
  let timeLabel: string | null = null;
  if (remainingMs !== null) {
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
    timeLabel =
      mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m left`
        : `${mins}:${String(secs).padStart(2, '0')} left`;
  }
  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          stroke="currentColor"
          className="text-line"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          className={`${RING_TIER[tier]} transition-[stroke-dashoffset] duration-1000 ease-linear`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          You&apos;ll earn
        </p>
        <p className="font-newsreader text-[34px] font-medium leading-tight text-ink">
          £{amount.toFixed(2)}
        </p>
        {timeLabel && (
          <p className={`mt-0.5 font-jost text-[12px] font-semibold ${RING_TIER[tier]}`}>
            {timeLabel}
          </p>
        )}
      </div>
    </div>
  );
}

export default function OfferPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [expired, setExpired] = useState(false);
  const [processing, setProcessing] = useState<'accept' | 'decline' | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [transientError, setTransientError] = useState<string | null>(null);
  // B3: decline-reason bottom sheet (one tap declines with the reason).
  const [showDeclineSheet, setShowDeclineSheet] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchOffer = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/cleaner/jobs/${params.id}`);
      if (res.status === 404) {
        setGone(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.job) setOffer(data.job);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  // C4: the ring's 100% mark is the window remaining when the offer was first
  // seen here — captured once, so the ring drains steadily from that moment.
  const initialMsRef = useRef<number | null>(null);
  useEffect(() => {
    if (offer?.cascadeExpiresAt && initialMsRef.current === null) {
      initialMsRef.current = Math.max(0, new Date(offer.cascadeExpiresAt).getTime() - Date.now());
    }
  }, [offer]);

  // Tick the countdown every second; flip to the expired terminal state at zero.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (offer && windowState(offer.cascadeExpiresAt, now).tier === 'expired') {
      setExpired(true);
    }
  }, [offer, now]);

  const respond = async (action: 'accept' | 'decline', reason?: string) => {
    if (!offer) return;
    haptic('medium');
    setProcessing(action);
    setTransientError(null);
    const endpoint =
      action === 'decline'
        ? `/api/cleaner/jobs/${offer.id}/decline`
        : offer.cascadePhase === 'RENA_FIND'
          ? `/api/cleaner/jobs/${offer.id}/rena-find-accept`
          : `/api/cleaner/jobs/${offer.id}/accept`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        ...(action === 'decline' && reason
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            }
          : {}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success !== false) {
        if (action === 'accept') {
          haptic('success');
          setAccepted(true);
          setTimeout(() => router.push('/app/today'), 900);
        } else {
          router.push('/app/today');
        }
      } else {
        // The server rejected it — the offer was taken or its window closed while
        // we were deciding (last-second race). Show the SAME expired treatment,
        // never a raw error.
        haptic('error');
        setExpired(true);
      }
    } catch {
      // A genuine network error (not a rejection) — let them retry, don't expire.
      setTransientError('Network error — please try again.');
    } finally {
      setProcessing(null);
    }
  };

  // ── Loading skeleton (never a spinner as a terminal state) ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-xl bg-line" />
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
        <div className="h-48 animate-pulse rounded-2xl bg-line" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 animate-pulse rounded-xl bg-line" />
          <div className="h-12 animate-pulse rounded-xl bg-line" />
        </div>
      </div>
    );
  }

  // ── Load error (retry) ──
  if (loadError) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-newsreader text-xl font-semibold text-ink">
          Couldn&apos;t load this offer
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchOffer();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Gone (404) OR expired (window closed / lost the race) — same terminal ──
  if (gone || expired) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink/5 text-2xl text-ink-3">
          ⏱
        </div>
        <h1 className="mt-4 font-newsreader text-xl font-semibold text-ink">
          This offer has expired
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">
          It may have been passed to another cleaner. No action is needed — new offers will appear
          here and on Today.
        </p>
        <button
          type="button"
          onClick={() => router.push('/app/today')}
          className="mt-5 rounded-[10px] bg-primary px-5 py-2.5 font-jost text-sm font-medium text-white"
        >
          Back to Today
        </button>
      </div>
    );
  }

  if (!offer) return null;

  const { tier } = windowState(offer.cascadeExpiresAt, now);
  const remainingMs = offer.cascadeExpiresAt
    ? Math.max(0, new Date(offer.cascadeExpiresAt).getTime() - now)
    : null;

  return (
    <div>
      {/* Navy hero — service + context; the pay figure moved into the ring */}
      <div className="rounded-2xl bg-primary p-5 text-white shadow-sm">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          New job offer
        </p>
        {/* Explicit on-navy colour: the base layer paints h1..h6 text-gray-900,
            which beats the card's inherited text-white — without this class the
            title renders near-black on brand navy. */}
        <h1 className="mt-1 font-newsreader text-2xl font-semibold text-white">
          {serviceLabel(offer.serviceType)}
        </h1>
        {/* B3: context line — travel half from home-point→postcode crow-flies
            maths (server-computed), schedule half from their other active jobs
            on that date. Either half omits itself if unavailable. */}
        {((offer.context?.travelMinutes !== null && offer.context?.travelMinutes !== undefined) ||
          offer.context) && (
          <p className="mt-3 font-jost text-[13px] text-white/70">
            {[
              offer.context?.travelMinutes !== null && offer.context?.travelMinutes !== undefined
                ? `~${offer.context.travelMinutes} min from home`
                : null,
              offer.context
                ? offer.context.sameDayJobs === 0
                  ? `your ${new Date(`${offer.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })} is free`
                  : `${offer.context.sameDayJobs} other job${offer.context.sameDayJobs === 1 ? '' : 's'} that day`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* C4: pay figure inside the draining countdown ring */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <PayRing
          amount={offer.cleanerEarnings}
          remainingMs={remainingMs}
          initialMs={initialMsRef.current}
          tier={tier === 'expired' ? 'danger' : tier}
        />
      </div>

      {/* Details */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <div className="space-y-2 font-jost text-sm">
          <Row
            label="When"
            value={`${new Date(`${offer.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${offer.time}`}
          />
          <Row label="Duration" value={`${offer.duration} hours`} />
          <Row label="Area" value={offer.postcode || offer.address} />
          {/* LB-7: decision-relevant pre-accept — a cleaner without a kit
              can't take a bring-your-own job. Sits with date/area/pay. */}
          <Row label="Supplies" value={suppliesLabel(offer.suppliesProvided)} />
          {typeof offer.bedrooms === 'number' && (
            // F24.4a: 0 is a Studio — never "0 bed".
            <Row label="Property" value={bedroomsLabel(offer.bedrooms)} />
          )}
          <Row label="Customer" value={offer.clientName} />
        </div>

        {/* H104 item 3: pre-accept is SANITISED (server withholds the fields;
            this line is the honest explanation). Post-accept, the assigned
            cleaner gets the sectioned guidance. */}
        {!offer.assigned ? (
          <div className="mt-4 rounded-lg bg-page p-3">
            <p className="font-jost text-[13px] font-light text-ink-3">
              Customer notes and entry details are shown once you accept.
            </p>
          </div>
        ) : (
          <>
            {offer.fullAddress && (
              <div className="mt-4 rounded-lg bg-page p-3">
                <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  Address
                </p>
                <p className="mt-1 font-jost text-sm text-ink">{offer.fullAddress}</p>
              </div>
            )}
            {offer.keyAccess && (
              <div className="mt-3 rounded-lg bg-page p-3">
                <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  Getting in
                </p>
                <p className="mt-1 font-jost text-sm text-ink">
                  {KEY_ACCESS_LABELS[offer.keyAccess] ?? offer.keyAccess}
                </p>
                {offer.keyAccessNote && (
                  <p className="mt-1 font-jost text-sm text-ink-2">{offer.keyAccessNote}</p>
                )}
              </div>
            )}
            {splitFocus(offer.notes).focus && (
              <div className="mt-3 rounded-lg bg-page p-3">
                <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  What to focus on
                </p>
                <p className="mt-1 font-jost text-sm text-ink-2">{splitFocus(offer.notes).focus}</p>
              </div>
            )}
            {splitFocus(offer.notes).rest && (
              <div className="mt-3 rounded-lg bg-page p-3">
                <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  Notes
                </p>
                <p className="mt-1 font-jost text-sm text-ink-2 whitespace-pre-line">
                  {splitFocus(offer.notes).rest}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {accepted && (
        <div className="mt-4 rounded-lg bg-trust/10 px-4 py-3 font-jost text-sm text-trust">
          Job accepted — added to Today.
        </div>
      )}
      {transientError && (
        <div className="mt-4 rounded-lg bg-danger/10 px-4 py-3 font-jost text-sm text-danger">
          {transientError}
        </div>
      )}

      {/* B3: decline-reason bottom sheet — one tap declines with the reason
          (stored on Booking.declineReasons for cascade analytics). */}
      {showDeclineSheet && !accepted && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-surface p-5 pb-8">
            <p className="font-newsreader text-lg font-semibold text-ink">Why not this one?</p>
            <p className="mt-0.5 font-jost text-[13px] text-ink-3">
              One tap — this declines the offer.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ['too_far', 'Too far'],
                  ['bad_time', 'Bad time'],
                  ['pay_too_low', 'Pay too low'],
                  ['other', 'Other'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={!!processing}
                  onClick={() => {
                    setShowDeclineSheet(false);
                    respond('decline', value);
                  }}
                  className="rounded-[12px] border border-line bg-page px-4 py-3 font-jost text-sm font-medium text-ink-2 active:bg-line disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowDeclineSheet(false)}
              className="mt-3 w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-ink-3"
            >
              Keep the offer
            </button>
          </div>
        </div>
      )}

      {!accepted && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setShowDeclineSheet(true);
            }}
            disabled={!!processing}
            className="rounded-[12px] border border-line bg-surface px-4 py-3 font-jost text-base font-medium text-ink-2 transition-colors hover:bg-page active:opacity-80 disabled:opacity-50"
          >
            {processing === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={() => respond('accept')}
            disabled={!!processing}
            className="rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white transition-colors hover:bg-primary-hover active:opacity-80 disabled:opacity-50"
          >
            {processing === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-3">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
