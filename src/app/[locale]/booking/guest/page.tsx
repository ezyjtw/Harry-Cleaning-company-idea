'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

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
  guestEmail: string;
  guestName: string;
  notes: string;
  createdAt: string;
}

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'EN_ROUTE', label: 'En Route' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === 'CANCELLED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-lg font-semibold text-red-700">Booking Cancelled</p>
        <p className="mt-1 text-sm text-red-600">This booking has been cancelled.</p>
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
                      index <= currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
                {index < STATUS_STEPS.length - 1 && (
                  <div
                    className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${
                      index < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
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
                    ? 'font-semibold text-blue-700'
                    : isCompleted
                      ? 'font-medium text-blue-600'
                      : 'text-gray-400'
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-gray-600">Loading your booking...</p>
        </div>
      </div>
    );
  }

  // Error / not found state
  if (error || !booking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-500"
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
          <h1 className="text-2xl font-bold text-gray-900">Booking Not Found</h1>
          <p className="mt-2 text-gray-600">
            {error ||
              "We couldn't find a booking with that token. It may have expired or been removed."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const canCancel = !cancelled && (booking.status === 'PENDING' || booking.status === 'CONFIRMED');

  const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Your Booking</h1>
        <p className="mt-1 text-gray-500">Booking reference: {booking.id}</p>
      </div>

      {/* Cancellation confirmation */}
      {cancelled && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-green-800">Booking Cancelled</p>
              <p className="text-sm text-green-700">
                Your booking has been successfully cancelled. If you were charged, a refund will be
                processed within 3-5 business days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Booking Status
        </h2>
        <StatusTimeline currentStatus={booking.status} />
      </div>

      {/* Booking Details */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Booking Details
        </h2>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Cleaner</p>
              <p className="font-medium text-gray-900">{booking.cleanerName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Service</p>
              <p className="font-medium text-gray-900">{booking.serviceType}</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium text-gray-900">{formattedDate}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium text-gray-900">{booking.time}</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="font-medium text-gray-900">{booking.address}</p>
          </div>

          <hr className="border-gray-100" />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-gray-900">
                {booking.duration} hour{booking.duration !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Price</p>
              <p className="text-xl font-bold text-blue-600">£{booking.totalPrice.toFixed(2)}</p>
            </div>
          </div>

          {booking.notes && (
            <>
              <hr className="border-gray-100" />
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-gray-700">{booking.notes}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cancel Button */}
      {canCancel && (
        <div className="mb-6">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full rounded-lg border border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                Cancelling...
              </span>
            ) : (
              'Cancel Booking'
            )}
          </button>
        </div>
      )}

      {/* Sign up CTA */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900">Want to manage all your bookings?</h3>
        <p className="mt-1 text-sm text-gray-600">
          Create an account to view booking history, save your favourite cleaners, and rebook with
          one click.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Create an Account
        </Link>
      </div>
    </div>
  );
}

export default function GuestBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-gray-600">Loading your booking...</p>
          </div>
        </div>
      }
    >
      <GuestBookingContent />
    </Suspense>
  );
}
