'use client';

// B3.4 (RENA-034): the web cleaner portal's deletion door — the same form and
// the same engine as the Pro room (/app/delete-account), in portal chrome.
// Reached from the bottom of the cleaner Profile page.

import { useRouter } from 'next/navigation';

import AccountDeletionForm from '@/components/account/AccountDeletionForm';

export default function CleanerDeleteAccountPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8" data-testid="cleaner-delete-account">
      <button
        type="button"
        onClick={() => router.back()}
        className="font-jost text-[12px] uppercase tracking-[0.1em] text-ink-3 transition hover:text-ink"
      >
        ← Back to profile
      </button>
      <h1 className="mt-3 mb-5 font-newsreader text-2xl font-semibold text-ink">
        Delete my account
      </h1>
      <AccountDeletionForm onCancel={() => router.push('/cleaner/profile')} />
    </div>
  );
}
