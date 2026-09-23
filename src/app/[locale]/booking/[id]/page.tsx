'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  type CancelPreview,
  CustomerAvatar,
  dayPhrase,
  fmtPounds,
  fmtSlotTime,
  isUnpaidPending,
  refundMessage,
  UNPAID_EXPIRY_LINE,
} from '@/components/app/customer';
import BookingStatusChip, { cascadeSentence } from '@/components/BookingStatusChip';
import CleanerAvatar from '@/components/CleanerAvatar';
import NavLink from '@/components/nav/NavLink';
import RegularCleanOfferCard from '@/components/RegularCleanOfferCard';
import RescuePanel from '@/components/RescuePanel';
import UnpaidOccurrencePanel from '@/components/UnpaidOccurrencePanel';
import { bookingCloseState } from '@/lib/booking/close-state';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { isCustomerShellUA } from '@/lib/shell';
import { DISPUTE_REASONS } from '@/lib/trust';
import { formatDate } from '@/lib/utils/formatting';

// H40: statuses where "Report a problem" may be filed. Mirrors
// DISPUTABLE_STATUS in dispute.service.ts (the server enforces it regardless —
// this only controls whether the door renders).
const DISPUTABLE_STATUSES = ['COMPLETED', 'EN_ROUTE', 'IN_PROGRESS', 'REVIEWED'];

// #5: customer job-detail view. Data + access control come entirely from the
// existing ownership-gated GET /api/bookings/[id] (clientId/cleaner/backup/admin
// only) — this page adds NO new route and no new access logic.

interface BookingDetail {
  id: string;
  serviceType: string;
  status: string;
  /** H8: who is looking — rescue choices are the customer's alone. */
  viewer?: 'client' | 'cleaner' | 'backup' | 'admin';
  paymentStatus?: string | null;
  /** R1-C: present on recurring occurrences — selects the no-charge variant. */
  agreementId?: string | null;
  cascadePhase?: string | null;
  date: string;
  startTime: string;
  duration: number | string;
  totalPrice: number | string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressPostcode?: string | null;
  address?: { line1?: string; line2?: string; city?: string; postcode?: string } | null;
  rescueDeadline?: string | null;
  /** H57: pending price-change fields — live while cascadePhase is PROVISIONAL_APPROVAL. */
  topupAmount?: number | string | null;
  provisionalPrice?: number | string | null;
  approvalExpiresAt?: string | null;
  backupCleanerIds?: string[];
  notes?: string | null;
  dispute?: { id: string } | null;
  transferStatus?: string | null;
  completionConfirmedAt?: string | null;
  releaseDueAt?: string | null;
  cleaner: {
    id: string;
    name: string | null;
    image: string | null;
    cleanerProfile?: { rating: number | string | null } | null;
  } | null;
}

type LoadState = 'loading' | 'ok' | 'unauth' | 'forbidden' | 'notfound' | 'error';

