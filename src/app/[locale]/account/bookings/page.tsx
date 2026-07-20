'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import BookingStatusChip, { mapStatus, type BookingStatus } from '@/components/BookingStatusChip';
import CleanerAvatar from '@/components/CleanerAvatar';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { DISPUTE_REASONS } from '@/lib/trust';
import { bookingFullAddress, type BookingAddressSource } from '@/lib/utils/booking-address';

interface Booking {
  fullId: string;
  displayId: string;
  date: string;
  time: string;
  cleanerName: string;
  cleanerImage: string | null;
  serviceType: string;
  duration: number;
  price: number;
  status: BookingStatus;
  rawStatus: string;
  cascadePhase: string | null;
  /** H11: live only while CLEANER_CANCELLED — drives the action-needed card. */
  rescueDeadline: string | null;
  address: string;
  backupCleanerNames: string[];
  autoAssignBackup: boolean;
  topupAmount: number | null;
  hasDispute: boolean;
  completionConfirmed: boolean;
  hasReview: boolean;
}

// Raw booking statuses the cancel endpoint accepts (mirrors the server's
// CANCELLABLE_STATUS). Gating on the raw status — not the collapsed UI label —
// keeps EN_ROUTE / IN_PROGRESS (both shown as "Confirmed") out of scope.
const CANCELLABLE_RAW_STATUSES = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'CASCADE_EXHAUSTED',
];

// F9: REVIEWED included — a problem can surface after the review; the service
// accepts it. (X3 context: the 6h self-completion window makes the button on a
// just-completed booking the critical path — it renders on every COMPLETED row.)
const DISPUTABLE_RAW_STATUSES = ['COMPLETED', 'EN_ROUTE', 'IN_PROGRESS', 'REVIEWED'];

