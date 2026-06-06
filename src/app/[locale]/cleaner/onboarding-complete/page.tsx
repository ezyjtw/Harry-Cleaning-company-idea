import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export default async function OnboardingCompletePage() {
  const user = await getCleanerSession();
  if (!user) {
    redirect('/login');
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: {
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      serviceTypes: true,
    },
  });

  const isComplete = profile?.stripeChargesEnabled && profile?.stripePayoutsEnabled;

  if (isComplete) {
    const hasEot = profile.serviceTypes.includes('end_of_tenancy');
    const hasAirbnb = profile.serviceTypes.includes('airbnb');
    const needsPricing = hasEot || hasAirbnb;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-lg w-full text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,0.08)' }}
          >
            <svg
              className="h-10 w-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">You&apos;re all set!</h1>

          <p className="mt-3 max-w-md mx-auto font-jost text-[15px] font-light text-ink-2 leading-relaxed">
            Your payment account is connected. You can now receive bookings from customers in your
            area.
          </p>

          <div
            className="mt-6 rounded-xl bg-amber-50/60 px-5 py-4 text-left"
            style={{ border: '1px solid rgba(217,119,6,0.12)' }}
          >
            <p className="font-jost text-sm font-normal text-amber-800">First payout timing</p>
            <p className="font-jost text-[13px] font-light text-amber-700 mt-1">
              Your first payout will be held for 7–14 days as part of Stripe&apos;s verification
              process. After that, you&apos;ll be paid every Wednesday.
            </p>
          </div>

          {needsPricing && (
            <div
              className="mt-4 rounded-xl bg-cream px-5 py-4 text-left"
              style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
            >
              <p className="font-jost text-sm font-normal text-ink">Next step</p>
              <p className="font-jost text-[13px] font-light text-ink-2 mt-1">
                Set up your{' '}
                {hasEot && hasAirbnb
                  ? 'End of Tenancy and Airbnb'
                  : hasEot
                    ? 'End of Tenancy'
                    : 'Airbnb'}{' '}
                pricing to appear in search results for those services.
              </p>
              <Link
                href="/cleaner/pricing"
                className="inline-block mt-2 font-jost text-[13px] font-normal text-gold underline underline-offset-2 hover:text-gold/80 transition"
              >
                Set up pricing &rarr;
              </Link>
            </div>
          )}

          <Link
            href="/cleaner"
            className="inline-block mt-8 rounded-full px-8 py-3 bg-ink text-cream font-jost text-[13px] uppercase tracking-[0.1em] hover:bg-ink/90 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-lg w-full text-center">
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: 'rgba(234,179,8,0.08)' }}
        >
          <svg
            className="h-10 w-10 text-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Almost done!</h1>

        <p className="mt-3 max-w-md mx-auto font-jost text-[15px] font-light text-ink-2 leading-relaxed">
          Stripe is verifying your details. This usually takes a few minutes. If additional
          information is needed, Stripe will contact you directly.
        </p>

        <a
          href=""
          className="inline-block mt-6 rounded-full px-8 py-3 bg-white text-ink font-jost text-[13px] uppercase tracking-[0.1em] hover:bg-cream-2 transition"
          style={{ border: '1px solid rgba(14,14,12,0.1)' }}
        >
          Refresh status
        </a>

        <div className="mt-4">
          <Link
            href="/cleaner"
            className="font-jost text-[13px] font-light text-ink-3 hover:text-ink transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
