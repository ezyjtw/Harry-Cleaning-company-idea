'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
    } catch {
      setError('Something went wrong. Please try again.');
      return;
    } finally {
      setIsLoading(false);
    }

    setSubmitted(true);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="inline-block font-etna text-[34px] font-semibold tracking-widest text-ink"
          >
            RENA
          </Link>
        </div>

        {submitted ? (
          <div className="text-center">
            <div
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-cream-2"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <svg
                className="h-7 w-7 text-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h1 className="font-cormorant text-3xl font-light text-ink">Check Your Email</h1>
            <p className="mt-4 font-jost text-sm font-light text-ink-2 leading-relaxed">
              If an account exists for <span className="font-normal text-ink">{email}</span>,
              we&apos;ve sent password reset instructions to your inbox.
            </p>
            <p className="mt-2 font-jost text-xs font-light text-ink-3">
              Didn&apos;t receive an email? Check your spam folder or try again.
            </p>
            <div className="mt-8 space-y-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="w-full py-3 font-jost text-[11px] uppercase tracking-[0.15em] text-ink hover:bg-cream-2 transition"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                Try Another Email
              </button>
              <Link
                href="/login"
                className="block w-full bg-ink py-3 text-center font-jost text-[11px] uppercase tracking-[0.15em] text-cream hover:bg-ink/90 transition"
              >
                Back to Log In
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-center font-cormorant text-3xl font-light text-ink">
              Forgot Password?
            </h1>
            <p className="mt-3 text-center font-jost text-sm font-light text-ink-2">
              Enter your email and we&apos;ll send you instructions to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              {error && (
                <div
                  className="bg-red-50 px-4 py-3 font-jost text-sm font-light text-red-700"
                  style={{ border: '0.5px solid rgba(239,68,68,0.2)' }}
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-ink py-3.5 font-jost text-[11px] uppercase tracking-[0.15em] text-cream hover:bg-ink/90 transition disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-8 text-center font-jost text-sm font-light text-ink-3">
              Remember your password?{' '}
              <Link href="/login" className="font-normal text-ink hover:text-gold transition">
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
