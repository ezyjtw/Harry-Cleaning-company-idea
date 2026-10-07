'use client';

// Pro account deletion door (James-ordered, Apple 5.1.1(v) launch blocker):
// the dressed in-app room where a cleaner closes their account. The door the
// customer app has lived as a modal built INLINE into the client portal's
// /account/settings page, so Rena Pro never had one. This room opens the SAME
// flow and the SAME engine, byte-untouched: POST /api/gdpr/deletion (password
// re-entry + type-to-confirm, server-verified; one open request at a time;
// cleaner blockers for live jobs, active regular cleans, payouts in flight,
// open disputes, pending adjustments — all 409, named, nothing deactivated).
// On success the account is DEACTIVATED at once and the web session is signed
// out to /en/login, which the shell reads as session-lost and drops to its
// native login screen. Erasure itself runs within 30 days behind the
// admin-approved workflow. L2 by construction: no website chrome exists here.

import { useRouter } from 'next/navigation';

import AccountDeletionForm from '@/components/account/AccountDeletionForm';
import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';

export default function DeleteAccountRoom() {
  const router = useRouter();

  return (
    <div data-testid="delete-account-room">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface"
          data-testid="delete-account-back"
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Your account
          </p>
          <h1 className="font-jost text-[22px] font-semibold leading-tight text-ink">
            Delete my account
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AccountMenu />
          <InboxBell />
        </div>
      </header>

      <AccountDeletionForm onCancel={() => router.back()} />
    </div>
  );
}
