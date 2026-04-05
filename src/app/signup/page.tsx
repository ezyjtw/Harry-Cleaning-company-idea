'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.includes('@')) errs.email = 'Valid email is required';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      // Register the user via API
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone,
          role: 'CLIENT',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ form: data.error || 'Failed to create account.' });
        return;
      }

      // Auto-sign in after successful registration
      const signInResult = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push('/login');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 ${
      errors[field] ? 'focus:ring-red-300 ring-1 ring-red-300' : 'focus:ring-ink/20'
    }`;

  const inputStyle = (field: string) => ({
    border: errors[field] ? '0.5px solid rgba(239,68,68,0.4)' : '0.5px solid rgba(14,14,12,0.1)',
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block font-cormorant text-[34px] font-semibold tracking-widest text-ink"
          >
            RENA
          </Link>
          <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Create Your Account</h1>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            Sign up to book cleaners and manage your home.
          </p>
        </div>

        {errors.form && (
          <div
            className="mt-6 bg-red-50 px-4 py-3 font-jost text-sm font-light text-red-700"
            style={{ border: '0.5px solid rgba(239,68,68,0.2)' }}
            role="alert"
          >
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass('name')}
              style={inputStyle('name')}
              placeholder="Your full name"
            />
            {errors.name && (
              <p className="mt-1.5 font-jost text-xs font-light text-red-500">{errors.name}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="signup-email"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass('email')}
              style={inputStyle('email')}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1.5 font-jost text-xs font-light text-red-500">{errors.email}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Phone Number
              <span className="ml-1.5 normal-case tracking-normal text-ink-3/60">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              placeholder="07xxx xxxxxx"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="signup-password"
                className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass('password')}
                style={inputStyle('password')}
                placeholder="Min. 8 characters"
              />
              {errors.password && (
                <p className="mt-1.5 font-jost text-xs font-light text-red-500">
                  {errors.password}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={inputClass('confirmPassword')}
                style={inputStyle('confirmPassword')}
                placeholder="Re-enter password"
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 font-jost text-xs font-light text-red-500">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3.5 font-jost text-[11px] uppercase tracking-[0.15em] text-cream hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center font-jost text-xs font-light text-ink-3">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-ink hover:text-gold transition">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-ink hover:text-gold transition">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="mt-8 text-center">
          <p className="font-jost text-sm font-light text-ink-3">
            Already have an account?{' '}
            <Link href="/login" className="font-normal text-ink hover:text-gold transition">
              Log in
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
