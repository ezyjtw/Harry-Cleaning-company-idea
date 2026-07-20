'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

// H71: the page the reset email has ALWAYS linked to — it never existed, so
// every emailed reset link 404'd. One flow serves customers and cleaners
// (accounts share the auth stack); success routes to sign-in.

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="font-etna text-3xl tracking-wide text-ink">
            RENA
          </Link>
          <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
            Set a new password
          </h1>
        </div>

        {!token ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="font-jost text-sm text-ink-2">
              This link is missing its reset token. Please use the link from your email, or request
              a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-trust/30 bg-green-50 p-6 text-center">
            <p className="font-jost text-sm font-medium text-trust">
              Your password has been reset. Any devices signed in with the old password have been
              signed out.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
          >
            <label
              htmlFor="new-password"
              className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 font-jost text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label
              htmlFor="confirm-password"
              className="mt-4 block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 font-jost text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {error && <p className="mt-3 font-jost text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 w-full rounded-[10px] bg-primary px-4 py-3 font-jost text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {isLoading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
