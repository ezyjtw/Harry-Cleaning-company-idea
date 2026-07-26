'use client';

// R1-B: the pay-now page — the ON-SESSION checkout for an occurrence whose
// off-session attempt failed. The PaymentElement here handles SCA natively;
// paying flips the occurrence to the cleaner's confirmed job via the normal
// payment-success path. Auth mirrors the pay-intent API: the booking's
// customer (session) or its guest token.

import { Elements } from '@stripe/react-stripe-js';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import StripeCheckoutForm from '@/components/booking/StripeCheckoutForm';
import stripePromise, { stripeAppearance, stripeFonts } from '@/lib/stripe-client';

export default function OccurrencePayNowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = String(params?.id || '');
  const token = searchParams.get('token');

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerSessionSecret, setCustomerSessionSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/bookings/${bookingId}/pay-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Payment could not be started.');
        setClientSecret(data.clientSecret);
        setCustomerSessionSecret(data.customerSessionClientSecret || null);
        setPaymentIntentId(data.stripePaymentIntentId || '');
        setAmount(typeof data.amount === 'number' ? data.amount : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Something went wrong.'));
  }, [bookingId, token]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Pay for your clean</h1>
          <p className="mt-2 font-jost text-sm text-ink-3">{error}</p>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-line" />
          <div className="h-48 rounded-2xl bg-line" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
      <h1 className="font-newsreader text-3xl font-semibold text-ink text-center">
        Pay for your clean
      </h1>
      <p className="mt-2 font-jost text-sm font-light text-ink-2 text-center">
        Pay now to keep your slot — your regular arrangement carries on as normal.
      </p>
      {amount !== null && (
        <div className="mt-6 bg-primary-soft p-5" style={{ border: '0.5px solid #E4E9F0' }}>
          <div className="flex justify-between font-jost text-sm">
            <span className="font-normal text-ink">Total for this clean</span>
            <span className="font-newsreader text-2xl font-medium text-primary">
              &pound;{amount.toFixed(2)}
            </span>
          </div>
        </div>
      )}
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: stripeAppearance,
          fonts: stripeFonts,
          // F7: present → PaymentElement shows the customer's saved cards.
          ...(customerSessionSecret ? { customerSessionClientSecret: customerSessionSecret } : {}),
        }}
      >
        <StripeCheckoutForm
          total={amount ?? 0}
          bookingId={bookingId}
          paymentIntentId={paymentIntentId}
          saveCard={saveCard}
          onSaveCardChange={setSaveCard}
          isGuest={!!token}
          guestToken={token}
          onBack={() => window.history.back()}
        />
      </Elements>
    </div>
  );
}
