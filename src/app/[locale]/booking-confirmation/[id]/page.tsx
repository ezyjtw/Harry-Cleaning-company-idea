'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback } from 'react';

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

function BookingConfirmationContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  // Guests arrive with ?gt=<guestToken> in the return_url. Their reads go through
  // the guest-safe endpoint (the account-only endpoints 401 without a session,
  // which used to leave a paid guest stuck on the spinner forever).
  const searchParams = useSearchParams();
  const guestToken = searchParams.get('gt');
  // F3: every guest link to the tracking page must CARRY the token — the page
  // hard-requires it, so an untokened link dead-ends at "No booking token".
  const guestTrackUrl = guestToken
    ? `/booking/guest?token=${encodeURIComponent(guestToken)}`
    : '/booking/guest';
  // Stripe appends redirect_status to the return_url — the client-side truth
  // about whether the payment actually went through, independent of our own
  // (possibly-failing) status fetch. We NEVER tell a customer their booking is
  // safe unless Stripe reported success here.
  const paidPerStripe = searchParams.get('redirect_status') === 'succeeded';
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
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
      const res = guestToken
        ? await fetch(`/api/bookings/guest?token=${encodeURIComponent(guestToken)}`)
        : await fetch(`/api/bookings/${params.id}`);
      if (res.ok) {
        const raw = await res.json();
        // The guest endpoint nests the booking under `booking` and uses `time`;
        // the account endpoint returns it flat with `startTime` + cleaner object.
        const data = guestToken ? raw.booking : raw;
        setBooking({
          serviceType: data.serviceType,
          date: data.date,
          startTime: guestToken ? data.time : data.startTime,
          duration: Number(data.duration) || 0,
          totalPrice: Number(data.totalPrice),
          cleanerName: guestToken
            ? data.cleanerName || 'Your cleaner'
            : data.cleaner?.name || 'Your cleaner',
          cleanerPhoto: guestToken ? null : data.cleaner?.image || null,
          cleanerRating:
            !guestToken &&
            (typeof data.cleaner?.cleanerProfile?.rating === 'number' ||
              typeof data.cleaner?.cleanerProfile?.rating === 'string')
              ? Number(data.cleaner.cleanerProfile.rating)
              : null,
          backupCleanerNames: guestToken ? [] : data.backupCleanerNames || [],
          autoAssignBackup: guestToken ? false : data.autoAssignBackup || false,
        });
      } else {
        // A read the recipient is entitled to failed (e.g. an invalid/expired
        // guest token, or a 404) — surface a terminal error, never spin forever.
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
  }, [params.id, guestToken]);

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

    const statusUrl = guestToken
      ? `/api/bookings/guest?token=${encodeURIComponent(guestToken)}`
      : `/api/bookings/${params.id}/payment-status`;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(statusUrl);
        if (res.ok) {
          const raw = await res.json();
          const paymentStatus = guestToken ? raw.booking?.paymentStatus : raw.paymentStatus;
          setStatus(paymentStatus);
          if (
            paymentStatus === 'SUCCEEDED' ||
            paymentStatus === 'FAILED' ||
            paymentStatus === 'CANCELED'
          ) {
            clearInterval(interval);
            fetchBooking();
          }
        }
      } catch {
        // transient — keep polling until maxPolls, then the terminal copy shows.
      }
      setPollCount((c) => c + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [params.id, status, pollCount, fetchBooking, guestToken]);

  // Initial status fetch
  useEffect(() => {
    const statusUrl = guestToken
      ? `/api/bookings/guest?token=${encodeURIComponent(guestToken)}`
      : `/api/bookings/${params.id}/payment-status`;
    fetch(statusUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStatus(guestToken ? data.booking?.paymentStatus : data.paymentStatus);
      })
      .catch(() => {});
  }, [params.id, guestToken]);

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
            <Link href={guestTrackUrl} className={outlineBtn}>
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
        <Link
          href={guestToken ? guestTrackUrl : '/account'}
          className={`mt-8 ${primaryBtn}`}
        >
          {guestToken ? 'View your booking' : 'Go to dashboard'}
        </Link>
      </div>
    );
  }

  // Hard load error — a customer must never be left on an endless spinner. Branch
  // strictly on Stripe's redirect_status: only claim the booking is safe when
  // Stripe itself reported the payment succeeded.
  if (loadError && status !== 'SUCCEEDED') {
    if (paidPerStripe) {
      // (a) Stripe says succeeded, but our booking fetch failed.
      return (
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-trust/10 text-3xl text-trust">
            ✓
          </div>
          <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">Payment received</h1>
          <p className="mt-4 font-jost font-light text-ink-2">
            Your booking is confirmed and we&apos;ve emailed you the details. If the email
            doesn&apos;t arrive shortly, contact us at{' '}
            <a
              href="mailto:support@renacleaning.co.uk"
              className="text-primary underline hover:text-primary-hover"
            >
              support@renacleaning.co.uk
            </a>{' '}
            with reference {params.id}.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={guestToken ? guestTrackUrl : '/account'} className={primaryBtn}>
              {guestToken ? 'Track your booking' : 'Go to dashboard'}
            </Link>
          </div>
        </div>
      );
    }
    // (b) Stripe did NOT report success — no charge, no booking.
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-3xl text-danger">
          &#10007;
        </div>
        <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
          Your payment didn&apos;t complete
        </h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          You have <strong className="font-semibold">not</strong> been charged and no booking was
          made. Please try again.
        </p>
        <button onClick={() => router.back()} className={`mt-8 ${primaryBtn}`}>
          Try again
        </button>
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
          ? "Your payment is still processing. We'll email you as soon as it's confirmed."
          : "This usually takes a few seconds. Please don't close this page."}
      </p>
      {pollCount >= maxPolls && (
        <Link href={guestToken ? guestTrackUrl : '/account'} className={`mt-8 ${primaryBtn}`}>
          {guestToken ? 'Track your booking' : 'Go to dashboard'}
        </Link>
      )}
    </div>
  );
}

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      }
    >
      <BookingConfirmationContent params={params} />
    </Suspense>
  );
}
