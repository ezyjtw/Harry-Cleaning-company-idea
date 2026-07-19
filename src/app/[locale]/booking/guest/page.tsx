'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

import { cascadeSentence } from '@/components/BookingStatusChip';
import RescuePanel from '@/components/RescuePanel';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { DISPUTE_REASONS } from '@/lib/trust';

// H41 guest parity: same disputable window as the account/booking pages
// (mirrors DISPUTABLE_STATUS in dispute.service.ts — server enforces it).
const DISPUTABLE_STATUSES = ['COMPLETED', 'EN_ROUTE', 'IN_PROGRESS', 'REVIEWED'];

interface Booking {
  id: string;
  guestToken: string;
  cleanerName: string;
  cleanerId?: string | null;
  serviceType: string;
  date: string;
  time: string;
  duration: number;
  address: string;
  totalPrice: number;
  status: string;
  cascadePhase?: string | null;
  rescueDeadline?: string | null;
  backupCleanerIds?: string[];
  postcode?: string;
  guestEmail: string;
  guestName: string;
  notes: string;
  createdAt: string;
}

// 4.6 (James-ruled): EN_ROUTE and IN_PROGRESS are one customer-visible
// "On the way" moment — the timeline shows the same three post-accept beats
// the cleaner drives (Accepted → On the way → Completed).
const STATUS_STEPS = [
  { keys: ['PENDING'], label: 'Pending' },
  { keys: ['AWAITING_CLEANER'], label: 'Awaiting Cleaner' },
  { keys: ['CONFIRMED'], label: 'Confirmed' },
  { keys: ['ACCEPTED'], label: 'Accepted' },
  { keys: ['EN_ROUTE', 'IN_PROGRESS'], label: 'On the way' },
  { keys: ['COMPLETED'], label: 'Completed' },
];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === 'CASCADE_EXHAUSTED') {
    return (
      <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-center">
        <p className="text-lg font-semibold text-danger">No cleaner available</p>
        <p className="mt-1 text-sm text-danger">
          We couldn&rsquo;t find an available cleaner this time — your full refund is being
          processed automatically. We&rsquo;ve emailed you the details.
        </p>
      </div>
    );
  }
  if (currentStatus === 'DISPUTED') {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-center">
        <p className="text-lg font-semibold text-warning">Being reviewed</p>
        <p className="mt-1 text-sm text-ink-2">
          A problem was reported on this booking and our team is reviewing it. Payment is on hold
          while we do — we&rsquo;ll email you the outcome.
        </p>
      </div>
    );
  }
  if (currentStatus === 'CLEANER_CANCELLED') {
    return (
      <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-center">
        <p className="text-lg font-semibold text-danger">Your cleaner has had to cancel</p>
        <p className="mt-1 text-sm text-danger">
          Choose a full refund or a rebooking below — your payment is safe either way.
        </p>
      </div>
    );
  }
  if (currentStatus === 'CANCELLED') {
    return (
      <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-center">
        <p className="text-lg font-semibold text-danger">Booking Cancelled</p>
        <p className="mt-1 text-sm text-danger">This booking has been cancelled.</p>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.keys.includes(currentStatus));

  // U4: seven equal columns of two-word labels never fit a phone — the old
  // single horizontal row overlapped its own labels below ~500px. Mobile now
  // gets a vertical rail (node + label side by side); sm+ keeps the horizontal
  // strip with non-wrapping, evenly-spread labels.
  const node = (index: number, isCompleted: boolean, isCurrent: boolean) => (
    <div
      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isCurrent
          ? 'bg-primary text-white ring-4 ring-primary-soft'
          : isCompleted
            ? 'bg-primary text-white'
            : 'bg-line text-ink-3'
      }`}
    >
      {isCompleted && !isCurrent ? (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        index + 1
      )}
    </div>
  );

  const labelClass = (isCompleted: boolean, isCurrent: boolean) =>
    isCurrent
      ? 'font-semibold text-primary'
      : isCompleted
        ? 'font-medium text-primary'
        : 'text-ink-3';

  return (
    <div className="py-2">
      {/* Mobile: vertical rail */}
      <ol className="sm:hidden">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={step.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                {node(index, isCompleted, isCurrent)}
                {index < STATUS_STEPS.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 ${index < currentIndex ? 'bg-primary' : 'bg-line'}`}
                  />
                )}
              </div>
              <span
                className={`pt-1.5 text-sm leading-tight ${labelClass(isCompleted, isCurrent)} ${
                  index < STATUS_STEPS.length - 1 ? 'pb-5' : ''
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* sm+: horizontal strip */}
      <div className="hidden items-start justify-between sm:flex">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step.label} className="flex flex-1 flex-col items-center">
              <div className="relative flex w-full items-center justify-center">
                {index > 0 && (
                  <div
                    className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${
                      index <= currentIndex ? 'bg-primary' : 'bg-line'
                    }`}
                  />
                )}
                {index < STATUS_STEPS.length - 1 && (
                  <div
                    className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${
                      index < currentIndex ? 'bg-primary' : 'bg-line'
                    }`}
                  />
                )}
                {node(index, isCompleted, isCurrent)}
              </div>
              <span
                className={`mt-2 px-1 text-center text-xs leading-tight ${labelClass(isCompleted, isCurrent)}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuestBookingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  // Guest cancel parity: read-only refund preview shown before confirming.
  const [cancelPreview, setCancelPreview] = useState<{
    canCancel: boolean;
    refundPercent: number;
    refundAmount: number;
    reason?: string;
    graceUntil?: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // H41: tokened "Report a problem" — the guest-parity door to the dispute
  // flow. The token authorizes the POST; on success the booking re-fetches
  // into its DISPUTED state (the "Being reviewed" banner).
  const [reporting, setReporting] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeFiled, setDisputeFiled] = useState(false);

  const fetchBooking = useCallback(async () => {
    if (!token) {
      setError('No booking token provided.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/bookings/guest?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Booking not found.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBooking(data.booking);
    } catch {
      setError('Failed to load booking. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Guest cancel parity (James-ruled): same refund preview + copy the
  // account-holder dialog shows — refund %, amount, and the live grace
  // deadline — BEFORE the guest confirms. Mirrors account/bookings.
  const refundMessage = (p: {
    refundAmount: number;
    refundPercent: number;
    graceUntil?: string;
  }): string => {
    if (p.refundAmount <= 0) {
      return p.refundPercent <= 0
        ? 'No refund — this booking is within 24 hours of the start time. Cancelling now forfeits payment.'
        : 'No payment was captured, so there is nothing to refund.';
    }
    if (p.refundPercent >= 100) {
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
  };

  const startCancel = async () => {
    if (!token || !booking) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch('/api/bookings/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, dryRun: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.preview) {
        setPreviewError(data.error || 'Could not check your refund — please try again.');
        return;
      }
      if (!data.preview.canCancel) {
        setPreviewError(data.preview.reason || 'This booking can no longer be cancelled.');
        return;
      }
      setCancelPreview(data.preview);
    } catch {
      setPreviewError('Could not check your refund — please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const submitDispute = async () => {
    if (!token) return;
    setSubmittingDispute(true);
    setDisputeError(null);
    try {
      const res = await fetch('/api/bookings/guest/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: disputeReason, description: disputeDescription }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisputeError(data.error || 'Failed to submit report.');
        return;
      }
      setDisputeFiled(true);
      setReporting(false);
      // Re-fetch: the booking is now DISPUTED — the "Being reviewed" banner
      // takes over and payment is on hold.
      fetchBooking();
    } catch {
      setDisputeError('Network error. Please try again.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !booking) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/guest?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to cancel booking.');
        setCancelling(false);
        return;
      }
      const data = await res.json();
      setBooking(data.booking);
      setCancelled(true);
    } catch {
      setError('Failed to cancel booking. Please try again later.');
    } finally {
      setCancelling(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-page">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
          <p className="mt-4 text-ink-3">Loading your booking...</p>
        </div>
      </div>
    );
  }

  // Error / not found state
  if (error || !booking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-page px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-8 w-8 text-danger"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="font-newsreader text-2xl text-ink">Booking Not Found</h1>
          <p className="mt-2 text-ink-2">
            {error ||
              "We couldn't find a booking with that token. It may have expired or been removed."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-[10px] bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // F14: mirrors cancellation.service CANCELLABLE_STATUS — ACCEPTED and
  // CASCADE_EXHAUSTED are genuinely cancellable (the old list hid the button
  // and stranded guests with accepted bookings). CLEANER_CANCELLED is handled
  // by the rescue panel, not this button.
  const canCancel =
    !cancelled &&
    (booking.status === 'PENDING' ||
      booking.status === 'AWAITING_CLEANER' ||
      booking.status === 'CONFIRMED' ||
      booking.status === 'ACCEPTED' ||
      booking.status === 'CASCADE_EXHAUSTED');

  const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-newsreader text-3xl text-ink">Your Booking</h1>
          <p className="mt-1 text-ink-3">Booking reference: {booking.id}</p>
        </div>

        {/* Cancellation confirmation */}
        {cancelled && (
          <div className="mb-6 rounded-xl border border-trust/30 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-trust"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-trust">Booking Cancelled</p>
                <p className="text-sm text-trust">
                  Your booking has been cancelled. Any refund due under the cancellation policy is
                  on its way back to your original payment method (5&ndash;10 business days) &mdash;
                  the confirmation email shows the exact amount.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* M3 rescue: cleaner cancelled — the tokened choice panel (F5 pattern) */}
        {booking.status === 'CLEANER_CANCELLED' && token && (
          <div className="mb-6">
            <RescuePanel
              bookingId={booking.id}
              guestToken={token}
              serviceType={booking.serviceType}
              date={booking.date}
              time={booking.time}
              duration={booking.duration}
              postcode={booking.postcode || ''}
              totalPrice={booking.totalPrice}
              cancellerId={booking.cleanerId ?? null}
              cancellerName={booking.cleanerName ?? null}
              backupCleanerIds={booking.backupCleanerIds}
              rescueDeadline={booking.rescueDeadline}
              initialAction={searchParams.get('rescue')}
              onResolved={() => fetchBooking()}
            />
          </div>
        )}

        {/* Status Timeline */}
        <div className="mb-8 rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-jost text-sm font-semibold uppercase tracking-wide text-ink-3">
            Booking Status
          </h2>
          <StatusTimeline currentStatus={booking.status} />
          {booking.status === 'AWAITING_CLEANER' &&
            cascadeSentence(booking.cascadePhase, booking.cleanerName) && (
              <p className="mt-3 rounded-lg bg-primary-soft px-4 py-3 text-center font-jost text-sm text-primary">
                {cascadeSentence(booking.cascadePhase, booking.cleanerName)}
              </p>
            )}
        </div>

        {/* Booking Details */}
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-jost text-sm font-semibold uppercase tracking-wide text-ink-3">
            Booking Details
          </h2>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-3">Cleaner</p>
                <p className="font-medium text-ink">{booking.cleanerName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-3">Service</p>
                <p className="font-medium text-ink">{serviceLabelFromSlug(booking.serviceType)}</p>
              </div>
            </div>

            <div className="border-t border-line" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-3">Date</p>
                <p className="font-medium text-ink">{formattedDate}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-3">Time</p>
                <p className="font-medium text-ink">{booking.time}</p>
              </div>
            </div>

            <div className="border-t border-line" />

            <div>
              <p className="text-sm text-ink-3">Address</p>
              <p className="font-medium text-ink">{booking.address}</p>
            </div>

            <div className="border-t border-line" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-3">Duration</p>
                <p className="font-medium text-ink">
                  {booking.duration} hour{booking.duration !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-3">Total Price</p>
                <p className="font-newsreader text-2xl text-ink">
                  £{booking.totalPrice.toFixed(2)}
                </p>
              </div>
            </div>

            {booking.notes && (
              <>
                <div className="border-t border-line" />
                <div>
                  <p className="text-sm text-ink-3">Notes</p>
                  <p className="text-ink-2">{booking.notes}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* A16b-3: guest→account conversion. Messaging your cleaner and leaving a
            review are account-only features — rather than a dead-end, offer a clear
            path to create an account (email prefilled → verify → this booking
            auto-attaches via A16b-2b). */}
        {!cancelled && booking.status !== 'CANCELLED' && booking.guestEmail && (
          <div className="mb-6 rounded-xl bg-primary-soft p-6">
            <h2 className="text-base font-semibold text-ink">
              Want to message your cleaner or leave a review?
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Create a free account with{' '}
              <span className="font-medium text-ink">{booking.guestEmail}</span> to message your
              cleaner, leave a review after your clean, and see all your bookings in one place —
              this booking attaches to your account automatically.
            </p>
            <Link
              href={`/signup?email=${encodeURIComponent(booking.guestEmail)}`}
              className="mt-4 inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Create an account
            </Link>
          </div>
        )}

        {/* Cancel — two-step: preview (refund + grace copy) → confirm */}
        {canCancel && (
          <div className="mb-6">
            {cancelPreview ? (
              <div
                className="rounded-[10px] border border-danger/25 bg-surface p-4"
                data-testid="guest-cancel-confirm"
              >
                <p className="text-sm text-ink-2">
                  Cancel this booking? {refundMessage(cancelPreview)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded-[10px] bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
                  </button>
                  <button
                    onClick={() => setCancelPreview(null)}
                    disabled={cancelling}
                    className="rounded-[10px] border border-line px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-page"
                  >
                    Keep booking
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={startCancel}
                  disabled={previewing}
                  className="w-full rounded-[10px] border border-danger/40 bg-surface px-6 py-3 text-sm font-medium text-danger transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-danger/40 border-t-danger" />
                      Checking your refund…
                    </span>
                  ) : (
                    'Cancel Booking'
                  )}
                </button>
                {previewError && <p className="mt-2 text-sm text-danger">{previewError}</p>}
              </>
            )}
          </div>
        )}

        {/* H41: guest "Report a problem" — same dispute flow as account
            holders, authorized by the token. Renders only while the work
            happened/is happening and no dispute exists (DISPUTED bookings
            show the "Being reviewed" banner above instead). */}
        {disputeFiled && (
          <div className="mb-6 rounded-xl border border-warning/25 bg-warning/[0.06] p-4">
            <p className="font-semibold text-ink">Problem reported</p>
            <p className="mt-1 text-sm text-ink-2">
              Payment to your cleaner is paused while our team reviews it. We&rsquo;ll email you the
              outcome — reply to that email if you have photos or anything to add.
            </p>
          </div>
        )}
        {!disputeFiled && !cancelled && token && DISPUTABLE_STATUSES.includes(booking.status) && (
          <div className="mb-6">
            {reporting ? (
              <div className="flex flex-col gap-2 rounded-[10px] border border-warning/25 bg-warning/[0.06] p-4">
                <span className="text-sm font-medium text-ink">
                  Report a problem with this booking
                </span>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-ink-3">
                  Reporting a problem pauses payment to your cleaner while we look into it.
                </p>
                {disputeError && <span className="text-xs text-danger">{disputeError}</span>}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={submitDispute}
                    disabled={submittingDispute || !disputeReason || !disputeDescription.trim()}
                    className="rounded-[10px] bg-warning px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
                  >
                    {submittingDispute ? 'Submitting…' : 'Submit report'}
                  </button>
                  <button
                    onClick={() => {
                      setReporting(false);
                      setDisputeError(null);
                    }}
                    disabled={submittingDispute}
                    className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReporting(true)}
                className="w-full rounded-[10px] border border-warning/40 bg-surface px-6 py-3 text-sm font-medium text-warning transition-colors hover:bg-warning/[0.08]"
              >
                Report a problem
              </button>
            )}
          </div>
        )}

        {/* Sign up CTA */}
        <div className="rounded-xl bg-primary-soft p-6 text-center">
          <h3 className="text-lg font-semibold text-ink">Want to manage all your bookings?</h3>
          <p className="mt-1 text-sm text-ink-2">
            Create an account to view booking history, save your favourite cleaners, and rebook with
            one click.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-block rounded-[10px] bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GuestBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-page">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
            <p className="mt-4 text-ink-3">Loading your booking...</p>
          </div>
        </div>
      }
    >
      <GuestBookingContent />
    </Suspense>
  );
}
