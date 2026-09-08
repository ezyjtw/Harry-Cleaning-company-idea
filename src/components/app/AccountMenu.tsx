'use client';

// Fix #2 (James-ruled): a reachable sign-out for the native shell. Lives in the
// web layer as InboxBell's W2 sibling — a quiet account affordance beside the
// bell on every L2 header — so it ships at web speed and stays redesignable
// without a TestFlight round trip. Sign-out routes through NextAuth to
// /en/login; the shell's existing onSessionLost path sees that navigation and
// clears the native Keychain bearer, so one tap ends the session on both sides.
// Switch-account is deliberately not built — the native login screen is the
// switch, and the Face ID lock already offers "Switch account".

import { signOut } from 'next-auth/react';
import { useState } from 'react';

import { haptic } from '@/components/app/job-cards';

export default function AccountMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    haptic('medium');
    // The shell's onNav watches for /login and fires onSessionLost, which clears
    // the native bearer and returns to the native login screen. On web preview
    // this simply lands on the login page.
    await signOut({ callbackUrl: '/en/login' });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Account"
        onClick={() => {
          haptic('light');
          setOpen(true);
        }}
        className={`shrink-0 rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page ${className || ''}`}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-ink/40"
          role="dialog"
          aria-modal="true"
          aria-label="Account"
          onClick={() => !signingOut && setOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-lg rounded-t-2xl border-t border-line bg-surface px-5 pt-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-jost text-xl font-semibold text-ink">Sign out of Rena Pro?</h2>
            <p className="mt-1.5 font-jost text-sm text-ink-2">
              You&apos;ll need your password to get back in.
            </p>
            <button
              type="button"
              onClick={doSignOut}
              disabled={signingOut}
              className="mt-5 w-full rounded-[10px] bg-primary py-3 font-jost text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={signingOut}
              className="mt-1 w-full py-3 font-jost text-sm font-medium text-ink-2 active:opacity-70 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
