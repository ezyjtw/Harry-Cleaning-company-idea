'use client';

// R1-B: the pay-now page — the ON-SESSION checkout for an occurrence whose
// off-session attempt failed. The PaymentElement here handles SCA natively;
// paying flips the occurrence to the cleaner's confirmed job via the normal
// payment-success path. Auth mirrors the pay-intent API: the booking's
// customer (session) or its guest token.

import { Elements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import StripeCheckoutForm from '@/components/booking/StripeCheckoutForm';
import { useAuth } from '@/hooks/useAuth';
import { isCustomerShellUA } from '@/lib/shell';
import stripePromise, { stripeAppearance, stripeFonts } from '@/lib/stripe-client';

// RENA-023 (B2a): every failure is a terminal state with a way out, decided by
// cause: offline, sign in needed, not found, no longer payable (the server's
// own words), no access (403 never touches the session) and a retryable
// server error (429 and 5xx).
type PayFailure =
  | { kind: 'network' }
  | { kind: 'signin' }
  | { kind: 'notfound' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; message: string }
  | { kind: 'server' };

export default function OccurrencePayNowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = String(params?.id || '');
  const token = searchParams.get('token');

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerSessionSecret, setCustomerSessionSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [failure, setFailure] = useState<PayFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saveCard, setSaveCard] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    setInShell(isCustomerShellUA());
  }, []);

  useEffect(() => {
    if (!bookingId || authLoading) return;
    let cancelled = false;
    setFailure(null);
    fetch(`/api/bookings/${bookingId}/pay-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) {
          setClientSecret(data.clientSecret);
          setCustomerSessionSecret(data.customerSessionClientSecret || null);
          setPaymentIntentId(data.stripePaymentIntentId || '');
          setAmount(typeof data.amount === 'number' ? data.amount : null);
          return;
        }
        if (res.status === 401 || (res.status === 404 && !isAuthenticated && !token)) {
          setFailure({ kind: 'signin' });
        } else if (res.status === 404) {
          setFailure({ kind: 'notfound' });
        } else if (res.status === 403) {
          setFailure({ kind: 'forbidden' });
        } else if (res.status === 409) {
          setFailure({
            kind: 'conflict',
            message: data?.error || 'This clean can no longer be paid for here.',
          });
        } else {
          setFailure({ kind: 'server' });
        }
      })
      .catch(() => {
        if (!cancelled) setFailure({ kind: 'network' });
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, token, attempt, authLoading, isAuthenticated]);

  if (failure) {
    const backHref = token
      ? `/booking/guest?token=${encodeURIComponent(token)}`
      : `/booking/${encodeURIComponent(bookingId)}`;
    const homeHref = inShell ? '/app/home' : isAuthenticated ? '/account' : '/';
    const copy: Record<PayFailure['kind'], string> = {
      network: "We couldn't reach Rena. Check your connection and try again.",
      signin: 'Sign in to pay for this clean.',
      notfound: "We couldn't find this clean on your account.",
      forbidden: "This clean isn't on the account you're signed in with.",
      conflict: failure.kind === 'conflict' ? failure.message : '',
      server: 'Something went wrong on our side. Please try again.',
    };
    const canRetry = failure.kind === 'network' || failure.kind === 'server';
    const btn = 'rounded-[10px] px-5 py-2.5 font-jost text-[13px] font-semibold transition-colors';
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <div
          className="rounded-2xl border border-line bg-surface p-8 text-center"
          data-testid="pay-failure"
          data-kind={failure.kind}
        >
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Pay for your clean</h1>
          <p className="mt-2 font-jost text-sm text-ink-3" role="alert">
            {copy[failure.kind]}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {canRetry && (
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
                data-testid="pay-retry"
              >
                Try again
              </button>
            )}
            {failure.kind === 'signin' && (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/pay/${bookingId}`)}`}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
                data-testid="pay-signin"
              >
                Sign in
              </Link>
            )}
            {failure.kind !== 'signin' && (
              <Link
                href={backHref}
                className={`${btn} border border-line text-ink hover:bg-page`}
                data-testid="pay-back"
              >
                Back to booking
              </Link>
            )}
            <Link
              href={homeHref}
              className={`${btn} border border-line text-ink hover:bg-page`}
              data-testid="pay-home"
            >
              Home
            </Link>
          </div>
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