export default function BookingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id || '');
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  // Booking tracker skin (James-ruled, option B): mount-gated on the customer
  // shell (RenaApp UA / preview cookie) — SSR + browsers render the page
  // exactly as before; in-shell swaps the RENDER only. The page fetches once
  // on mount and does not poll (disclosed): in-shell the status refreshes on
  // load and on the shell's pull-to-refresh, which reloads the page.
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (isCustomerShellUA() || preview) setInShell(true);
  }, []);

  // In-shell cancel door — the SAME machinery as /account/bookings, verbatim:
  // dryRun preview → refundMessage copy → confirm POST. Skin, not mechanics.
  const [showCancel, setShowCancel] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const startCancel = async () => {
    setShowCancel(true);
    setCancelPreview(null);
    setCancelError(null);
    setPreviewing(true);
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) setCancelError(data.error || 'Could not load cancellation details.');
      else setCancelPreview(data.preview as CancelPreview);
    } catch {
      setCancelError('Network error. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  // Home's unpaid card's Cancel door lands here with ?cancel=1 — auto-OPEN
  // the same dryRun preview (never auto-confirm; the customer still taps
  // Confirm cancellation themselves). One shot, in-shell, PENDING only.
  const autoCancelFired = useRef(false);
  useEffect(() => {
    if (autoCancelFired.current || !inShell || !booking) return;
    if (searchParams.get('cancel') === '1' && booking.status === 'PENDING') {
      autoCancelFired.current = true;
      startCancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inShell, booking, searchParams]);

  const confirmCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Failed to cancel booking.');
        return;
      }
      setBooking((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev));
      setShowCancel(false);
    } catch {
      setCancelError('Failed to cancel booking. Please try again later.');
    } finally {
      setCancelling(false);
    }
  };

  // H40: the "Report a problem" door — the completion notification and the
  // FAQ both send customers HERE to report, but this page never had the door.
  // Same inline form + POST as /account/bookings; success lands on /disputes
  // where evidence (photos) is added and both sides see the case.
  const [reporting, setReporting] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // H57 addendum: the pending price change is actionable RIGHT HERE — the
  // email/banner/card all also lead to the standalone approve page, but the
  // detail page mustn't make the customer hunt for the door.
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const actOnPriceChange = async (action: 'approve' | 'decline') => {
    setApprovalBusy(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.result === 'requires_payment') {
        // Card entry needed — the standalone page hosts the Stripe element.
        window.location.href = `/booking/${id}/approve-topup`;
        return;
      }
      if (!res.ok) {
        setApprovalError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      window.location.reload();
    } catch {
      setApprovalError('Network error. Please try again.');
    } finally {
      setApprovalBusy(false);
    }
  };

  // H42: "Confirm & release payment" — the completion notification promises
  // this action on this page; the machinery (confirm-complete → releaseDueAt
  // now, scheduler releases) existed but only /account/bookings had the door.
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ ok: boolean; message: string } | null>(null);

  const confirmComplete = async () => {
    setConfirming(true);
    setConfirmResult(null);
    try {
      const res = await fetch(`/api/bookings/${id}/confirm-complete`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // F17: progress the page to the released state in place — the door
        // predicate goes false and the released-awaiting-review card takes
        // over (the scheduler completes the actual transfer within its tick).
        // No re-fired review prompt: the card carries the single review invite.
        setBooking((prev) =>
          prev
            ? {
                ...prev,
                completionConfirmedAt: new Date().toISOString(),
                transferStatus: 'RELEASED',
              }
            : prev
        );
      } else {
        setConfirmResult({ ok: false, message: data.error || 'Could not confirm completion.' });
      }
    } catch {
      setConfirmResult({ ok: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setConfirming(false);
    }
  };

  const submitDispute = async () => {
    setSubmittingDispute(true);
    setDisputeError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason, description: disputeDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisputeError(data.error || 'Failed to submit report.');
        return;
      }
      // F9 pattern: photos/evidence strengthen the claim — take them straight
      // to the dispute case.
      window.location.href = '/disputes';
    } catch {
      setDisputeError('Network error. Please try again.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (res.status === 401) return setState('unauth');
        if (res.status === 403) return setState('forbidden');
        if (res.status === 404) return setState('notfound');
        if (!res.ok) return setState('error');
        setBooking(await res.json());
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-line" />
          <div className="h-40 rounded-2xl bg-line" />
        </div>
      </div>
    );
  }

  if (state !== 'ok' || !booking) {
    const copy: Record<Exclude<LoadState, 'loading' | 'ok'>, { title: string; body: string }> = {
      unauth: { title: 'Please sign in', body: 'Sign in to view this booking.' },
      forbidden: { title: 'No access', body: "This booking isn't associated with your account." },
      notfound: { title: 'Not found', body: 'We couldn’t find that booking.' },
      error: { title: 'Something went wrong', body: 'Please try again in a moment.' },
    };
    const c = copy[state as Exclude<LoadState, 'loading' | 'ok'>] ?? copy.error;
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-[22px] font-semibold text-ink">{c.title}</h1>
          <p className="mt-2 font-jost text-[14px] text-ink-3">{c.body}</p>
          <Link
            href={state === 'unauth' ? `/login?callbackUrl=/booking/${id}` : '/account/bookings'}
            className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {state === 'unauth' ? 'Sign in' : 'My bookings'}
          </Link>
        </div>
      </div>
    );
  }

  const cleaner = booking.cleaner;
  const rating = cleaner?.cleanerProfile?.rating;
  const address = [
    booking.addressLine1 ?? booking.address?.line1,
    booking.addressLine2 ?? booking.address?.line2,
    booking.addressCity ?? booking.address?.city,
    booking.addressPostcode ?? booking.address?.postcode,
  ]
    .filter(Boolean)
    .join(', ');

  // F16: whole hours until the auto-release clock fires (null when the clock
  // isn't armed or has already passed — copy falls back to the generic line).
  const releaseEtaMs = booking.releaseDueAt
    ? new Date(booking.releaseDueAt).getTime() - Date.now()
    : 0;
  const releaseEtaHours = releaseEtaMs > 0 ? Math.max(1, Math.ceil(releaseEtaMs / 3600_000)) : null;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="font-jost text-[13px] text-ink-3">{label}</span>
      <span className="text-right font-jost text-[14px] font-medium text-ink">{value}</span>
    </div>
  );

  // ─── Booking tracker (in-shell render — same data, same handlers) ──────────
  if (inShell) {
    const st = booking.status;
    const first = cleaner?.name ? cleaner.name.split(' ')[0] : 'Your cleaner';
    // Honest unpaid state (ruled): unpaid-PENDING speaks plainly and lights
    // no journey progress — stageIdx -1 leaves every stage unlit.
    const unpaid = isUnpaidPending(st, booking.paymentStatus);
    const stageIdx = unpaid
      ? -1
      : st === 'COMPLETED' || st === 'REVIEWED'
        ? 3
        : st === 'EN_ROUTE' || st === 'IN_PROGRESS'
          ? 2
          : st === 'ACCEPTED' || st === 'CONFIRMED'
            ? 1
            : 0;
    const headline = unpaid
      ? 'Payment incomplete'
      : st === 'REVIEWED'
        ? 'All done — thanks for your review!'
        : st === 'COMPLETED'
          ? 'All done — how was it?'
          : st === 'IN_PROGRESS'
            ? 'Clean in progress'
            : st === 'EN_ROUTE'
              ? `${first}'s on the way`
              : st === 'ACCEPTED' || st === 'CONFIRMED'
                ? `Confirmed for ${dayPhrase(booking.date.split('T')[0])}`
                : "We're confirming your cleaner";
    const subline = `${dayPhrase(booking.date.split('T')[0])} · ${fmtSlotTime(booking.startTime)} · ${serviceLabelFromSlug(booking.serviceType)}`;
    const cancelled = st === 'CANCELLED';
    const rescue = st === 'CLEANER_CANCELLED' && booking.viewer === 'client';
    const done = st === 'COMPLETED' || st === 'REVIEWED';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cancellable =
      booking.viewer === 'client' &&
      ['PENDING', 'AWAITING_CLEANER', 'CONFIRMED', 'ACCEPTED', 'CASCADE_EXHAUSTED'].includes(st) &&
      booking.cascadePhase !== 'PROVISIONAL_APPROVAL' &&
      new Date(booking.date) >= today;
    const recurring = !!booking.agreementId;
    const stages = ['Booked', 'Confirmed', 'On the way', 'Done'];

    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4" data-testid="tracker-page">
        <Link
          href="/account/bookings"
          className="font-jost text-[13px] font-medium text-ink-3 active:opacity-70"
        >
          ‹ My Cleans
        </Link>

        {/* Exception heroes replace the tracker headline, never the skeleton. */}
        {cancelled && (
          <div
            className="mt-3 rounded-xl border border-line bg-surface px-5 py-6 text-center"
            data-testid="tracker-cancelled"
          >
            <p className="font-jost text-[17px] font-semibold text-ink-3 line-through">
              This clean was cancelled
            </p>
            <p className="mt-1 font-jost text-[13px] text-ink-3">{subline}</p>
          </div>
        )}
        {rescue && (
          <div className="mt-3" data-testid="tracker-rescue">
            <p className="font-jost text-[17px] font-semibold text-danger">
              {first} had to cancel — choose what happens next
            </p>
            <p className="mb-3 mt-0.5 font-jost text-[13px] text-ink-3">{subline}</p>
            {booking.agreementId && booking.paymentStatus !== 'SUCCEEDED' ? (
              <UnpaidOccurrencePanel
                bookingId={booking.id}
                cleanerName={booking.cleaner?.name ?? null}
                date={booking.date.split('T')[0]}
                time={booking.startTime}
                onResolved={() => window.location.reload()}
              />
            ) : (
              <RescuePanel
                bookingId={booking.id}
                serviceType={booking.serviceType}
                date={booking.date.split('T')[0]}
                time={booking.startTime}
                duration={Number(booking.duration)}
                postcode={booking.addressPostcode || booking.address?.postcode || ''}
                totalPrice={Number(booking.totalPrice)}
                cancellerId={booking.cleaner?.id ?? null}
                cancellerName={booking.cleaner?.name ?? null}
                backupCleanerIds={booking.backupCleanerIds}
                rescueDeadline={booking.rescueDeadline}
                initialAction={searchParams.get('rescue')}
                onResolved={() => window.location.reload()}
              />
            )}
          </div>
        )}

        {!cancelled && !rescue && (
          <div
            className="mt-3 rounded-xl border border-line bg-surface p-5"
            data-testid="tracker-card"
          >
            <p className="font-jost text-[19px] font-semibold leading-snug text-ink">{headline}</p>
            <p className="mt-1 font-jost text-[13px] text-ink-3">{subline}</p>
            {unpaid && (
              <p
                className="mt-2 font-jost text-[13px] text-ink-2"
                data-testid="tracker-unpaid-note"
              >
                {UNPAID_EXPIRY_LINE}
              </p>
            )}
            {/* Finish door (ruled): primary, beside the quiet-red Cancel that
                already renders below for PENDING. */}
            {unpaid && (
              <Link
                href={`/booking/${id}/finish`}
                data-testid="tracker-finish"
                className="mt-3.5 block rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
              >
                Finish Payment
              </Link>
            )}
            <div className="mt-5 flex items-start" data-testid="journey-line">
              {stages.map((label, i) => (
                <div key={label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div
                      className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : i <= stageIdx ? 'bg-trust' : 'bg-line'}`}
                    />
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        i < stageIdx || stageIdx === 3
                          ? 'bg-trust'
                          : i === stageIdx
                            ? 'bg-primary ring-4 ring-primary-soft'
                            : 'border border-line bg-surface'
                      }`}
                      data-stage={
                        i < stageIdx || stageIdx === 3
                          ? 'done'
                          : i === stageIdx
                            ? 'current'
                            : 'future'
                      }
                    >
                      {i < stageIdx || stageIdx === 3 ? (
                        <svg
                          className={`h-3.5 w-3.5 ${i === stageIdx ? 'text-white' : 'text-white'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      ) : i === stageIdx ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </div>
                    <div
                      className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'bg-transparent' : i < stageIdx ? 'bg-trust' : 'bg-line'}`}
                    />
                  </div>
                  <span
                    className={`mt-1.5 font-jost text-[10.5px] font-semibold ${
                      i < stageIdx || stageIdx === 3
                        ? 'text-trust'
                        : i === stageIdx
                          ? 'text-primary'
                          : 'text-ink-3'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price-approval card slots above the facts — same machinery. */}
        {booking.viewer === 'client' && booking.cascadePhase === 'PROVISIONAL_APPROVAL' && (
          <div
            className="mt-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4"
            data-testid="tracker-approval"
          >
            <p className="font-jost text-[14px] font-semibold text-ink">
              A price change of +{fmtPounds(Number(booking.topupAmount ?? 0))} needs your review
            </p>
            <p className="mt-1 font-jost text-[12.5px] text-ink-2">
              New total {fmtPounds(Number(booking.provisionalPrice ?? booking.totalPrice))}. Nothing
              is charged unless you approve — decline or do nothing and the booking stands at its
              original price.
            </p>
            {approvalError && (
              <p className="mt-1.5 font-jost text-[12.5px] text-danger">{approvalError}</p>
            )}
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => actOnPriceChange('approve')}
                disabled={approvalBusy}
                className="flex-1 rounded-[10px] bg-primary py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
              >
                {approvalBusy ? 'Working…' : 'Approve'}
              </button>
              <button
                onClick={() => actOnPriceChange('decline')}
                disabled={approvalBusy}
                className="flex-1 rounded-[10px] border border-line bg-surface py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Compressed person row */}
        {cleaner?.name && (
          <div
            className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-surface p-4"
            data-testid="tracker-person"
          >
            <CustomerAvatar photo={cleaner.image} name={cleaner.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center font-jost text-[15px] font-semibold text-ink">
                {cleaner.name}
                <svg
                  className="ml-1 h-3.5 w-3.5 text-trust"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {Number(rating) > 0 && (
                  <span className="ml-2 font-jost text-[12.5px] font-medium text-ink-3">
                    ★ {Number(rating).toFixed(1)}
                  </span>
                )}
              </span>
              <span className="block truncate font-jost text-[12.5px] text-ink-3">
                {address || serviceLabelFromSlug(booking.serviceType)} ·{' '}
                {fmtPounds(Number(booking.totalPrice))}
              </span>
            </span>
            <Link
              href={`/messages?bookingId=${booking.id}`}
              className="shrink-0 font-jost text-[13px] font-semibold text-primary"
            >
              Message ›
            </Link>
          </div>
        )}

        {/* The facts — for a done clean this card IS the receipt. */}
        <div
          className="mt-3 rounded-xl border border-line bg-surface px-4"
          data-testid="tracker-facts"
        >
          {done && (
            <p className="pt-3 font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Receipt
            </p>
          )}
          <div className="divide-y divide-line/60">
            <Row
              label="When"
              value={`${formatDate(booking.date, 'full')} · ${fmtSlotTime(booking.startTime)}`}
            />
            <Row
              label="Service"
              value={`${serviceLabelFromSlug(booking.serviceType)} · ${Number(booking.duration)}h${recurring ? ' · ↻' : ''}`}
            />
            {address && <Row label="Where" value={address} />}
            <Row label="Total" value={fmtPounds(Number(booking.totalPrice))} />
          </div>
          {booking.notes && (
            <p className="border-t border-line/60 py-3 font-jost text-[13px] text-ink-2">
              {booking.notes}
            </p>
          )}
        </div>

        {/* Contextual doors */}
        {cancelled && (
          <Link
            href="/app/book"
            className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 active:bg-page"
            data-testid="tracker-book-again"
          >
            <span className="font-jost text-[15px] font-medium text-ink">Book Again</span>
            <span className="font-jost text-[15px] font-semibold text-primary">›</span>
          </Link>
        )}
        {done && st === 'COMPLETED' && (
          <Link
            href={`/account/bookings?review=${booking.id}`}
            className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 active:bg-page"
            data-testid="tracker-review-door"
          >
            <span className="font-jost text-[15px] font-medium text-ink">Leave A Review</span>
            <span className="font-jost text-[15px] font-semibold text-primary">›</span>
          </Link>
        )}
        {done &&
          booking.viewer === 'client' &&
          booking.transferStatus === 'PENDING' &&
          !booking.completionConfirmedAt &&
          !booking.dispute && (
            <div className="mt-3 rounded-xl border border-line bg-surface p-4">
              <p className="font-jost text-[14px] font-medium text-ink">Happy with your clean?</p>
              <p className="mt-1 font-jost text-[12.5px] text-ink-2">
                Confirm you&apos;re satisfied and we&apos;ll release payment to {first} right away —
                or it releases automatically after the completion hold.
              </p>
              {confirmResult && !confirmResult.ok && (
                <p className="mt-1.5 font-jost text-[12.5px] text-danger">
                  {confirmResult.message}
                </p>
              )}
              <button
                onClick={confirmComplete}
                disabled={confirming}
                className="mt-2.5 w-full rounded-[10px] bg-trust py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
              >
                {confirming ? 'Confirming…' : 'Confirm & Release Payment'}
              </button>
            </div>
          )}
        {!cancelled && !rescue && !done && cancellable && (
          <>
            <button
              type="button"
              onClick={startCancel}
              data-testid="tracker-cancel"
              className="mt-3 w-full rounded-[10px] border border-danger/30 py-3 font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-danger active:bg-danger/[0.06]"
            >
              Cancel This Clean
            </button>
            {showCancel && (
              <div
                className="mt-2 flex w-full flex-col gap-2 rounded-[10px] border border-danger/20 bg-danger/[0.04] p-3"
                data-testid="tracker-cancel-confirm"
              >
                {previewing ? (
                  <span className="font-jost text-xs text-ink-2">Checking your refund…</span>
                ) : cancelError ? (
                  <span className="font-jost text-xs text-danger">{cancelError}</span>
                ) : cancelPreview && !cancelPreview.canCancel ? (
                  <span className="font-jost text-xs text-danger">
                    {cancelPreview.reason || 'This booking can no longer be cancelled.'}
                  </span>
                ) : cancelPreview ? (
                  <span className="font-jost text-xs text-ink-2">
                    Cancel this booking? {refundMessage(cancelPreview)}
                  </span>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {cancelPreview?.canCancel && !cancelError && (
                    <button
                      onClick={confirmCancel}
                      disabled={cancelling}
                      className="rounded-[10px] bg-danger px-3 py-2 font-jost text-xs font-medium text-white disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowCancel(false)}
                    disabled={cancelling}
                    className="rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-xs font-medium text-ink-2 disabled:opacity-50"
                  >
                    {cancelPreview?.canCancel && !cancelError ? 'Keep booking' : 'Close'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Money-protection doors carried in-shell (disclosed): a reported
            problem stays visible, and the report door stays reachable. */}
        {booking.viewer === 'client' && booking.dispute && (
          <p className="mt-3 rounded-[10px] border border-warning/25 bg-warning/[0.06] px-3 py-2.5 font-jost text-[13px] text-ink-2">
            A reported problem on this clean is under review.{' '}
            <Link href="/disputes" className="font-medium text-warning underline">
              View the case
            </Link>
          </p>
        )}
        {booking.viewer === 'client' &&
          !booking.dispute &&
          DISPUTABLE_STATUSES.includes(st) &&
          (reporting ? (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-warning/25 bg-warning/[0.06] p-4">
              <span className="font-jost text-[14px] font-medium text-ink">
                Report a problem with this clean
              </span>
              <select
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="rounded-[10px] border border-line bg-surface px-3 py-2.5 font-jost text-[13px] text-ink focus:border-primary focus:outline-none"
              >
                <option value="">Select a reason…</option>
                {DISPUTE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder="Please describe the problem…"
                maxLength={2000}
                className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
              />
              <p className="font-jost text-[12px] text-ink-3">
                Reporting a problem pauses payment to your cleaner while we look into it. You can
                add photos on the next page.
              </p>
              {disputeError && (
                <span className="font-jost text-[12px] text-danger">{disputeError}</span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={submitDispute}
                  disabled={submittingDispute || !disputeReason || !disputeDescription.trim()}
                  className="flex-1 rounded-[10px] bg-warning py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                >
                  {submittingDispute ? 'Submitting…' : 'Submit Report'}
                </button>
                <button
                  onClick={() => {
                    setReporting(false);
                    setDisputeError(null);
                  }}
                  disabled={submittingDispute}
                  className="flex-1 rounded-[10px] border border-line bg-surface py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="mt-3 block w-full text-center font-jost text-[12.5px] font-medium text-ink-3 underline active:opacity-70"
              data-testid="tracker-report"
            >
              Something wrong? Report a problem
            </button>
          ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <NavLink
        surface="booking-detail-back"
        href="/account"
        className="font-jost text-[12px] uppercase tracking-[0.1em] text-primary hover:underline"
      >
        ← Back to my account
      </NavLink>

      {/* H8: the rescue choice belongs to the CUSTOMER. Other authorized
          viewers (the cleaner — including the canceller — backups, admin) get
          an informational state, never the actionable panel. The POST refuses
          them regardless; this stops the page presenting a choice that isn't
          theirs. */}
      {booking.status === 'CLEANER_CANCELLED' && booking.viewer !== 'client' && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {booking.viewer === 'admin' ? 'Awaiting customer choice' : 'For the customer'}
          </p>
          <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
            {booking.viewer === 'admin'
              ? 'The customer is choosing what happens next'
              : 'This link is for the customer'}
          </h2>
          <p className="mt-2 font-jost text-sm text-ink-2">
            {booking.viewer === 'admin'
              ? 'They can keep the slot with another cleaner, rebook a new date, or take a full refund. If they make no choice by the deadline, the full refund fires automatically. Read-only here.'
              : 'This booking was cancelled by its cleaner, and the customer has been asked to choose what happens next. There is nothing to action on this page.'}
          </p>
          {booking.rescueDeadline && (
            <p className="mt-2 font-jost text-[13px] text-ink-3">
              Auto-refund deadline: {new Date(booking.rescueDeadline).toLocaleString('en-GB')}
            </p>
          )}
        </div>
      )}

      {/* H57 addendum: pending price change — inline approve/decline for the
          booking's customer. Same POST as the standalone approve page; card
          entry (no saved card) hands over to that page's Stripe element. */}
      {booking.viewer === 'client' && booking.cascadePhase === 'PROVISIONAL_APPROVAL' && (
        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/[0.06] p-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">
            Action needed
          </p>
          <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
            A price change of +£{Number(booking.topupAmount ?? 0).toFixed(2)} needs your review
          </h2>
          <p className="mt-2 font-jost text-sm text-ink-2">
            New total: £{Number(booking.provisionalPrice ?? booking.totalPrice).toFixed(2)} (was £
            {Number(booking.totalPrice).toFixed(2)}). Nothing is charged unless you approve —
            decline or do nothing and the booking stands at its original price.
            {booking.approvalExpiresAt &&
              ` You have until ${new Date(booking.approvalExpiresAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} to decide.`}
          </p>
          {approvalError && (
            <p className="mt-2 font-jost text-[13px] text-danger">{approvalError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => actOnPriceChange('approve')}
              disabled={approvalBusy}
              className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {approvalBusy ? 'Working…' : 'Approve & pay the difference'}
            </button>
            <button
              onClick={() => actOnPriceChange('decline')}
              disabled={approvalBusy}
              className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[13px] font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* M3 rescue: cleaner cancelled — the customer's refund/rebook choice */}
      {/* R1-C: an UNPAID occurrence's can't-make gets the no-charge variant —
          reschedule with the same cleaner or skip; the paid rescue keeps the
          full three-way panel below, untouched. */}
      {booking.status === 'CLEANER_CANCELLED' &&
        booking.viewer === 'client' &&
        booking.agreementId &&
        booking.paymentStatus !== 'SUCCEEDED' && (
          <div className="mt-4">
            <UnpaidOccurrencePanel
              bookingId={booking.id}
              cleanerName={booking.cleaner?.name ?? null}
              date={booking.date.split('T')[0]}
              time={booking.startTime}
              onResolved={() => window.location.reload()}
            />
          </div>
        )}
      {booking.status === 'CLEANER_CANCELLED' &&
        booking.viewer === 'client' &&
        !(booking.agreementId && booking.paymentStatus !== 'SUCCEEDED') && (
          <div className="mt-4">
            <RescuePanel
              bookingId={booking.id}
              serviceType={booking.serviceType}
              date={booking.date.split('T')[0]}
              time={booking.startTime}
              duration={Number(booking.duration)}
              postcode={booking.addressPostcode || booking.address?.postcode || ''}
              totalPrice={Number(booking.totalPrice)}
              cancellerId={booking.cleaner?.id ?? null}
              cancellerName={booking.cleaner?.name ?? null}
              backupCleanerIds={booking.backupCleanerIds}
              rescueDeadline={booking.rescueDeadline}
              initialAction={searchParams.get('rescue')}
              onResolved={() => window.location.reload()}
            />
          </div>
        )}

      <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
        {/* Cleaner */}
        <div className="flex items-center gap-3">
          {/* H22 sweep: hand-rolled img/initials pair → the shared avatar (same
              photo-or-initial behaviour, plus its broken-image fallback). */}
          <CleanerAvatar
            photo={cleaner?.image}
            name={cleaner?.name || 'C'}
            size={48}
            className="shrink-0"
          />
          <div>
            <p className="font-jost text-[15px] font-medium text-ink">
              {cleaner?.name || 'Assigned cleaner'}
            </p>
            {Number(rating) > 0 && (
              <p className="font-jost text-[12px] text-ink-3">
                <span className="text-rating">★</span> {Number(rating).toFixed(1)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-line">
          <Row label="Service" value={serviceLabelFromSlug(booking.serviceType)} />
          <Row
            label="Status"
            value={
              <BookingStatusChip rawStatus={booking.status} cascadePhase={booking.cascadePhase} />
            }
          />
          {booking.status === 'AWAITING_CLEANER' &&
            cascadeSentence(booking.cascadePhase, cleaner?.name) && (
              <p className="py-2 font-jost text-[13px] text-primary">
                {cascadeSentence(booking.cascadePhase, cleaner?.name)}
              </p>
            )}
          <Row label="Date" value={formatDate(booking.date, 'full')} />
          <Row label="Time" value={`${booking.startTime} · ${Number(booking.duration)}h`} />
          {address && <Row label="Address" value={address} />}
          <Row label="Total" value={`£${Number(booking.totalPrice).toFixed(2)}`} />
        </div>

        {booking.notes && (
          <div className="mt-4 rounded-[10px] border border-line bg-page px-4 py-3">
            <p className="font-jost text-[12px] text-ink-3">Notes</p>
            <p className="mt-1 font-jost text-[14px] text-ink">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* H42 + F16: confirm-release door — customer only, funds still HOLDABLE
          (that's the whole predicate: transferStatus PENDING and not yet
          confirmed), no dispute. F16 fix: the old status==='COMPLETED' gate
          made the button vanish when a REVIEW flipped the booking to REVIEWED
          while funds were still held — review and release are independent
          axes, so the door now keys on money-state truth alone and disappears
          the instant funds release by ANY path. Release logic unchanged. */}
      {booking.viewer === 'client' &&
        (booking.status === 'COMPLETED' || booking.status === 'REVIEWED') &&
        booking.transferStatus === 'PENDING' &&
        !booking.completionConfirmedAt &&
        !booking.dispute && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="font-jost text-[14px] font-medium text-ink">
              {booking.status === 'REVIEWED' ? 'Thanks for your review!' : 'Happy with your clean?'}
            </p>
            <p className="mt-1 font-jost text-[13px] text-ink-2">
              {booking.status === 'REVIEWED'
                ? `Payment releases automatically${releaseEtaHours ? ` in about ${releaseEtaHours}h` : ' after the completion hold'} — or release it to your cleaner now.`
                : 'Confirm you’re satisfied and we’ll release payment to your cleaner right away. If you do nothing, it releases automatically after the completion hold (24 hours for a first booking).'}
            </p>
            {confirmResult && !confirmResult.ok && (
              <p className="mt-2 font-jost text-[13px] text-danger">{confirmResult.message}</p>
            )}
            <button
              onClick={confirmComplete}
              disabled={confirming}
              className="mt-3 rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm & release payment'}
            </button>
          </div>
        )}
      {/* F16: honest close-state line. CLOSED needs BOTH — funds released AND
          review left, in either order; the partial states say exactly which
          half is outstanding. Derived from the two truths, no new state. */}
      {booking.viewer === 'client' &&
        !booking.dispute &&
        bookingCloseState(booking) === 'released-awaiting-review' && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="font-jost text-[14px] font-medium text-ink">
              Payment released — awaiting your review
            </p>
            <p className="mt-1 font-jost text-[13px] text-ink-2">
              Your cleaner has been paid. Leaving a review closes this booking off and helps the
              next customer choose.
            </p>
            <Link
              href="/account/bookings"
              className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Leave a review
            </Link>
          </div>
        )}
      {booking.viewer === 'client' && bookingCloseState(booking) === 'closed' && (
        <div className="mt-4 rounded-2xl border border-trust/30 bg-green-50 p-5">
          <p className="font-jost text-[14px] font-medium text-trust">
            All done — payment released and your review is in
          </p>
        </div>
      )}

      {/* R1-A (amended): post-completion regular-clean offer — the card
          self-gates on the offer endpoint (completed + open slots + no active
          agreement), so it renders nothing for anyone else. */}
      {booking.viewer === 'client' &&
        (booking.status === 'COMPLETED' || booking.status === 'REVIEWED') && (
          <RegularCleanOfferCard bookingId={id} className="mt-4" />
        )}

      {/* H40: report-a-problem door — customer only, work happened/happening,
          no dispute already open. The friendly label stays; the flow behind it
          is the real dispute machinery (pauses payment, notifies the cleaner,
          lands in the admin queue). */}
      {booking.viewer === 'client' && booking.dispute && (
        <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/[0.06] p-5">
          <p className="font-jost text-[14px] font-medium text-ink">
            A problem has been reported on this booking
          </p>
          <p className="mt-1 font-jost text-[13px] text-ink-2">
            Our team is reviewing it. You can add photos and follow the case on your disputes page.
          </p>
          <Link
            href="/disputes"
            className="mt-3 inline-flex items-center justify-center rounded-[10px] border border-warning/40 px-4 py-2 font-jost text-[13px] font-medium text-warning transition-colors hover:bg-warning/[0.08]"
          >
            View the case
          </Link>
        </div>
      )}
      {booking.viewer === 'client' &&
        !booking.dispute &&
        DISPUTABLE_STATUSES.includes(booking.status) &&
        (reporting ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-warning/25 bg-warning/[0.06] p-5">
            <span className="font-jost text-[14px] font-medium text-ink">
              Report a problem with this booking
            </span>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a reason…</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={disputeDescription}
              onChange={(e) => setDisputeDescription(e.target.value)}
              placeholder="Please describe the problem…"
              maxLength={2000}
              className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="font-jost text-[12px] text-ink-3">
              Reporting a problem pauses payment to your cleaner while we look into it. You can add
              photos on the next page.
            </p>
            {disputeError && (
              <span className="font-jost text-[12px] text-danger">{disputeError}</span>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={submitDispute}
                disabled={submittingDispute || !disputeReason || !disputeDescription.trim()}
                className="rounded-[10px] bg-warning px-4 py-2 font-jost text-[13px] font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
              >
                {submittingDispute ? 'Submitting…' : 'Submit report'}
              </button>
              <button
                onClick={() => {
                  setReporting(false);
                  setDisputeError(null);
                }}
                disabled={submittingDispute}
                className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[13px] font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={() => setReporting(true)}
              className="rounded-[10px] border border-warning/40 px-4 py-2 font-jost text-[13px] font-medium text-warning transition-colors hover:bg-warning/[0.08]"
            >
              Report a problem
            </button>
          </div>
        ))}
    </div>
  );
}