const filterOptions: Array<{ label: string; value: BookingStatus | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

interface CancelPreview {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason?: string;
  /** Short-notice grace deadline (ISO) — present while the grace window is live. */
  graceUntil?: string;
}

function refundMessage(p: CancelPreview): string {
  if (p.refundAmount <= 0) {
    return p.refundPercent <= 0
      ? 'No refund — this booking is within 24 hours of the start time. Cancelling now forfeits payment.'
      : 'No payment was captured, so there is nothing to refund.';
  }
  if (p.refundPercent >= 100) {
    // James-ruled short-notice grace: while it's live, say so and show the
    // real deadline so the customer knows how long the free window lasts.
    if (p.graceUntil) {
      const until = new Date(p.graceUntil).toLocaleString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        weekday: 'short',
      });
      return `You'll receive a full refund of £${p.refundAmount.toFixed(2)} — you're inside your free-cancellation window (ends ${until}).`;
    }
    return `You'll receive a full refund of £${p.refundAmount.toFixed(2)}.`;
  }
  return `You'll receive a ${p.refundPercent}% refund of £${p.refundAmount.toFixed(2)}.`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Confirm-complete flow
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const confirmComplete = async (fullId: string) => {
    setConfirmingId(fullId);
    setConfirmResult((prev) => {
      const next = { ...prev };
      delete next[fullId];
      return next;
    });
    try {
      const res = await fetch(`/api/bookings/${fullId}/confirm-complete`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.fullId === fullId ? { ...b, completionConfirmed: true } : b))
        );
        setConfirmResult((prev) => ({
          ...prev,
          [fullId]: {
            ok: true,
            message:
              data.message || 'Confirmed — payment will be released to your cleaner shortly.',
          },
        }));
        setReviewingId(fullId);
      } else {
        setConfirmResult((prev) => ({
          ...prev,
          [fullId]: { ok: false, message: data.error || 'Could not confirm completion.' },
        }));
      }
    } catch {
      setConfirmResult((prev) => ({
        ...prev,
        [fullId]: { ok: false, message: 'Something went wrong. Please try again.' },
      }));
    } finally {
      setConfirmingId(null);
    }
  };

  // Cancel flow (one booking at a time): preview → confirm.
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CancelPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const canShowCancel = (b: Booking): boolean => {
    if (!CANCELLABLE_RAW_STATUSES.includes(b.rawStatus)) return false;
    // Price-approval bookings have their own dedicated action.
    if (b.rawStatus === 'AWAITING_CLEANER' && b.cascadePhase === 'PROVISIONAL_APPROVAL') {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(b.date) >= today;
  };

  const dismissCancel = () => {
    setCancelId(null);
    setPreview(null);
    setCancelError(null);
  };

  const startCancel = async (fullId: string) => {
    setCancelId(fullId);
    setPreview(null);
    setCancelError(null);
    setPreviewing(true);
    try {
      const res = await fetch(`/api/bookings/${fullId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Could not load cancellation details.');
      } else {
        setPreview(data.preview as CancelPreview);
      }
    } catch {
      setCancelError('Network error. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const confirmCancel = async (fullId: string) => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${fullId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Failed to cancel booking.');
        return;
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.fullId === fullId ? { ...b, status: 'Cancelled' as const, rawStatus: 'CANCELLED' } : b
        )
      );
      dismissCancel();
    } catch {
      setCancelError('Failed to cancel booking. Please try again later.');
    } finally {
      setCancelling(false);
    }
  };

  // Dispute flow (one booking at a time): form → confirm.
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const canShowDispute = (b: Booking): boolean => {
    if (b.hasDispute) return false;
    return DISPUTABLE_RAW_STATUSES.includes(b.rawStatus);
  };

  const dismissDispute = () => {
    setDisputeId(null);
    setDisputeReason('');
    setDisputeDescription('');
    setDisputeError(null);
  };

  const submitDispute = async (fullId: string) => {
    setSubmittingDispute(true);
    setDisputeError(null);
    try {
      const res = await fetch(`/api/bookings/${fullId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason, description: disputeDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisputeError(data.error || 'Failed to submit report.');
        return;
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.fullId === fullId
            ? { ...b, status: 'Under review' as const, rawStatus: 'DISPUTED', hasDispute: true }
            : b
        )
      );
      dismissDispute();
      // F9: photos/evidence strengthen the claim — take them straight there.
      window.location.href = '/disputes';
    } catch {
      setDisputeError('Network error. Please try again.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Review flow
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewThoroughness, setReviewThoroughness] = useState(0);
  const [reviewPunctuality, setReviewPunctuality] = useState(0);
  const [reviewCommunication, setReviewCommunication] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const dismissReview = () => {
    setReviewingId(null);
    setReviewRating(0);
    setReviewHover(0);
    setReviewThoroughness(0);
    setReviewPunctuality(0);
    setReviewCommunication(0);
    setReviewText('');
  };

  const submitReview = async (fullId: string) => {
    if (reviewRating < 1) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: fullId,
          rating: reviewRating,
          thoroughness: reviewThoroughness || undefined,
          punctuality: reviewPunctuality || undefined,
          communication: reviewCommunication || undefined,
          text: reviewText.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.fullId === fullId ? { ...b, hasReview: true } : b))
        );
        setReviewResult((prev) => ({
          ...prev,
          [fullId]: { ok: true, message: 'Thank you for your review!' },
        }));
        dismissReview();
      } else {
        setReviewResult((prev) => ({
          ...prev,
          [fullId]: { ok: false, message: data.error || 'Could not submit review.' },
        }));
      }
    } catch {
      setReviewResult((prev) => ({
        ...prev,
        [fullId]: { ok: false, message: 'Something went wrong. Please try again.' },
      }));
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    // H72: the review-request email deep-links here as ?review=<bookingId>.
    // Fetched explicitly like rescues/approvals so the link works even when the
    // booking has fallen off the newest-10 general page (pagination-immune).
    const wanted = new URLSearchParams(window.location.search).get('review');
    // H11: rescues are fetched explicitly and surfaced FIRST — the general
    // page-1 list (newest 10) can miss an older booking whose cleaner just
    // cancelled, and an action-needed booking belongs at the top anyway.
    Promise.all([
      fetch('/api/bookings?status=CLEANER_CANCELLED').then((res) =>
        res.ok ? res.json() : { data: [] }
      ),
      // H57: pending price-change approvals are pinned exactly like rescues —
      // pagination-immune, surfaced first.
      fetch('/api/bookings?approval=pending').then((res) => (res.ok ? res.json() : { data: [] })),
      fetch('/api/bookings').then((res) => (res.ok ? res.json() : { bookings: [] })),
      wanted
        ? fetch(`/api/bookings/${encodeURIComponent(wanted)}`).then((res) =>
            res.ok ? res.json() : null
          )
        : Promise.resolve(null),
    ])
      .then(([rescueData, approvalData, data, reviewTarget]) => {
        const rescueRaw = rescueData.data || [];
        const approvalRaw = approvalData.data || [];
        const generalRaw = data.data || data.bookings || data || [];
        const pinnedIds = new Set(
          [...rescueRaw, ...approvalRaw].map((b: { id?: unknown }) => String(b.id))
        );
        const rescueIds = new Set(rescueRaw.map((b: { id?: unknown }) => String(b.id)));
        const targetRaw =
          reviewTarget && reviewTarget.id && !pinnedIds.has(String(reviewTarget.id))
            ? [reviewTarget]
            : [];
        const targetIds = new Set(targetRaw.map((b: { id?: unknown }) => String(b.id)));
        const raw = [
          ...rescueRaw,
          ...approvalRaw.filter((b: { id?: unknown }) => !rescueIds.has(String(b.id))),
          ...targetRaw,
          ...generalRaw.filter(
            (b: { id?: unknown }) => !pinnedIds.has(String(b.id)) && !targetIds.has(String(b.id))
          ),
        ];
        const items = raw.map((b: Record<string, unknown>) => ({
          fullId: String(b.id || ''),
          displayId: (b.id as string)?.substring(0, 8).toUpperCase() || String(b.id),
          date: typeof b.date === 'string' ? b.date.split('T')[0] : String(b.date),
          time: String(b.startTime || b.time || ''),
          // The list API returns the cleaner NESTED (cleaner: { name }); there is
          // no flat `cleanerName`, so the old read was always undefined and every
          // card showed the "Assigned cleaner" fallback. Read the nested name; when
          // it's genuinely absent, say so honestly for pre-assignment states.
          cleanerName:
            (b.cleaner as { name?: string | null } | null)?.name ||
            (['PENDING', 'AWAITING_CLEANER', 'CASCADE_EXHAUSTED'].includes(
              String(b.status || 'PENDING').toUpperCase()
            )
              ? 'Cleaner being assigned'
              : 'Assigned cleaner'),
          cleanerImage: (b.cleaner as { image?: string | null } | null)?.image ?? null,
          serviceType: String(b.serviceType || 'Cleaning'),
          duration: Number(b.duration || 0),
          price: Number(b.totalPrice || b.price || 0),
          status: mapStatus(
            String(b.status || 'PENDING'),
            b.cascadePhase as string | null | undefined
          ),
          rawStatus: String(b.status || 'PENDING').toUpperCase(),
          cascadePhase: (b.cascadePhase as string | null) ?? null,
          rescueDeadline: (b.rescueDeadline as string | null) ?? null,
          // A12: build from booking columns (helper falls back to legacy relation).
          address: bookingFullAddress(b as BookingAddressSource) || (b.fullAddress as string) || '',
          backupCleanerNames: (b.backupCleanerNames as string[]) || [],
          autoAssignBackup: (b.autoAssignBackup as boolean) || false,
          topupAmount: b.topupAmount ? Number(b.topupAmount) : null,
          hasDispute: !!(b.dispute || (b as Record<string, unknown>).hasDispute),
          completionConfirmed: !!b.completionConfirmedAt,
          hasReview: !!b.review,
        }));
        setBookings(items);
        // Open the review form for the deep-linked booking straight away (only
        // when it is actually reviewable — completed and not yet reviewed).
        if (wanted) {
          const target = items.find(
            (b: { fullId: string; rawStatus: string; hasReview: boolean }) =>
              b.fullId === wanted && b.rawStatus === 'COMPLETED' && !b.hasReview
          );
          if (target) {
            // Cards are collapsed by default — expand the target so the form
            // (which lives in the expanded actions area) is actually on screen.
            setExpandedId(wanted);
            setReviewingId(wanted);
          }
        }
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  // H60 (James-ruled): a booking under dispute REMAINS in Completed — the work
  // happened; the case is an overlay, not a different life stage.
  const filtered =
    filter === 'All'
      ? bookings
      : bookings.filter(
          (b) => b.status === filter || (filter === 'Completed' && b.status === 'Under review')
        );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-ink-3">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-newsreader text-2xl font-semibold text-ink">My Bookings</h2>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          + New Booking
        </Link>
      </div>

      {/* Filter tabs — caps Jost selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] [text-indent:0.08em] transition-colors ${
              filter === opt.value
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-ink-2 hover:bg-page'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-ink-3/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-3 text-sm text-ink-3">
            No bookings found{filter !== 'All' ? ` with status "${filter}"` : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div
              key={booking.fullId}
              className="rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId((id) => (id === booking.fullId ? null : booking.fullId))
                }
                aria-expanded={expandedId === booking.fullId}
                className="flex w-full items-center gap-3 text-left sm:gap-4"
              >
                <CleanerAvatar photo={booking.cleanerImage} name={booking.cleanerName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                      {serviceLabelFromSlug(booking.serviceType)}
                    </span>
                    <BookingStatusChip
                      rawStatus={booking.rawStatus}
                      cascadePhase={booking.cascadePhase}
                    />
                  </div>
                  <p className="mt-1 truncate font-jost text-sm text-ink-2">
                    {booking.cleanerName} · {formatDate(booking.date)} at {booking.time}
                  </p>
                </div>
                <span className="shrink-0 font-newsreader text-xl font-semibold text-ink">
                  &pound;{booking.price.toFixed(2)}
                </span>
                <svg
                  className={`h-5 w-5 shrink-0 text-ink-3 transition-transform ${
                    expandedId === booking.fullId ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* H11: a rescue awaiting the customer's choice is unmissable —
                  visible without expanding, one button into the choice panel. */}
              {booking.rawStatus === 'CLEANER_CANCELLED' && (
                <div
                  className="mt-3 rounded-lg border border-danger/25 bg-danger/5 p-3"
                  data-testid="rescue-action-card"
                >
                  <p className="font-jost text-sm font-semibold text-ink">
                    Your cleaner had to cancel — choose what happens next
                  </p>
                  <p className="mt-0.5 font-jost text-[12px] text-ink-3">
                    Keep the slot with another cleaner, pick a new date, or take a full refund.
                    {booking.rescueDeadline
                      ? ` No choice by ${new Date(booking.rescueDeadline).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}? We'll refund you in full automatically.`
                      : ''}
                  </p>
                  <Link
                    href={`/booking/${booking.fullId}`}
                    className="mt-2 inline-flex rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white hover:bg-primary-hover"
                  >
                    Choose what happens next
                  </Link>
                </div>
              )}

              {/* H57: a price change awaiting the customer's review — same
                  unmissable treatment as the rescue card above. */}
              {booking.cascadePhase === 'PROVISIONAL_APPROVAL' && (
                <div
                  className="mt-3 rounded-lg border border-warning/30 bg-warning/[0.06] p-3"
                  data-testid="approval-action-card"
                >
                  <p className="font-jost text-sm font-semibold text-ink">
                    Price change awaiting your review
                    {booking.topupAmount ? ` — +£${booking.topupAmount.toFixed(2)}` : ''}
                  </p>
                  <p className="mt-0.5 font-jost text-[12px] text-ink-3">
                    Nothing is charged unless you approve. Decline or do nothing and the booking
                    stands at its original price.
                  </p>
                  <Link
                    href={`/booking/${booking.fullId}/approve-topup`}
                    className="mt-2 inline-flex rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white hover:bg-primary-hover"
                  >
                    Review the price change
                  </Link>
                </div>
              )}

              {/* H60: an under-review booking stays here AND links to its case. */}
              {booking.hasDispute && (
                <div className="mt-3 rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2.5">
                  <p className="font-jost text-[13px] text-ink-2">
                    A reported problem on this booking is under review.{' '}
                    <Link href="/disputes" className="font-medium text-warning underline">
                      View the case
                    </Link>
                  </p>
                </div>
              )}

              {expandedId === booking.fullId && (
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  <div className="space-y-1.5 font-jost text-sm text-ink-2">
                    {booking.address && (
                      <div className="flex items-start gap-2">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-ink-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{booking.address}</span>
                      </div>
                    )}
                    {booking.duration > 0 && (
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-ink-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          {booking.duration} {booking.duration === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    )}
                    {(booking.backupCleanerNames.length > 0 || booking.autoAssignBackup) && (
                      <div className="flex items-center gap-2 text-xs text-ink-3">
                        <span>
                          {booking.backupCleanerNames.length > 0
                            ? `Backups: ${booking.backupCleanerNames.join(', ')}`
                            : ''}
                          {booking.backupCleanerNames.length > 0 && booking.autoAssignBackup
                            ? ' · '
                            : ''}
                          {booking.autoAssignBackup ? 'Keep searching enabled' : ''}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-ink-3">Ref: {booking.displayId}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/messages?bookingId=${booking.fullId}`}
                      className="rounded-[10px] border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-page"
                    >
                      Message cleaner
                    </Link>

                    {booking.rawStatus === 'COMPLETED' && (
                      <>
                        {confirmResult[booking.fullId] && (
                          <span
                            className={`text-xs font-medium ${confirmResult[booking.fullId].ok ? 'text-trust' : 'text-danger'}`}
                          >
                            {confirmResult[booking.fullId].ok ? '✓ ' : ''}
                            {confirmResult[booking.fullId].message}
                          </span>
                        )}

                        {!booking.completionConfirmed && !confirmResult[booking.fullId] && (
                          <button
                            onClick={() => confirmComplete(booking.fullId)}
                            disabled={confirmingId === booking.fullId}
                            className="rounded-[10px] bg-trust px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-trust/90 disabled:opacity-50"
                          >
                            {confirmingId === booking.fullId
                              ? 'Confirming…'
                              : "I'm satisfied — release payment"}
                          </button>
                        )}

                        {reviewResult[booking.fullId] && (
                          <span
                            className={`text-xs font-medium ${reviewResult[booking.fullId].ok ? 'text-trust' : 'text-danger'}`}
                          >
                            {reviewResult[booking.fullId].ok ? '✓ ' : ''}
                            {reviewResult[booking.fullId].message}
                          </span>
                        )}

                        {/* H72: no completionConfirmed gate — auto-release after the
                            hold never sets it, which left late-returning customers
                            with no review door at all. Reviewing implies satisfaction
                            (the API records the confirmation in the same transaction);
                            the form says so when confirmation hasn't happened yet. */}
                        {!booking.hasReview &&
                          !reviewResult[booking.fullId]?.ok &&
                          reviewingId !== booking.fullId &&
                          !confirmResult[booking.fullId]?.ok && (
                            <button
                              onClick={() => setReviewingId(booking.fullId)}
                              className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                            >
                              Leave a review
                            </button>
                          )}

                        {reviewingId === booking.fullId && !booking.hasReview && (
                          <div className="flex w-full flex-col gap-3 rounded-[10px] border border-line bg-page p-4">
                            <span className="text-sm font-medium text-ink">
                              How was your clean?
                            </span>
                            {!booking.completionConfirmed && (
                              <span className="text-xs text-ink-3">
                                Submitting a review also confirms you&apos;re happy for payment to
                                be released to your cleaner.
                              </span>
                            )}

                            <div>
                              <span className="mb-1 block text-xs text-ink-2">Overall rating</span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    onMouseEnter={() => setReviewHover(star)}
                                    onMouseLeave={() => setReviewHover(0)}
                                    className="text-2xl focus:outline-none"
                                  >
                                    <span
                                      className={
                                        star <= (reviewHover || reviewRating)
                                          ? 'text-rating'
                                          : 'text-ink-3/40'
                                      }
                                    >
                                      &#9733;
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              {(
                                [
                                  ['Thoroughness', reviewThoroughness, setReviewThoroughness],
                                  ['Punctuality', reviewPunctuality, setReviewPunctuality],
                                  ['Communication', reviewCommunication, setReviewCommunication],
                                ] as const
                              ).map(([label, value, setter]) => (
                                <div key={label}>
                                  <span className="mb-1 block text-xs text-ink-3">{label}</span>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => (setter as (v: number) => void)(star)}
                                        className="text-sm focus:outline-none"
                                      >
                                        <span
                                          className={
                                            star <= value ? 'text-rating' : 'text-ink-3/40'
                                          }
                                        >
                                          &#9733;
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <textarea
                              rows={3}
                              value={reviewText}
                              onChange={(e) => setReviewText(e.target.value)}
                              placeholder="Tell us about your experience (optional)"
                              maxLength={2000}
                              className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => submitReview(booking.fullId)}
                                disabled={reviewSubmitting || reviewRating < 1}
                                className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                              >
                                {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                              </button>
                              <button
                                onClick={dismissReview}
                                disabled={reviewSubmitting}
                                className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {booking.status === 'Price approval needed' && (
                      <Link
                        href={`/booking/${booking.fullId}/approve-topup`}
                        className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                      >
                        Review price change
                        {booking.topupAmount ? ` (+£${booking.topupAmount.toFixed(2)})` : ''}
                      </Link>
                    )}

                    {canShowCancel(booking) &&
                      (cancelId === booking.fullId ? (
                        <div className="flex w-full flex-col gap-2 rounded-[10px] border border-danger/20 bg-danger/[0.04] p-3">
                          {previewing ? (
                            <span className="text-xs text-ink-2">Checking your refund…</span>
                          ) : cancelError ? (
                            <span className="text-xs text-danger">{cancelError}</span>
                          ) : preview && !preview.canCancel ? (
                            <span className="text-xs text-danger">
                              {preview.reason || 'This booking can no longer be cancelled.'}
                            </span>
                          ) : preview ? (
                            <span className="text-xs text-ink-2">
                              Cancel this booking? {refundMessage(preview)}
                            </span>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {preview?.canCancel && !cancelError && (
                              <button
                                onClick={() => confirmCancel(booking.fullId)}
                                disabled={cancelling}
                                className="rounded-[10px] bg-danger px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
                              </button>
                            )}
                            <button
                              onClick={dismissCancel}
                              disabled={cancelling}
                              className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
                            >
                              {preview?.canCancel && !cancelError ? 'Keep booking' : 'Close'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startCancel(booking.fullId)}
                          className="rounded-[10px] border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/[0.06]"
                        >
                          Cancel booking
                        </button>
                      ))}

                    {canShowDispute(booking) &&
                      (disputeId === booking.fullId ? (
                        <div className="flex w-full flex-col gap-2 rounded-[10px] border border-warning/25 bg-warning/[0.06] p-3">
                          <span className="text-xs font-medium text-ink">
                            Report a problem with this booking
                          </span>
                          <select
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                            className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          {disputeError && (
                            <span className="text-xs text-danger">{disputeError}</span>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => submitDispute(booking.fullId)}
                              disabled={
                                submittingDispute || !disputeReason || !disputeDescription.trim()
                              }
                              className="rounded-[10px] bg-warning px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
                            >
                              {submittingDispute ? 'Submitting…' : 'Submit report'}
                            </button>
                            <button
                              onClick={dismissDispute}
                              disabled={submittingDispute}
                              className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setDisputeId(booking.fullId);
                            dismissCancel();
                          }}
                          className="rounded-[10px] border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/[0.08]"
                        >
                          Report a problem
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
