import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

// R15 Lane 2 (James-ruled defect fix): the Stripe return's in-shell landing is
// an L2 room. R14 dressed the card but left it framed by the cleaner portal
// layout's furniture — the /cleaner route's own nav and bell, which the
// chrome-strip never touches. This room lives under the bare /app layout, so
// no website furniture exists by construction, to the documents room's
// standard. Three truth states: connected, checking (details submitted),
// not finished (abandoned; failed retrieve falls here — safe doors).

export default async function StripeReturnRoom() {
  const user = await getCleanerSession();
  if (!user) {
    redirect('/login');
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: {
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeAccountId: true,
    },
  });

  const isComplete = !!profile?.stripeChargesEnabled && !!profile?.stripePayoutsEnabled;

  let detailsSubmitted = false;
  if (!isComplete && profile?.stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(profile.stripeAccountId);
      detailsSubmitted = !!account.details_submitted;
    } catch {
      detailsSubmitted = false;
    }
  }

  const state: 'connected' | 'checking' | 'unfinished' = isComplete
    ? 'connected'
    : detailsSubmitted
      ? 'checking'
      : 'unfinished';

  return (
    <div className="pt-6" data-testid="stripe-return-shell">
      <div className="rounded-2xl border border-line bg-surface px-5 py-8 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              state === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgb(var(--color-warning) / 0.1)',
          }}
        >
          <svg
            className={state === 'connected' ? 'h-8 w-8 text-success' : 'h-8 w-8 text-primary'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {state === 'connected' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M5 13l4 4L19 7"
              />
            ) : state === 'checking' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 9v3.75m0 3h.008v.008H12v-.008zm9-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </div>
        <h1
          className="mt-5 font-jost text-[22px] font-semibold text-ink"
          data-testid={state === 'unfinished' ? 'stripe-return-unfinished' : undefined}
        >
          {state === 'connected'
            ? 'Payouts connected'
            : state === 'checking'
              ? 'Stripe is checking your details'
              : 'Setup not finished'}
        </h1>
        <p className="mt-2 font-jost text-[14px] font-light text-ink-2">
          {state === 'connected'
            ? 'Your payment account is live. You are ready to be paid for every clean.'
            : state === 'checking'
              ? 'This usually takes a few minutes. If Stripe needs anything more, they will contact you directly.'
              : 'Your payout account is not connected yet. You can pick up where you left off whenever you are ready.'}
        </p>
        {state === 'unfinished' ? (
          <>
            <Link
              href="/cleaner/stripe/connect"
              className="mt-6 inline-block rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-semibold text-white"
              data-testid="stripe-return-try-again"
            >
              TRY AGAIN
            </Link>
            <div className="mt-3">
              <Link href="/app/today" className="font-jost text-[13px] text-ink-3">
                Back to the app
              </Link>
            </div>
          </>
        ) : (
          <Link
            href="/app/today"
            className="mt-6 inline-block rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-semibold text-white"
          >
            {state === 'connected' ? 'Back to the app' : 'Done for now'}
          </Link>
        )}
      </div>
    </div>
  );
}
