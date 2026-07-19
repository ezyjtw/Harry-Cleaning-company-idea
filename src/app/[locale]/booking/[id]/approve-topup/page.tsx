'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { serviceLabelFromSlug } from '@/lib/constants/services';
import stripePromise, { stripeAppearance, stripeFonts } from '@/lib/stripe-client';

interface TopupData {
  bookingId: string;
  originalPrice: number;
  newPrice: number;
  topupAmount: number;
  expiresAt: string;
  alreadyPaid: boolean;
  serviceType: string;
  date: string;
  time: string;
  /** H57: admin sessions see the panel read-only — approval is the customer's. */
  readOnly?: boolean;
}

type PageState =
  | 'loading'
  | 'loaded'
  | 'processing'
  | 'success'
  | 'declined'
  | 'payment'
  | 'error'
  | 'resolved';

export default function ApproveTopupPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params.id as string;
  // F5: guests arrive from the tokened approval email — every call (GET, POST,
  // and the Stripe return_url) carries the token so the whole flow works
  // without an account.
  const guestToken = searchParams.get('token');
  const [data, setData] = useState<TopupData | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/bookings/${bookingId}/approve-topup${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ''}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.reason === 'auth_required') {
          // H57 matrix row 1: logged-out account-holder → sign in, come
          // straight back to this panel (the H6 callbackUrl pattern).
          const back = `/booking/${bookingId}/approve-topup${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ''}`;
          router.replace(`/login?callbackUrl=${encodeURIComponent(back)}`);
        } else if (d.reason === 'resolved') {
          // H57 expiry sweep: dead provisional → calm resolved state, and the
          // booking stands at its original price unless a change was approved.
          setState('resolved');
        } else if (d.error) {
          setError(d.error);
          setState('error');
        } else if (d.alreadyPaid) {
          setState('success');
          setData(d);
        } else {
          setData(d);
          setState('loaded');
        }
      })
      .catch(() => {
        setError('Failed to load booking details');
        setState('error');
      });
  }, [bookingId, guestToken, router]);

  const handleApprove = useCallback(async () => {
    setState('processing');
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ...(guestToken ? { guestToken } : {}) }),
      });
      const result = await res.json();

      if (result.result === 'paid') {
        setState('success');
      } else if (result.result === 'requires_payment' && result.clientSecret) {
        setClientSecret(result.clientSecret);
        setState('payment');
      } else {
        setError(result.error || 'Payment failed');
        setState('loaded');
      }
    } catch {
      setError('Network error — please try again');
      setState('loaded');
    }
  }, [bookingId, guestToken]);

  const handleDecline = useCallback(async () => {
    setState('processing');
    setError(null);
    try {
      await fetch(`/api/bookings/${bookingId}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', ...(guestToken ? { guestToken } : {}) }),
      });
      setState('declined');
    } catch {
      setError('Network error — please try again');
      setState('loaded');
    }
  }, [bookingId, guestToken]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <p className="text-sm text-ink-3">Loading...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="max-w-md rounded-2xl border border-danger/30 bg-red-50 p-6 sm:p-7">
          <h2 className="font-newsreader text-2xl text-danger">Error</h2>
          <p className="mt-2 text-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center sm:p-7">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <svg
              className="h-7 w-7 text-trust"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-newsreader text-2xl text-ink">Payment Confirmed</h2>
          <p className="mt-2 text-sm text-ink-2">
            Your booking has been confirmed with the new cleaner at &pound;
            {data?.newPrice?.toFixed(2)}.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'resolved') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center sm:p-7">
          <h2 className="font-newsreader text-2xl text-ink">Nothing to review</h2>
          <p className="mt-2 text-sm text-ink-2">
            This price change has already been resolved or has expired. Unless you approved it, your
            booking stands at its original price.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'declined') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center sm:p-7">
          <h2 className="font-newsreader text-2xl text-ink">Declined</h2>
          <p className="mt-2 text-sm text-ink-2">
            You&apos;ve declined the price change. We&apos;ll continue looking for a cleaner at your
            original price.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'payment' && clientSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-7">
          <h2 className="mb-4 font-newsreader text-2xl text-ink">Complete Payment</h2>
          <p className="mb-4 text-sm text-ink-2">
            Please complete the payment of &pound;{data?.topupAmount?.toFixed(2)} to confirm your
            booking.
          </p>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: stripeAppearance, fonts: stripeFonts }}
          >
            <TopupPaymentForm
              bookingId={bookingId}
              guestToken={guestToken}
              onSuccess={() => setState('success')}
              onError={(msg) => {
                setError(msg);
                setState('loaded');
                setClientSecret(null);
              }}
            />
          </Elements>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)))
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-7">
        <h2 className="mb-4 font-newsreader text-2xl text-ink">Price Change Approval</h2>
        <p className="mb-4 text-sm text-ink-2">
          Your original cleaner was unavailable. A backup cleaner is available at a different rate.
        </p>

        <div className="mb-4 space-y-2 rounded-xl bg-primary-soft p-4">
          <div className="flex justify-between">
            <span className="text-sm text-ink-2">Original price</span>
            <span className="text-sm font-medium text-ink">
              &pound;{data.originalPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-ink-2">New price</span>
            <span className="text-sm font-medium text-ink">&pound;{data.newPrice.toFixed(2)}</span>
          </div>
          <div className="border-t border-ink/10" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Extra to pay</span>
            <span className="font-newsreader text-2xl text-ink">
              &pound;{data.topupAmount.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mb-4 text-xs text-ink-3">
          {serviceLabelFromSlug(data.serviceType)} &middot; {data.date} at {data.time}
          {hoursLeft !== null && hoursLeft > 0 && (
            <>
              {' '}
              &middot;{' '}
              <span className="font-medium text-ink-2">
                {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''} left to decide
              </span>
            </>
          )}
        </p>

        {error && (
          <div className="mb-4 rounded border border-danger/30 bg-red-50 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {data.readOnly ? (
          // H57 matrix row 5: admin view — the numbers, never the buttons.
          <div className="rounded-[10px] border border-line bg-page px-4 py-3 text-center text-sm text-ink-2">
            Admin view — only the customer can approve or decline this change.
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={state === 'processing'}
              className="flex-1 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={handleApprove}
              disabled={state === 'processing'}
              className="flex-1 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'processing' ? 'Processing...' : 'Approve & Pay'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TopupPaymentForm({
  bookingId,
  guestToken,
  onSuccess,
  onError,
}: {
  bookingId: string;
  guestToken: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripeHook = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeHook || !elements) return;

    setProcessing(true);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const result = await stripeHook.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${appUrl}/booking/${bookingId}/approve-topup${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ''}`,
      },
    });

    if (result.error) {
      onError(result.error.message || 'Payment failed');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button
        type="submit"
        disabled={processing || !stripeHook}
        className="mt-4 w-full rounded-[10px] bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
