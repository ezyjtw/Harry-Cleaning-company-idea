'use client';

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState } from 'react';

interface StripeCheckoutFormProps {
  total: number;
  bookingId: string;
  paymentIntentId: string;
  saveCard: boolean;
  onSaveCardChange: (checked: boolean) => void;
  onBack: () => void;
  isGuest?: boolean;
  guestToken?: string | null;
}

export default function StripeCheckoutForm({
  total,
  bookingId,
  paymentIntentId,
  saveCard,
  onSaveCardChange,
  onBack,
  isGuest = false,
  guestToken = null,
}: StripeCheckoutFormProps) {
  const stripeHook = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeHook || !elements) return;

    setProcessing(true);
    setError(null);

    if (saveCard && !isGuest) {
      try {
        const res = await fetch('/api/customer/payment-intent/update-save-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId, savePaymentMethod: true }),
        });
        if (!res.ok) {
          setError('Could not save your card preference. Please try again.');
          setProcessing(false);
          return;
        }
      } catch {
        setError('Network error saving card preference. Please try again.');
        setProcessing(false);
        return;
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    // Carry the guestToken through the return_url so the confirmation page can
    // read the booking via the guest-safe endpoint (a guest has no session, so
    // the account-only status endpoints would 401 → infinite spinner).
    const returnUrl =
      isGuest && guestToken
        ? `${appUrl}/en/booking-confirmation/${bookingId}?gt=${encodeURIComponent(guestToken)}`
        : `${appUrl}/en/booking-confirmation/${bookingId}`;

    const result = await stripeHook.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (result.error) {
      // A stale form (e.g. an hour-old guest tab) whose PaymentIntent was already
      // cancelled by the abandoned-booking reaper returns an unexpected-state
      // error. Show a clean "expired" message, not a raw card error.
      if (result.error.code === 'payment_intent_unexpected_state') {
        setError('This booking has expired. Please start again to book your cleaner.');
      } else {
        setError(result.error.message || 'Payment failed. Please try again.');
      }
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePayment}>
      <div className="mt-6 bg-white p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
        <PaymentElement onReady={() => setReady(true)} />
      </div>

      {!isGuest && (
        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => onSaveCardChange(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span className="font-jost text-sm font-light text-ink-2">
            Save this card for future bookings
          </span>
        </label>
      )}

      {error && (
        <div className="mt-4 bg-red-50 px-4 py-3 font-jost text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 flex items-start gap-2.5">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="#b8975a" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
            clipRule="evenodd"
          />
        </svg>
        <p className="font-jost text-xs font-light text-ink-2">
          Your payment is encrypted and processed securely by Stripe.
        </p>
      </div>

      <button
        type="submit"
        disabled={!ready || processing || !stripeHook}
        className="mt-6 w-full bg-ink py-3 font-jost text-lg font-normal text-cream hover:bg-ink/90 disabled:opacity-60"
      >
        {processing ? 'Processing...' : `Pay £${total.toFixed(2)}`}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full py-2 font-jost text-sm font-light text-ink-3 hover:text-ink transition"
      >
        &larr; Back to booking details
      </button>
    </form>
  );
}
