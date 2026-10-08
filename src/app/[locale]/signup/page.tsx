'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import FieldError, { fieldErrorProps } from '@/components/ui/FieldError';
import PasswordInput from '@/components/ui/PasswordInput';
import PasswordRequirements from '@/components/ui/PasswordRequirements';
import { safeCallbackUrl } from '@/lib/auth/callback-url';
import { isCustomerShellUA, postSignedUpToShell } from '@/lib/shell';
import { displayName } from '@/lib/utils/name';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<'CLIENT' | 'CLEANER' | null>(null);
  // Customer shell (James-ruled): in-shell signup is customer-only — the role
  // chooser never shows, role pre-sets to CLIENT, and the join-as-cleaner
  // door stays website-only. Effect-only, mount-gated (RenaApp UA or the
  // ?shell=1 preview cookie, the CustomerShellChrome condition) — SSR and the
  // hydration pass render the chooser for everyone, so browser HTML is
  // byte-identical.
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (!isCustomerShellUA() && !preview) return;
    setInShell(true);
    setRole('CLIENT');
  }, []);
  const [form, setForm] = useState({
    // H45: split like the cleaner wizard — first + last, both required,
    // each displayName-cased and combined into the stored name.
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // B5: the customer shell is redeeming the handoff (shell only).
  const [handingOff, setHandingOff] = useState(false);
  // RENA-077 (James-ruled): the account exists even when the verification
  // email could not be sent; the page says so plainly and offers a retry.
  const [emailNotice, setEmailNotice] = useState<
    null | 'failed' | 'retrying' | 'sent' | 'still_failed'
  >(null);

  // A16b-3: prefill email when arriving from a guest "create an account" CTA
  // (e.g. /signup?email=...), so guest→account conversion is one step lighter and
  // the verified email matches the guest booking for auto-claim (A16b-2b).
  // RENA-020 (B2a): a sign-up started from a booking (the checkout's "Create
  // account" door) returns there, through the same sanitiser as login. Read
  // in an effect, like the email prefill, so the server render is unchanged.
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) setForm((f) => ({ ...f, email: emailParam }));
    setCallbackUrl(safeCallbackUrl(params.get('callbackUrl')));
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.includes('@')) errs.email = 'Valid email is required';
    const pwResult = validatePasswordPolicy(form.password);
    if (!pwResult.valid) errs.password = pwResult.errors[0];
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
          name: `${displayName(form.firstName)} ${displayName(form.lastName)}`.trim(),
          phone: form.phone,
          role: 'CLIENT',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ form: data.error || 'Failed to create account.' });
        return;
      }

      // B5 (RENA-082): in the customer shell the native handoff replaces the
      // website sign-in. The page posts only the single-use code; the shell
      // redeems it natively and lands on Home (whose banner carries the
      // verify-email retry). No web sign-in, no navigation to /account.
      if (
        isCustomerShellUA() &&
        typeof data.handoffCode === 'string' &&
        postSignedUpToShell({
          handoffCode: data.handoffCode,
          email: form.email.toLowerCase().trim(),
          role: 'CLIENT',
        })
      ) {
        setHandingOff(true);
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
        router.push(
          callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'
        );
      } else if (data.verificationEmailSent === false) {
        // Never imply an email went when it did not: stop here and say so.
        setEmailNotice('failed');
      } else {
        // Customers land on their role home directly (signup is customer-only).
        router.push(callbackUrl ?? '/account');
      }
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const retryVerification = async () => {
    setEmailNotice('retrying');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const body = await res.json().catch(() => null);
      setEmailNotice(res.ok && body?.sent === true ? 'sent' : 'still_failed');
    } catch {
      setEmailNotice('still_failed');
    }
  };

  // ROUND 3 LANE 2 (James-ruled, mockup A): in-shell the fields go quiet
  // hairline — rounded, border-line, surface fill, Jost. Browsers keep the
  // website dress byte-identically (inline styles included).
  const inputClass = (field: string) =>
    inShell
      ? `mt-2 w-full rounded-[10px] border bg-surface px-4 py-3.5 font-jost text-[15px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 ${
          errors[field] ? 'border-red-300 ring-1 ring-red-300' : 'border-line focus:ring-primary/40'
        }`
      : `mt-2 w-full px-4 py-3 font-jost font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 ${
          errors[field] ? 'focus:ring-red-300 ring-1 ring-red-300' : 'focus:ring-ink/20'
        }`;

  const inputStyle = (field: string) =>
    inShell
      ? undefined
      : {
          border: errors[field]
            ? '0.5px solid rgba(239,68,68,0.4)'
            : '0.5px solid rgba(14,14,12,0.1)',
        };

  if (handingOff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4 text-center">
        <h1 className="font-newsreader text-2xl font-medium text-ink">Your account is ready.</h1>
        <p className="mt-3 font-jost text-sm font-light text-ink-2">Signing you in&hellip;</p>
      </div>
    );
  }

  if (!role) {
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
            <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">Join Rena</h1>
            <p className="mt-2 font-jost text-sm font-light text-ink-2">
              How would you like to use Rena?
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-4">
            <button
              onClick={() => setRole('CLIENT')}
              className="group w-full px-6 py-5 text-left transition-colors hover:bg-cream-2"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-[15px] font-medium text-ink">I need a cleaner</p>
              <p className="mt-1 font-jost text-[13px] font-light text-ink-2">
                Book trusted, vetted cleaners for your home or office.
              </p>
            </button>
            <button
              onClick={() => router.push('/join')}
              className="group w-full px-6 py-5 text-left transition-colors hover:bg-cream-2"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-[15px] font-medium text-ink">I&apos;m a cleaner</p>
              <p className="mt-1 font-jost text-[13px] font-light text-ink-2">
                Apply to join our network and start earning on your terms.
              </p>
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="font-jost text-sm font-light text-ink-3">
              Already have an account?{' '}
              <Link href="/login" className="font-normal text-ink hover:text-gold transition">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          {/* Escape-hatch seal (the Pro forgot-password precedent): in-shell
              the wordmark keeps its face but loses its road to the marketing
              home. Browsers keep the link exactly as before. */}
          {inShell ? (
            <span className="inline-block font-etna text-[34px] font-semibold tracking-widest text-ink">
              RENA
            </span>
          ) : (
            <Link
              href="/"
              className="inline-block font-etna text-[34px] font-semibold tracking-widest text-ink"
            >
              RENA
            </Link>
          )}
          <h1
            className={
              inShell
                ? 'mt-6 font-jost text-[26px] font-bold text-ink'
                : 'mt-6 font-newsreader text-3xl font-semibold text-ink'
            }
          >
            Create Your Account
          </h1>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            Sign up to book cleaners and manage your home.
          </p>
        </div>

        {emailNotice && (
          <div
            className="mt-6 bg-cream-2 px-4 py-4 font-jost text-sm font-light text-ink"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            role="status"
            data-testid="signup-email-notice"
          >
            <p>
              {emailNotice === 'sent'
                ? 'Account created. We have sent your verification email.'
                : "Account created, but we couldn't send the verification email."}
            </p>
            {emailNotice === 'still_failed' && (
              <p className="mt-2 text-ink-2">
                We still couldn&apos;t send it. You can try again later from your account.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {emailNotice !== 'sent' && (
                <button
                  type="button"
                  onClick={retryVerification}
                  disabled={emailNotice === 'retrying'}
                  data-testid="signup-email-retry"
                  className="border px-4 py-2 font-jost text-sm text-ink disabled:opacity-50"
                  style={{ borderColor: 'rgba(14,14,12,0.2)' }}
                >
                  {emailNotice === 'retrying' ? 'Trying again…' : 'Try again'}
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(callbackUrl ?? '/account')}
                data-testid="signup-email-continue"
                className="bg-ink px-4 py-2 font-jost text-sm text-cream"
              >
                Continue to my account
              </button>
            </div>
          </div>
        )}

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
              htmlFor="firstName"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              First name
            </label>
            <input
              id="firstName"
              {...fieldErrorProps('firstName', errors.firstName)}
              type="text"
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className={inputClass('firstName')}
              style={inputStyle('firstName')}
              placeholder="Your first name"
            />
            <FieldError
              fieldId="firstName"
              message={errors.firstName}
              className="mt-1.5 font-jost text-xs font-light text-red-500"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Last name
            </label>
            <input
              id="lastName"
              {...fieldErrorProps('lastName', errors.lastName)}
              type="text"
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className={inputClass('lastName')}
              style={inputStyle('lastName')}
              placeholder="Your last name"
            />
            <FieldError
              fieldId="lastName"
              message={errors.lastName}
              className="mt-1.5 font-jost text-xs font-light text-red-500"
            />
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
              {...fieldErrorProps('signup-email', errors.email)}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass('email')}
              style={inputStyle('email')}
              placeholder="you@example.com"
            />
            <FieldError
              fieldId="signup-email"
              message={errors.email}
              className="mt-1.5 font-jost text-xs font-light text-red-500"
            />
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
              className={inputClass('phone')}
              style={inputStyle('phone')}
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
              <PasswordInput
                id="signup-password"
                {...fieldErrorProps('signup-password', errors.password)}
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                wrapperClassName="mt-2"
                className={inputClass('password').replace('mt-2 ', '')}
                style={inputStyle('password')}
                placeholder="Min. 8 characters"
              />
              <PasswordRequirements password={form.password} />
              <FieldError
                fieldId="signup-password"
                message={errors.password}
                className="mt-1.5 font-jost text-xs font-light text-red-500"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
              >
                Confirm Password
              </label>
              <PasswordInput
                id="confirm-password"
                {...fieldErrorProps('confirm-password', errors.confirmPassword)}
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                wrapperClassName="mt-2"
                className={inputClass('confirmPassword').replace('mt-2 ', '')}
                style={inputStyle('confirmPassword')}
                placeholder="Re-enter password"
              />
              <FieldError
                fieldId="confirm-password"
                message={errors.confirmPassword}
                className="mt-1.5 font-jost text-xs font-light text-red-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={
              inShell
                ? 'w-full rounded-[10px] bg-primary py-3.5 font-jost text-[13px] font-semibold uppercase tracking-[0.12em] text-white active:opacity-90 disabled:opacity-50'
                : 'w-full bg-ink py-3.5 font-jost text-[11px] uppercase tracking-[0.15em] text-cream hover:bg-ink/90 transition disabled:opacity-50'
            }
          >
            {loading ? 'Creating account...' : inShell ? 'Join Rena' : 'Create Account'}
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
            {inShell ? 'Already with us?' : 'Already have an account?'}{' '}
            <Link
              href="/login"
              className={
                inShell
                  ? 'font-semibold text-primary'
                  : 'font-normal text-ink hover:text-gold transition'
              }
            >
              {inShell ? 'Sign in' : 'Log in'}
            </Link>
          </p>
          {/* In-shell this door would reopen the (cleaner-recruiting) chooser —
              customer shell hides it; browsers keep it exactly as before. */}
          {!inShell && (
            <p className="mt-3 font-jost text-sm font-light text-ink-3">
              Not a client?{' '}
              <button
                type="button"
                onClick={() => setRole(null)}
                className="font-normal text-ink hover:text-gold transition"
              >
                Go back
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
