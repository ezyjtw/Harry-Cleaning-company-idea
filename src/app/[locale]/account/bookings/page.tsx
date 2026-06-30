'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { bookingFullAddress, type BookingAddressSource } from '@/lib/utils/booking-address';

type BookingStatus =
  | 'Pending'
  | 'Finding a cleaner'
  | 'Price approval needed'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Disputed'
  | 'No cleaner available';

interface Booking {
  fullId: string;
  displayId: string;
  date: string;
  time: string;
  cleanerName: string;
  serviceType: string;
  price: number;
  status: BookingStatus;
  rawStatus: string;
  cascadePhase: string | null;
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

const DISPUTABLE_RAW_STATUSES = ['COMPLETED', 'IN_PROGRESS'];

const DISPUTE_REASONS = [
  { value: 'no-show-cleaner', label: 'Cleaner did not show up' },
  { value: 'poor-quality', label: 'Poor quality of cleaning' },
  { value: 'property-damage', label: 'Property damage' },
  { value: 'incorrect-duration', label: 'Incorrect duration' },
  { value: 'safety-concern', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
] as const;

const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Finding a cleaner': 'bg-amber-50 text-amber-600 border-amber-200',
  'Price approval needed': 'bg-amber-50 text-amber-600 border-amber-200',
  Confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  Disputed: 'bg-red-50 text-red-600 border-red-200',
  'No cleaner available': 'bg-red-50 text-red-600 border-red-200',
};

const filterOptions: Array<{ label: string; value: BookingStatus | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

function mapStatus(apiStatus: string, cascadePhase?: string | null): BookingStatus {
  const s = apiStatus.toUpperCase();
  if (s === 'AWAITING_CLEANER' && cascadePhase === 'PROVISIONAL_APPROVAL') {
    return 'Price approval needed';
  }
  if (s === 'AWAITING_CLEANER' && cascadePhase === 'BACKUP_OFFER') {
    return 'Finding a cleaner';
  }
  switch (s) {
    case 'PENDING':
    case 'AWAITING_CLEANER':
      return 'Pending';
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'Confirmed';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'DISPUTED':
      return 'Disputed';
    case 'CASCADE_EXHAUSTED':
      return 'No cleaner available';
    default:
      return 'Pending';
  }
}

interface CancelPreview {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  reason?: string;
}

function refundMessage(p: CancelPreview): string {
  if (p.refundAmount <= 0) {
    return p.refundPercent <= 0
      ? 'No refund — this booking is within 24 hours of the start time. Cancelling now forfeits payment.'
      : 'No payment was captured, so there is nothing to refund.';
  }
  if (p.refundPercent >= 100) {
    return `You'll receive a full refund of £${p.refundAmount.toFixed(2)}.`;
  }
  return `You'll receive a ${p.refundPercent}% refund of £${p.refundAmount.toFixed(2)}.`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | 'All'>('All');

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
            ? { ...b, status: 'Disputed' as const, rawStatus: 'DISPUTED', hasDispute: true }
            : b
        )
      );
      dismissDispute();
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
    fetch('/api/bookings')
      .then((res) => (res.ok ? res.json() : { bookings: [] }))
      .then((data) => {
        const raw = data.data || data.bookings || data || [];
        const items = raw.map((b: Record<string, unknown>) => ({
          fullId: String(b.id || ''),
          displayId: (b.id as string)?.substring(0, 8).toUpperCase() || String(b.id),
          date: typeof b.date === 'string' ? b.date.split('T')[0] : String(b.date),
          time: b.startTime || b.time || '',
          cleanerName: b.cleanerName || 'Assigned cleaner',
          serviceType: b.serviceType || 'Cleaning',
          price: Number(b.totalPrice || b.price || 0),
          status: mapStatus(
            String(b.status || 'PENDING'),
            b.cascadePhase as string | null | undefined
          ),
          rawStatus: String(b.status || 'PENDING').toUpperCase(),
          cascadePhase: (b.cascadePhase as string | null) ?? null,
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
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? bookings : bookings.filter((b) => b.status === filter);

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
        <p className="text-sm text-gray-500">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My Bookings</h2>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New Booking
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === opt.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
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
          <p className="mt-3 text-sm text-gray-500">
            No bookings found{filter !== 'All' ? ` with status "${filter}"` : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div
              key={booking.fullId}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {booking.serviceType}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {formatDate(booking.date)} at {booking.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>{booking.cleanerName}</span>
                    </div>
                    {booking.address && (
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-gray-400"
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
                    {(booking.backupCleanerNames.length > 0 || booking.autoAssignBackup) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          {booking.backupCleanerNames.length > 0
                            ? `Backups: ${booking.backupCleanerNames.join(', ')}`
                            : ''}
                          {booking.backupCleanerNames.length > 0 && booking.autoAssignBackup
                            ? ' · '
                            : ''}
                          {booking.autoAssignBackup ? 'Auto-assign enabled' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <span className="text-lg font-bold text-gray-900">
                    &pound;{booking.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">{booking.displayId}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <Link
                  href={`/messages?bookingId=${booking.fullId}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Message cleaner
                </Link>

                {booking.rawStatus === 'COMPLETED' && (
                  <>
                    {confirmResult[booking.fullId] && (
                      <span
                        className={`text-xs font-medium ${confirmResult[booking.fullId].ok ? 'text-green-700' : 'text-red-700'}`}
                      >
                        {confirmResult[booking.fullId].ok ? '✓ ' : ''}
                        {confirmResult[booking.fullId].message}
                      </span>
                    )}

                    {!booking.completionConfirmed && !confirmResult[booking.fullId] && (
                      <button
                        onClick={() => confirmComplete(booking.fullId)}
                        disabled={confirmingId === booking.fullId}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {confirmingId === booking.fullId
                          ? 'Confirming…'
                          : "I'm satisfied — release payment"}
                      </button>
                    )}

                    {reviewResult[booking.fullId] && (
                      <span
                        className={`text-xs font-medium ${reviewResult[booking.fullId].ok ? 'text-green-700' : 'text-red-700'}`}
                      >
                        {reviewResult[booking.fullId].ok ? '✓ ' : ''}
                        {reviewResult[booking.fullId].message}
                      </span>
                    )}

                    {booking.completionConfirmed &&
                      !booking.hasReview &&
                      !reviewResult[booking.fullId]?.ok &&
                      reviewingId !== booking.fullId &&
                      !confirmResult[booking.fullId]?.ok && (
                        <button
                          onClick={() => setReviewingId(booking.fullId)}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          Leave a review
                        </button>
                      )}

                    {reviewingId === booking.fullId && !booking.hasReview && (
                      <div className="flex w-full flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
                        <span className="text-sm font-medium text-gray-900">
                          How was your clean?
                        </span>

                        <div>
                          <span className="mb-1 block text-xs text-gray-600">Overall rating</span>
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
                                      ? 'text-yellow-400'
                                      : 'text-gray-300'
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
                              <span className="mb-1 block text-xs text-gray-500">{label}</span>
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
                                        star <= value ? 'text-yellow-400' : 'text-gray-300'
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
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs resize-none"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => submitReview(booking.fullId)}
                            disabled={reviewSubmitting || reviewRating < 1}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                          </button>
                          <button
                            onClick={dismissReview}
                            disabled={reviewSubmitting}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    Review price change
                    {booking.topupAmount ? ` (+£${booking.topupAmount.toFixed(2)})` : ''}
                  </Link>
                )}

                {canShowCancel(booking) &&
                  (cancelId === booking.fullId ? (
                    <div className="flex w-full flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      {previewing ? (
                        <span className="text-xs text-gray-600">Checking your refund…</span>
                      ) : cancelError ? (
                        <span className="text-xs text-red-700">{cancelError}</span>
                      ) : preview && !preview.canCancel ? (
                        <span className="text-xs text-red-700">
                          {preview.reason || 'This booking can no longer be cancelled.'}
                        </span>
                      ) : preview ? (
                        <span className="text-xs text-gray-700">
                          Cancel this booking? {refundMessage(preview)}
                        </span>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {preview?.canCancel && !cancelError && (
                          <button
                            onClick={() => confirmCancel(booking.fullId)}
                            disabled={cancelling}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
                          </button>
                        )}
                        <button
                          onClick={dismissCancel}
                          disabled={cancelling}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {preview?.canCancel && !cancelError ? 'Keep booking' : 'Close'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startCancel(booking.fullId)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Cancel booking
                    </button>
                  ))}

                {canShowDispute(booking) &&
                  (disputeId === booking.fullId ? (
                    <div className="flex w-full flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <span className="text-xs font-medium text-gray-800">
                        Report a problem with this booking
                      </span>
                      <select
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs bg-white"
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
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs resize-none"
                      />
                      {disputeError && <span className="text-xs text-red-700">{disputeError}</span>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => submitDispute(booking.fullId)}
                          disabled={
                            submittingDispute || !disputeReason || !disputeDescription.trim()
                          }
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                        >
                          {submittingDispute ? 'Submitting…' : 'Submit report'}
                        </button>
                        <button
                          onClick={dismissDispute}
                          disabled={submittingDispute}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
                      className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50"
                    >
                      Report a problem
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
