'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import CleanerAvatar from '@/components/CleanerAvatar';
import StarRating from '@/components/StarRating';
import { useAuth } from '@/hooks/useAuth';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { formatDate } from '@/lib/utils/formatting';

/** Green circle-check pinned to the headshot — mirrors CleanerIdentity's VerifiedCheck. */
function VerifiedCheck() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white"
      aria-label="Verified"
    >
      <svg className="h-5 w-5 text-trust" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [booking, setBooking] = useState<{
    serviceType: string;
    date: string;
    startTime: string;
    duration: number;
    totalPrice: number;
    cleanerName: string;
    cleanerPhoto: string | null;
    cleanerRating: number | null;
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
          duration: Number(data.duration) || 0,
          totalPrice: Number(data.totalPrice),
          cleanerName: data.cleaner?.name || 'Your cleaner',
          cleanerPhoto: data.cleaner?.image || null,
          cleanerRating:
            typeof data.cleaner?.cleanerProfile?.rating === 'number' ||
            typeof data.cleaner?.cleanerProfile?.rating === 'string'
              ? Number(data.cleaner.cleanerProfile.rating)
              : null,
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

  const primaryBtn =
    'inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover';
  const outlineBtn =
    'inline-flex items-center justify-center rounded-[10px] border border-line bg-surface px-6 py-2.5 font-jost text-sm font-semibold text-ink-2 transition-colors hover:bg-page';

  if (status === 'SUCCEEDED') {
    const firstName = (booking?.cleanerName || 'Your cleaner').split(' ')[0];
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:py-20">
        {/* Trust eyebrow (James-signed) */}
        <p className="text-center font-jost text-[11px] font-semibold uppercase tracking-[0.18em] text-trust">
          ✓ Booking confirmed
        </p>

        {booking && (
          <>
            {/* Cleaner hero — 76px photo (real / initial fallback) + pinned check */}
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="relative">
                <CleanerAvatar photo={booking.cleanerPhoto} name={booking.cleanerName} size={76} />
                <VerifiedCheck />
              </div>

              <h1 className="mt-4 font-newsreader text-3xl font-semibold text-ink">
                {firstName} is coming
              </h1>
              <p className="mt-1.5 font-jost text-sm text-ink-2">
                {formatDate(booking.date, 'full')} at {booking.startTime}
              </p>
              {booking.cleanerRating !== null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <StarRating rating={booking.cleanerRating} />
                  <span className="font-jost text-[12px] font-light text-ink-2">
                    {booking.cleanerRating}
                  </span>
                </div>
              )}
            </div>

            {/* Summary row — page-tinted hairline; service · duration · serif total */}
            <div className="mt-8 flex items-center justify-between rounded-[10px] border border-line bg-page px-5 py-4">
              <span className="font-jost text-sm text-ink-2">
                {serviceLabelFromSlug(booking.serviceType)}
                {booking.duration > 0 && ` · ${booking.duration}h`}
              </span>
              <span className="font-newsreader text-xl font-semibold text-ink">
                £{booking.totalPrice.toFixed(2)}
              </span>
            </div>

            {(booking.backupCleanerNames.length > 0 || booking.autoAssignBackup) && (
              <p className="mt-3 text-center font-jost text-[12px] text-ink-3">
                {booking.backupCleanerNames.length > 0
                  ? `Backup: ${booking.backupCleanerNames.join(', ')}`
                  : 'Rena will assign a backup cleaner if needed.'}
              </p>
            )}
          </>
        )}

        <p className="mt-6 text-center font-jost text-sm font-light text-ink-2">
          Your payment was successful. We&apos;ll email you when {firstName} accepts.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/booking/${params.id}`} className={primaryBtn}>
            View booking
          </Link>
          {isAuthenticated ? (
            <Link href={`/messages?bookingId=${params.id}`} className={outlineBtn}>
              Message {firstName}
            </Link>
          ) : (
            // Guests can't message (account-only) — route to the existing guest
            // tracking surface instead. No new capability.
            <Link href="/booking/guest" className={outlineBtn}>
              Track your booking
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (status === 'FAILED' || status === 'CANCELED') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-3xl text-danger">
          &#10007;
        </div>
        <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
          Payment didn&apos;t go through
        </h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          {status === 'FAILED'
            ? 'Your payment could not be processed. Please try again with a different payment method.'
            : 'Your payment was canceled.'}
        </p>
        <button onClick={() => router.back()} className={`mt-8 ${primaryBtn}`}>
          Try again
        </button>
      </div>
    );
  }

  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">Booking refunded</h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          This booking has been refunded. The funds will appear in your account within 5–10 business
          days.
        </p>
        <Link href="/dashboard" className={`mt-8 ${primaryBtn}`}>
          Go to dashboard
        </Link>
      </div>
    );
  }

  // PENDING / REQUIRES_ACTION / loading
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
      <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
        Processing your payment&hellip;
      </h1>
      <p className="mt-4 font-jost font-light text-ink-2">
        {pollCount >= maxPolls
          ? "Your payment is still processing. We'll email you when it's confirmed. You can also check your dashboard."
          : "This usually takes a few seconds. Please don't close this page."}
      </p>
      {pollCount >= maxPolls && (
        <Link href="/dashboard" className={`mt-8 ${primaryBtn}`}>
          Go to dashboard
        </Link>
      )}
    </div>
  );
}
