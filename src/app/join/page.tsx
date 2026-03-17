'use client';

import { useState, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FormData {
  // Step 0 – Personal
  name: string;
  email: string;
  phone: string;
  postcode: string;
  dateOfBirth: string;
  profilePhotoUrl: string;

  // Step 1 – Experience
  yearsExperience: string;
  serviceTypes: string[];
  specialties: string[];
  languages: string[];
  bio: string;

  // Step 2 – Pricing
  hourlyRate: string;
  sameDayRate: string;
  hoursPerWeek: string;

  // Step 3 – Identity
  photoIdFile: string;
  dbsCertFile: string;

  // Step 4 – Payout (no persistent data, just UI)

  // Step 5 – Review & Submit
  agreedToTerms: boolean;
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  postcode: '',
  dateOfBirth: '',
  profilePhotoUrl: '',

  yearsExperience: '',
  serviceTypes: [],
  specialties: [],
  languages: [],
  bio: '',

  hourlyRate: '',
  sameDayRate: '',
  hoursPerWeek: '',

  photoIdFile: '',
  dbsCertFile: '',

  agreedToTerms: false,
};

const STORAGE_KEY = 'rena-join-wizard';

/* ------------------------------------------------------------------ */
/*  Option lists                                                       */
/* ------------------------------------------------------------------ */

const SERVICE_TYPE_OPTIONS = [
  'Standard',
  'Deep',
  'End of Tenancy',
  'Move-in/out',
  'AirBnB',
  'Office',
];

const SPECIALTY_OPTIONS = [
  'Standard Cleaning',
  'Deep Cleaning',
  'Eco-Friendly',
  'Pet-Friendly',
  'Office Cleaning',
  'Move-In/Out',
  'Kitchen Specialist',
  'Bathroom Specialist',
  'Organizing',
  'Laundry & Ironing',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'Portuguese',
  'French',
  'Polish',
  'Romanian',
  'Mandarin',
  'Other',
];

const STEPS = [
  { label: 'Personal', icon: '1' },
  { label: 'Experience', icon: '2' },
  { label: 'Pricing', icon: '3' },
  { label: 'Identity', icon: '4' },
  { label: 'Payout', icon: '5' },
  { label: 'Review', icon: '6' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const UK_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|GIR\s?0AA)$/i;

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/* ------------------------------------------------------------------ */
/*  Reusable tiny components                                           */
/* ------------------------------------------------------------------ */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
    />
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function PillToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function JoinAsCleanerPage() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stripeMessage, setStripeMessage] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ---- Restore from localStorage on mount ---- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm((prev) => ({ ...prev, ...parsed.form }));
        if (typeof parsed.currentStep === 'number') setCurrentStep(parsed.currentStep);
      }
    } catch {
      /* ignore corrupt data */
    }
    setMounted(true);
  }, []);

  /* ---- Persist to localStorage on step / form change ---- */
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, currentStep }));
    } catch {
      /* quota exceeded – ignore */
    }
  }, [form, currentStep, mounted]);

  /* ---- Field updater helpers ---- */
  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const toggleArray = useCallback(
    (key: 'serviceTypes' | 'specialties' | 'languages', value: string) =>
      setForm((prev) => ({
        ...prev,
        [key]: toggleInArray(prev[key], value),
      })),
    []
  );

  /* ---- Validation per step ---- */
  function validate(step: number): boolean {
    const e: Record<string, string> = {};

    if (step === 0) {
      if (!form.name.trim()) e.name = 'Name is required';
      if (!form.email.trim()) e.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        e.email = 'Enter a valid email address';
      if (!form.phone.trim()) e.phone = 'Phone number is required';
      if (!form.postcode.trim()) e.postcode = 'Postcode is required';
      else if (!UK_POSTCODE_RE.test(form.postcode.trim()))
        e.postcode = 'Enter a valid UK postcode (e.g. SW1A 1AA)';
      if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    }

    if (step === 1) {
      if (!form.yearsExperience) e.yearsExperience = 'Required';
      if (form.serviceTypes.length === 0) e.serviceTypes = 'Select at least one service type';
      if (!form.bio.trim()) e.bio = 'Please write a short bio';
    }

    if (step === 2) {
      if (!form.hourlyRate || Number(form.hourlyRate) < 1) e.hourlyRate = 'Enter your hourly rate';
      if (!form.sameDayRate || Number(form.sameDayRate) < 1)
        e.sameDayRate = 'Enter your same-day rate';
      if (!form.hoursPerWeek || Number(form.hoursPerWeek) < 1)
        e.hoursPerWeek = 'Enter your typical hours per week';
    }

    if (step === 3) {
      if (!form.photoIdFile) e.photoIdFile = 'Photo ID is required';
    }

    // Step 4 has no required fields

    if (step === 5) {
      if (!form.agreedToTerms) e.agreedToTerms = 'You must agree to continue';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ---- Navigation ---- */
  function goNext() {
    if (!validate(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, 5));
    setErrors({});
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
    setErrors({});
  }

  /* ---- Submit ---- */
  async function handleSubmit() {
    if (!validate(5)) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/cleaners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        localStorage.removeItem(STORAGE_KEY);
        setSubmitted(true);
      } else {
        setErrors({ submit: 'Something went wrong. Please try again.' });
      }
    } catch {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  /* ================================================================ */
  /*  RENDER — Success screen                                         */
  /* ================================================================ */

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          &#10024;
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">Application Received!</h1>
        <p className="mt-4 text-gray-600">
          Thank you for applying to join Rena, {form.name}! We&apos;ll review your application and
          get back to you within 24-48 hours at {form.email}.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          In the meantime, prepare for the verification process by having your ID and any cleaning
          certifications ready.
        </p>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER — Wizard                                                  */
  /* ================================================================ */

  // Don't render until localStorage has been read to avoid flash
  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Become a Cleaner</h1>
      <p className="mt-2 text-gray-600">
        Join our network of trusted cleaning professionals. Complete the steps below to get started.
      </p>

      {/* ---------- Step indicator ---------- */}
      <nav className="mt-8" aria-label="Progress">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <li key={step.label} className="flex flex-1 flex-col items-center gap-1">
                {/* connector line */}
                <div className="flex w-full items-center">
                  {idx > 0 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        idx <= currentStep ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                      isCompleted
                        ? 'bg-brand-600 text-white'
                        : isCurrent
                          ? 'border-2 border-brand-600 bg-white text-brand-600'
                          : 'border-2 border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {isCompleted ? '\u2713' : step.icon}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        idx < currentStep ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`hidden text-xs sm:block ${
                    isCurrent
                      ? 'font-semibold text-brand-700'
                      : isCompleted
                        ? 'text-brand-600'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ---------- Step content card ---------- */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-card animate-fade-in sm:p-8">
        {/* ===== Step 0 – Personal ===== */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Full Name</Label>
                <Input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                <FieldError message={errors.name} />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
                <FieldError message={errors.phone} />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. SW1A 1AA"
                  value={form.postcode}
                  onChange={(e) => set('postcode', e.target.value)}
                />
                <FieldError message={errors.postcode} />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                />
                <FieldError message={errors.dateOfBirth} />
              </div>
              <div>
                <Label>Profile Photo URL</Label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form.profilePhotoUrl}
                  onChange={(e) => set('profilePhotoUrl', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Step 1 – Experience ===== */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-gray-900">Experience &amp; Skills</h2>

            <div>
              <Label>Years of Experience</Label>
              <Input
                type="number"
                min="0"
                required
                value={form.yearsExperience}
                onChange={(e) => set('yearsExperience', e.target.value)}
              />
              <FieldError message={errors.yearsExperience} />
            </div>

            <div>
              <Label>Service Types</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SERVICE_TYPE_OPTIONS.map((s) => (
                  <PillToggle
                    key={s}
                    label={s}
                    active={form.serviceTypes.includes(s)}
                    onClick={() => toggleArray('serviceTypes', s)}
                  />
                ))}
              </div>
              <FieldError message={errors.serviceTypes} />
            </div>

            <div>
              <Label>Specialties</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPECIALTY_OPTIONS.map((s) => (
                  <PillToggle
                    key={s}
                    label={s}
                    active={form.specialties.includes(s)}
                    onClick={() => toggleArray('specialties', s)}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Languages</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <PillToggle
                    key={l}
                    label={l}
                    active={form.languages.includes(l)}
                    onClick={() => toggleArray('languages', l)}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Bio / About You</Label>
              <textarea
                rows={4}
                required
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell potential customers about yourself, your experience, and what makes your service special..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <FieldError message={errors.bio} />
            </div>
          </div>
        )}

        {/* ===== Step 2 – Pricing ===== */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-gray-900">Pricing &amp; Availability</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Hourly Rate (your net rate)</Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                    &pound;
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.50"
                    required
                    value={form.hourlyRate}
                    onChange={(e) => set('hourlyRate', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Customers will see a slightly higher rate to cover platform costs.
                </p>
                <FieldError message={errors.hourlyRate} />
              </div>

              <div>
                <Label>Same-Day Rate</Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                    &pound;
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.50"
                    required
                    value={form.sameDayRate}
                    onChange={(e) => set('sameDayRate', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <FieldError message={errors.sameDayRate} />
              </div>

              <div>
                <Label>Typical Working Hours / Week</Label>
                <Input
                  type="number"
                  min="1"
                  max="80"
                  required
                  value={form.hoursPerWeek}
                  onChange={(e) => set('hoursPerWeek', e.target.value)}
                />
                <FieldError message={errors.hoursPerWeek} />
              </div>
            </div>
          </div>
        )}

        {/* ===== Step 3 – Identity ===== */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-gray-900">Identity Verification</h2>

            <div>
              <Label>Photo ID</Label>
              <p className="mt-0.5 text-xs text-gray-500">Passport or driving licence accepted.</p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set('photoIdFile', file.name);
                }}
                className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {form.photoIdFile && (
                <p className="mt-1 text-xs text-green-600">Selected: {form.photoIdFile}</p>
              )}
              <FieldError message={errors.photoIdFile} />
            </div>

            <div>
              <Label>DBS Certificate (optional)</Label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set('dbsCertFile', file.name);
                }}
                className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {form.dbsCertFile && (
                <p className="mt-1 text-xs text-green-600">Selected: {form.dbsCertFile}</p>
              )}
            </div>

            <div className="rounded-lg bg-brand-50 px-4 py-3">
              <p className="text-sm text-brand-700">
                Your documents are encrypted and stored securely. They are only used for identity
                verification purposes.
              </p>
            </div>
          </div>
        )}

        {/* ===== Step 4 – Payout ===== */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-gray-900">Payout Setup</h2>

            <div className="rounded-lg bg-brand-50 px-4 py-4">
              <h3 className="font-semibold text-brand-700">We use Stripe Connect for payouts</h3>
              <p className="mt-2 text-sm text-gray-700">
                Stripe is a secure, industry-leading payment platform. Once your application is
                approved, you&apos;ll be redirected to Stripe to set up your payouts. This lets you
                receive earnings directly into your bank account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStripeMessage(true)}
              className="w-full rounded-lg bg-brand-600 py-3 text-base font-semibold text-white hover:bg-brand-700 transition"
            >
              Set Up Stripe
            </button>

            {stripeMessage && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 animate-fade-in">
                Coming soon &mdash; Stripe Connect integration is under development. You can
                continue with your application for now.
              </div>
            )}
          </div>
        )}

        {/* ===== Step 5 – Review & Submit ===== */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Review &amp; Submit</h2>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-brand-700">Personal</h3>
                <dl className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>
                    <dt className="inline font-medium">Name:</dt>{' '}
                    <dd className="inline">{form.name}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Email:</dt>{' '}
                    <dd className="inline">{form.email}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Phone:</dt>{' '}
                    <dd className="inline">{form.phone}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Postcode:</dt>{' '}
                    <dd className="inline">{form.postcode}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">DOB:</dt>{' '}
                    <dd className="inline">{form.dateOfBirth}</dd>
                  </div>
                </dl>
              </div>

              {/* Experience */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-brand-700">Experience</h3>
                <dl className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>
                    <dt className="inline font-medium">Years:</dt>{' '}
                    <dd className="inline">{form.yearsExperience}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Services:</dt>{' '}
                    <dd className="inline">{form.serviceTypes.join(', ') || 'None'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Specialties:</dt>{' '}
                    <dd className="inline">{form.specialties.join(', ') || 'None'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Languages:</dt>{' '}
                    <dd className="inline">{form.languages.join(', ') || 'None'}</dd>
                  </div>
                </dl>
              </div>

              {/* Pricing */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-brand-700">Pricing</h3>
                <dl className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>
                    <dt className="inline font-medium">Hourly:</dt>{' '}
                    <dd className="inline">&pound;{form.hourlyRate}/hr</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Same-day:</dt>{' '}
                    <dd className="inline">&pound;{form.sameDayRate}/hr</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Hours/week:</dt>{' '}
                    <dd className="inline">{form.hoursPerWeek}</dd>
                  </div>
                </dl>
              </div>

              {/* Identity */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-brand-700">Identity</h3>
                <dl className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>
                    <dt className="inline font-medium">Photo ID:</dt>{' '}
                    <dd className="inline">{form.photoIdFile || 'Not uploaded'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">DBS:</dt>{' '}
                    <dd className="inline">{form.dbsCertFile || 'Not uploaded'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Bio */}
            {form.bio && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-brand-700">Bio</h3>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{form.bio}</p>
              </div>
            )}

            {/* T&C checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={(e) => set('agreedToTerms', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">
                I agree to the{' '}
                <span className="font-medium text-brand-600 underline">Terms &amp; Conditions</span>{' '}
                and consent to a background check as part of the verification process.
              </span>
            </label>
            <FieldError message={errors.agreedToTerms} />

            {errors.submit && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.submit}
              </div>
            )}
          </div>
        )}

        {/* ---------- Navigation buttons ---------- */}
        <div className="mt-8 flex items-center justify-between">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
