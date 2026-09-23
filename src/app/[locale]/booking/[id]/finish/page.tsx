'use client';

// Finish door (James-ruled): the on-session screen where an abandoned one-off
// checkout is completed against its ORIGINAL PaymentIntent — the finish-intent
// API hands back the intent's own client secret (never a replacement), so
// paying here is the same payment the customer started, and success runs the
// untouched normal machinery: Stripe's return_url lands on the confirmation
// page, /payment-status polling closes the loop, payment_intent.succeeded →
// processPaymentSuccess → cascade, exactly as a first-time payment.
// Stripe's own "Pay £X" is the single button (one-action law: the in-shell
// bar is the actionless order-total strip).

import { Elements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { dayPhrase, FlowBar, fmtSlotTime } from '@/components/app/customer';
import StripeCheckoutForm from '@/components/booking/StripeCheckoutForm';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { isCustomerShellUA } from '@/lib/shell';
import stripePromise, { stripeAppearance, stripeFonts } from '@/lib/stripe-client';

interface FinishIntent {
  clientSecret: string;
  stripePaymentIntentId: string;
  amount: number;
  serviceType: string;
  date: string;
  startTime: string;
}

type FinishState = 'loading' | 'ok' | 'expired' | 'already_paid' | 'processing' | 'retry';

export default function FinishPaymentPage() {
  const params = useParams();
  const bookingId = String(params?.id || '');

  const [state, setState] = useState<FinishState>('loading');
  const [intent, setIntent] = useState<FinishIntent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);

  // Same mounted shell gate as the other skins — SSR and browsers render the
  // plain page; in-shell adds the flow chrome only.
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (isCustomerShellUA() || preview) setInShell(true);
  }, []);

  const load = useCallback(() => {
    if (!bookingId) return;
    setState('loading');
    fetch(`/api/bookings/${bookingId}/finish-intent`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok && data?.clientSecret) {
          setIntent(data as FinishIntent);
          setState('ok');
          return;
        }
        setMessage(data?.error || 'Something went wrong.');
        if (data?.reason === 'already_paid') setState('already_paid');
        else if (data?.reason === 'processing') setState('processing');
        else if (data?.reason === 'retry') setState('retry');
        else setState('expired');
      })
      .catch(() => {
        setMessage("We couldn't check your payment just now. Please try again.");
        setState('retry');
      });
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-line" />
          <div className="h-48 rounded-2xl bg-line" />
        </div>
      </div>
    );
  }

  if (state !== 'ok' || !intent) {
    const headline =
      state === 'already_paid'
        ? 'This clean is already paid'
        : state === 'processing'
          ? 'Payment in progress'
          : state === 'retry'
            ? 'Something went wrong'
            : 'This booking has expired';
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page" data-testid="finish-blocked">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">{headline}</h1>
          <p className="mt-2 font-jost text-sm text-ink-3">
            {state === 'expired'
              ? 'The payment window for this booking has closed. You can book again in a couple of taps.'
              : message}
          </p>
          <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2.5">
            {state === 'expired' && (
              <Link
                href={inShell ? '/app/book' : '/'}
                data-testid="finish-book-again"
                className="rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
              >
                Book A Clean
              </Link>
            )}
            {state === 'retry' && (
              <button
                type="button"
                onClick={load}
                className="rounded-[10px] bg-primary py-3 font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
              >
                Try Again
              </button>
            )}
            {(state === 'already_paid' || state === 'processing') && (
              <Link
                href={`/booking/${bookingId}`}
                className="rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
              >
                View Booking
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-12 bg-page" data-testid="finish-page">
      {inShell && <FlowBar price={intent.amount} />}
      <h1 className="font-newsreader text-3xl font-semibold text-ink text-center">
        Finish your payment
      </h1>
      <p className="mt-2 font-jost text-sm font-light text-ink-2 text-center">
        Pick up where you left off — secure payment powered by Stripe.
      </p>

      {/* Order summary card (step-frame grammar) */}
      <div className="mt-6 bg-primary-soft p-5" style={{ border: '0.5px solid #E4E9F0' }}>
        <div className="grid gap-2 font-jost text-sm font-light">
          <div className="flex justify-between">
            <span className="text-ink-3">Service</span>
            <span className="font-normal text-ink">{serviceLabelFromSlug(intent.serviceType)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Date &amp; Time</span>
            <span className="font-normal text-ink">
              {dayPhrase(intent.date.split('T')[0])}, {fmtSlotTime(intent.startTime)}
            </span>
          </div>
          <div
            className="flex justify-between pt-2 mt-2"
            style={{ borderTop: '0.5px solid #E4E9F0' }}
          >
            <span className="font-normal text-ink">Total</span>
            <span className="font-newsreader text-2xl font-medium text-primary">
              &pound;{intent.amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: intent.clientSecret,
          appearance: stripeAppearance,
          fonts: stripeFonts,
        }}
      >
        <StripeCheckoutForm
          total={intent.amount}
          bookingId={bookingId}
          paymentIntentId={intent.stripePaymentIntentId}
          saveCard={saveCard}
          onSaveCardChange={setSaveCard}
          onBack={() => {
            window.location.href = `/booking/${bookingId}`;
          }}
        />
      </Elements>
    </div>
  );
}
