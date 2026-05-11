'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!result || result.error) {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      if (!result.ok) {
        setError('Login failed. Please check your credentials and try again.');
        setLoading(false);
        return;
      }

      if (callbackUrl) {
        router.push(callbackUrl);
      } else {
        try {
          const sessionRes = await fetch('/api/auth/session');
          if (!sessionRes.ok) {
            router.push('/dashboard');
            return;
          }
          const session = await sessionRes.json();
          const role = session?.user?.role;
          if (role === 'CLEANER') router.push('/cleaner');
          else if (role === 'ADMIN') router.push('/admin');
          else router.push('/dashboard');
        } catch {
          router.push('/dashboard');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block font-etna text-[34px] font-semibold tracking-widest text-ink"
          >
            RENA
          </Link>
          <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Welcome Back</h1>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            Log in to manage your bookings and profile.
          </p>
        </div>

        {error && (
          <div
            className="mt-6 bg-red-50 px-4 py-3 font-jost text-sm font-light text-red-700"
            style={{ border: '0.5px solid rgba(239,68,68,0.2)' }}
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-jost text-xs font-light text-gold hover:text-gold/80 transition"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3.5 font-jost text-[11px] uppercase tracking-[0.15em] text-cream hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="font-jost text-sm font-light text-ink-3">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-normal text-ink hover:text-gold transition">
              Sign up
            </Link>
          </p>
          <p className="mt-3 font-jost text-sm font-light text-ink-3">
            Want to offer cleaning services?{' '}
            <Link href="/join" className="font-normal text-ink hover:text-gold transition">
              Apply as a cleaner
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
