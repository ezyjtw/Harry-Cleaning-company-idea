'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import stripePromise from '@/lib/stripe-client';

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
}

type PageState = 'loading' | 'loaded' | 'processing' | 'success' | 'declined' | 'payment' | 'error';

export default function ApproveTopupPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [data, setData] = useState<TopupData | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/approve-topup`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
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
  }, [bookingId]);

  const handleApprove = useCallback(async () => {
    setState('processing');
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
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
  }, [bookingId]);

  const handleDecline = useCallback(async () => {
    setState('processing');
    setError(null);
    try {
      await fetch(`/api/bookings/${bookingId}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      setState('declined');
    } catch {
      setError('Network error — please try again');
      setState('loaded');
    }
  }, [bookingId]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-800">Error</h2>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-green-800">Payment Confirmed</h2>
          <p className="text-green-600 mt-2">
            Your booking has been confirmed with the new cleaner at &pound;
            {data?.newPrice?.toFixed(2)}.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-gray-800">Declined</h2>
          <p className="text-gray-600 mt-2">
            You&apos;ve declined the price change. We&apos;ll continue looking for a cleaner at your
            original price.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'payment' && clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-lg font-semibold mb-4">Complete Payment</h2>
          <p className="text-gray-600 mb-4">
            Please complete the payment of &pound;{data?.topupAmount?.toFixed(2)} to confirm your
            booking.
          </p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <TopupPaymentForm
              bookingId={bookingId}
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold mb-4">Price Change Approval</h2>
        <p className="text-gray-600 mb-4">
          Your original cleaner was unavailable. A backup cleaner is available at a different rate.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Original price</span>
            <span className="font-medium">&pound;{data.originalPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">New price</span>
            <span className="font-medium">&pound;{data.newPrice.toFixed(2)}</span>
          </div>
          <hr className="border-gray-200" />
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Extra to pay</span>
            <span className="font-semibold text-blue-600">
              &pound;{data.topupAmount.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {data.serviceType} &middot; {data.date} at {data.time}
          {hoursLeft !== null && hoursLeft > 0 && (
            <>
              {' '}
              &middot; {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''} left to decide
            </>
          )}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={state === 'processing'}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleApprove}
            disabled={state === 'processing'}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {state === 'processing' ? 'Processing...' : 'Approve & Pay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopupPaymentForm({
  bookingId,
  onSuccess,
  onError,
}: {
  bookingId: string;
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
        return_url: `${appUrl}/en/booking/${bookingId}/approve-topup`,
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
        className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
