'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [booking, setBooking] = useState<{
    serviceType: string;
    date: string;
    startTime: string;
    totalPrice: number;
    cleanerName: string;
    backupCleanerNames: string[];
    autoAssignBackup: boolean;
  } | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 15;

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setBooking({
          serviceType: data.serviceType,
          date: data.date,
          startTime: data.startTime,
          totalPrice: Number(data.totalPrice),
          cleanerName: data.cleaner?.name || 'Your cleaner',
          backupCleanerNames: data.backupCleanerNames || [],
          autoAssignBackup: data.autoAssignBackup || false,
        });
      }
    } catch {
      // ignore
    }
  }, [params.id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    if (
      status === 'SUCCEEDED' ||
      status === 'FAILED' ||
      status === 'CANCELED' ||
      status === 'REFUNDED'
    ) {
      return;
    }

    if (pollCount >= maxPolls) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${params.id}/payment-status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.paymentStatus);
          if (
            data.paymentStatus === 'SUCCEEDED' ||
            data.paymentStatus === 'FAILED' ||
            data.paymentStatus === 'CANCELED'
          ) {
            clearInterval(interval);
            fetchBooking();
          }
        }
      } catch {
        // ignore
      }
      setPollCount((c) => c + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [params.id, status, pollCount, fetchBooking]);

  // Initial status fetch
  useEffect(() => {
    fetch(`/api/bookings/${params.id}/payment-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStatus(data.paymentStatus);
      })
      .catch(() => {});
  }, [params.id]);

  if (status === 'SUCCEEDED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2 text-3xl text-gold">
          &#10003;
        </div>
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Booking Confirmed!</h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          Your payment was successful. You&apos;ll receive a confirmation email shortly.
        </p>

        {booking && (
          <div
            className="mt-6 bg-cream-2 p-6 text-left"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div className="grid gap-2 font-jost text-sm font-light">
              <div className="flex justify-between">
                <span className="text-ink-3">Cleaner</span>
                <span className="font-normal text-ink">{booking.cleanerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Service</span>
                <span className="font-normal text-ink">{booking.serviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Date</span>
                <span className="font-normal text-ink">
                  {new Date(booking.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Time</span>
                <span className="font-normal text-ink">{booking.startTime}</span>
              </div>
              {booking.backupCleanerNames.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-3">Backup cleaners</span>
                  <span className="font-normal text-ink">
                    {booking.backupCleanerNames.join(', ')}
                  </span>
                </div>
              )}
              {booking.autoAssignBackup && (
                <div className="flex justify-between">
                  <span className="text-ink-3">Auto-assign</span>
                  <span className="font-normal text-ink">Rena will choose a backup if needed</span>
                </div>
              )}
              <div
                className="flex justify-between pt-2 mt-2"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <span className="font-normal text-ink">Total paid</span>
                <span className="font-cormorant text-lg font-light text-gold">
                  &pound;{booking.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-8 bg-ink px-6 py-3 font-jost font-normal text-cream hover:bg-ink/90"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (status === 'FAILED' || status === 'CANCELED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-red-50 text-3xl text-red-500">
          &#10007;
        </div>
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">
          Payment didn&apos;t go through
        </h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          {status === 'FAILED'
            ? 'Your payment could not be processed. Please try again with a different payment method.'
            : 'Your payment was canceled.'}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-8 bg-ink px-6 py-3 font-jost font-normal text-cream hover:bg-ink/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Booking Refunded</h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          This booking has been refunded. The funds will appear in your account within 5-10 business
          days.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-8 bg-ink px-6 py-3 font-jost font-normal text-cream hover:bg-ink/90"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // PENDING / REQUIRES_ACTION / loading
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
      <div className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
      <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">
        Processing your payment&hellip;
      </h1>
      <p className="mt-4 font-jost font-light text-ink-2">
        {pollCount >= maxPolls
          ? "Your payment is still processing. We'll email you when it's confirmed. You can also check your dashboard."
          : "This usually takes a few seconds. Please don't close this page."}
      </p>
      {pollCount >= maxPolls && (
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-8 bg-ink px-6 py-3 font-jost font-normal text-cream hover:bg-ink/90"
        >
          Go to Dashboard
        </button>
      )}
    </div>
  );
}
