import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// Store-compliance page (James-ordered): the account deletion route for the
// Rena Cleaning Network website and both apps (RENA for customers, Rena Pro
// for cleaners). Play's data safety form links here for both apps. Copy is
// honest to the real flow: filing the deletion closes the account at once
// (sessions end, login refuses) and the erasure itself completes within 30
// days, after the standing checks on live bookings and payouts.
export const metadata: Metadata = {
  title: 'Account Deletion | Rena Cleaning Network',
  description:
    'How to delete your Rena Cleaning Network account, what is deleted, and what is retained for legal compliance.',
  alternates: { canonical: `${BASE_URL}/account-deletion` },
};

export default function AccountDeletionPage() {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <h1 className="font-newsreader text-4xl font-semibold text-ink">Account deletion</h1>
        <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
          This page explains how to delete your Rena Cleaning Network account and the data that goes
          with it. It applies to accounts used on our website, in the RENA app for customers, and in
          the Rena Pro app for cleaners.
        </p>

        <section className="mt-10 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            Delete your account in the app or on the site
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            <strong className="font-medium text-ink">Customers</strong> (website or the RENA app):
            sign in and go to <strong className="font-medium text-ink">Account</strong>, then{' '}
            <strong className="font-medium text-ink">Settings</strong>, then the{' '}
            <strong className="font-medium text-ink">Your data</strong> section, and choose{' '}
            <strong className="font-medium text-ink">Delete my account</strong>.
          </p>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            <strong className="font-medium text-ink">Cleaners</strong> (the Rena Pro app): open the{' '}
            <strong className="font-medium text-ink">account menu</strong>, then{' '}
            <strong className="font-medium text-ink">My Profile</strong>, and choose{' '}
            <strong className="font-medium text-ink">Delete my account</strong> at the bottom.
          </p>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Either way you will be asked to re-enter your password and type a confirmation, and the
            same request goes through the same process.
          </p>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Your account closes straight away: you are signed out everywhere and the account can no
            longer be used. The erasure itself is completed within 30 days. If you have a clean
            booked or money still moving to you, we will ask you to finish or cancel those first so
            nobody is left mid-job or unpaid.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">Or ask us by email</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Email{' '}
            <a
              href="mailto:support@renacleaning.co.uk"
              className="text-primary underline underline-offset-2"
            >
              support@renacleaning.co.uk
            </a>{' '}
            from the email address on your account and ask for it to be deleted. We action email
            requests within 30 days.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">What is deleted</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            All identity-bearing data is deleted: your profile and photo, contact details, saved
            addresses, messages, and saved preferences. After deletion your account cannot be
            recovered.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            What is retained, and why
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Some records must be kept for legal reasons, as set out in Section 5 of our{' '}
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              Privacy Policy
            </Link>
            :
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              <strong className="font-normal text-ink">Booking and payment records:</strong> kept
              for 6 years for HMRC and legal compliance.
            </li>
            <li>
              <strong className="font-normal text-ink">For cleaners (Rena Pro):</strong> right to
              work records are kept for the duration of your engagement plus 2 years, as UK law
              requires.
            </li>
          </ul>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            These retained records are kept only as long as the law requires and are not used for
            anything else.
          </p>
        </section>

        <p className="mt-8 font-jost font-normal text-ink-2 leading-relaxed">
          Questions about your data are covered in our{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          , or reach us at{' '}
          <a
            href="mailto:support@renacleaning.co.uk"
            className="text-primary underline underline-offset-2"
          >
            support@renacleaning.co.uk
          </a>
          .
        </p>
      </div>
    </div>
  );
}
