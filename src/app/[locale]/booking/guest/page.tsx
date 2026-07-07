'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

import RescuePanel from '@/components/RescuePanel';

interface Booking {
  id: string;
  guestToken: string;
  cleanerName: string;
  serviceType: string;
  date: string;
  time: string;
  duration: number;
  address: string;
  totalPrice: number;
  status: string;
  rescueDeadline?: string | null;
  backupCleanerIds?: string[];
  postcode?: string;
  guestEmail: string;
  guestName: string;
  notes: string;
  createdAt: string;
}

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'AWAITING_CLEANER', label: 'Awaiting Cleaner' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'EN_ROUTE', label: 'En Route' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
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

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
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
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
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
              </div>
              <span
                className={`mt-2 text-center text-xs leading-tight ${
                  isCurrent
                    ? 'font-semibold text-primary'
                    : isCompleted
                      ? 'font-medium text-primary'
                      : 'text-ink-3'
                }`}
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

  const canCancel =
    !cancelled &&
    (booking.status === 'PENDING' ||
      booking.status === 'AWAITING_CLEANER' ||
      booking.status === 'CONFIRMED');

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
                  on its way back to your original payment method (3&ndash;5 business days) &mdash;
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
                <p className="font-medium text-ink">{booking.serviceType}</p>
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

        {/* Cancel Button */}
        {canCancel && (
          <div className="mb-6">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-[10px] border border-danger/40 bg-surface px-6 py-3 text-sm font-medium text-danger transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-danger/40 border-t-danger" />
                  Cancelling...
                </span>
              ) : (
                'Cancel Booking'
              )}
            </button>
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
