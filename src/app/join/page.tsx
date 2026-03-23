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
  profilePhoto: string; // base64 data URL from uploaded image

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
  profilePhoto: '',

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

const SERVICE_TYPE_OPTIONS = ['Standard', 'Deep', 'End of Tenancy', 'AirBnB'];

const SPECIALTY_OPTIONS = [
  'Standard Cleaning',
  'Deep Cleaning',
  'Eco-Friendly',
  'Pet-Friendly',
  'Kitchen Specialist',
  'Bathroom Specialist',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'Portuguese',
  'French',
  'Polish',
  'Romanian',
  'Mandarin',
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

// Common profanity / slur word list (lowercase) for basic client-side filtering
const BLOCKED_WORDS = new Set([
  'fuck',
  'shit',
  'ass',
  'bitch',
  'damn',
  'cunt',
  'dick',
  'cock',
  'piss',
  'bastard',
  'wanker',
  'twat',
  'bollocks',
  'arsehole',
  'asshole',
  'motherfucker',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'slut',
  'whore',
]);

function containsProfanity(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/);
  return words.some((w) => BLOCKED_WORDS.has(w));
}

function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/* ------------------------------------------------------------------ */
/*  Reusable tiny components                                           */
/* ------------------------------------------------------------------ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
      className={`px-4 py-1.5 font-jost text-sm font-light transition ${
        active ? 'bg-ink text-cream' : 'bg-cream-2 text-ink-2 hover:bg-cream-2/80'
      }`}
      style={active ? undefined : { border: '0.5px solid rgba(14,14,12,0.1)' }}
    >
      {label}
    </button>
  );
}

function CustomAddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) {
      setError('Must be at least 2 characters');
      return;
    }
    if (containsProfanity(trimmed)) {
      setError('Please use appropriate language');
      return;
    }
    setError('');
    onAdd(trimmed);
    setValue('');
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 px-3 py-1.5 font-jost text-sm font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink/20"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 bg-ink px-4 py-1.5 font-jost text-sm font-light text-cream transition hover:bg-ink/90"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Earnings calculator                                                */
/* ------------------------------------------------------------------ */

function EarningsCalculator() {
  const [hours, setHours] = useState(20);
  const rate = 15;
  const weekly = hours * rate;
  const monthly = weekly * 4;
  const yearly = monthly * 12;

  return (
    <div className="mt-6">
      <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        How many hours per week would you like to work?
      </label>
      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="flex-1 h-1 appearance-none bg-ink/10 accent-gold cursor-pointer"
        />
        <span className="font-cormorant text-xl font-light text-ink w-16 text-right">
          {hours}hrs
        </span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="font-cormorant text-2xl sm:text-3xl font-light text-ink">
            £{weekly.toLocaleString()}
          </p>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            Per week
          </p>
        </div>
        <div className="text-center">
          <p className="font-cormorant text-2xl sm:text-3xl font-light text-gold">
            £{monthly.toLocaleString()}
          </p>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            Per month
          </p>
        </div>
        <div className="text-center">
          <p className="font-cormorant text-2xl sm:text-3xl font-light text-ink">
            £{yearly.toLocaleString()}
          </p>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            Per year
          </p>
        </div>
      </div>
      <p className="mt-3 font-jost text-[11px] text-ink-3 text-center">
        Based on an average of £{rate}/hr. Top-rated cleaners earn £20–£30/hr.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page (shown before application form)                       */
/* ------------------------------------------------------------------ */

function JoinLandingPage({ onApply }: { onApply: () => void }) {
  return (
    <div className="bg-cream">
      {/* Hero */}
      <section className="bg-ink py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-jost text-[11px] uppercase tracking-[0.2em] text-gold">Join Rena</p>
          <h1 className="mt-4 font-cormorant text-4xl font-light tracking-tight text-cream sm:text-5xl lg:text-6xl">
            Earn on Your Terms.
            <br />
            We Handle the Rest.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-jost font-light text-cream/80 leading-relaxed">
            Set your own hours, choose your clients, and keep 90% of what you earn. Rena takes care
            of payments, customer support, and finding you bookings — so you can focus on what you
            do best.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={onApply}
              className="bg-gold px-10 py-4 font-jost text-sm uppercase tracking-[0.15em] text-ink transition hover:bg-gold/90"
            >
              Apply Now
            </button>
            <a
              href="#why-rena"
              className="px-8 py-4 font-jost text-sm uppercase tracking-[0.15em] text-cream/80 transition hover:text-cream"
              style={{ border: '0.5px solid rgba(255,255,255,0.2)' }}
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Key benefits strip */}
      <section className="bg-cream-2 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Next Business Day Payouts',
                desc: 'Get paid fast. Earnings land in your bank account the next business day.',
              },
              {
                title: 'Keep 90% of Earnings',
                desc: 'We only take a 10% commission — the lowest in the industry.',
              },
              {
                title: 'Set Your Own Hours',
                desc: 'Work when you want, where you want. Full flexibility, always.',
              },
              {
                title: 'Everything Looked After',
                desc: 'Insurance, payments, customer support — we handle it all for you.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center sm:text-left">
                <h3 className="font-cormorant text-lg font-light text-ink">{item.title}</h3>
                <p className="mt-2 font-jost text-sm font-light text-ink-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings calculator */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-jost text-[11px] uppercase tracking-[0.2em] text-gold">
              Earning Potential
            </p>
            <h2 className="mt-3 font-cormorant text-3xl font-light text-ink sm:text-4xl">
              See How Much You Could Earn
            </h2>
            <p className="mt-4 font-jost font-light text-ink-2">
              Cleaners on Rena earn an average of £15 per hour. Use the slider to see what you could
              make.
            </p>
          </div>
          <div
            className="mt-10 bg-cream-2 p-6 sm:p-10"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <EarningsCalculator />
          </div>
        </div>
      </section>

      {/* Why Rena */}
      <section id="why-rena" className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-jost text-[11px] uppercase tracking-[0.2em] text-gold">Why Rena</p>
            <h2 className="mt-3 font-cormorant text-3xl font-light text-ink sm:text-4xl">
              Built for Cleaners, Not Against Them
            </h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: 'Next Business Day Payouts',
                desc: 'No waiting weeks for your money. Complete a job today, see the payment in your bank account the next business day via Stripe.',
              },
              {
                title: 'Everything Looked After',
                desc: 'We handle customer acquisition, booking management, payment processing, dispute resolution, and customer support. You just clean.',
              },
              {
                title: 'Self-Employed Freedom',
                desc: 'You work as a self-employed professional. Set your own rates, choose your hours, pick your clients — no boss, no rota, no office politics.',
              },
              {
                title: 'Steady Stream of Bookings',
                desc: 'Our platform connects you with customers actively looking for cleaners in your area. No more chasing leads or advertising yourself.',
              },
              {
                title: 'Fair, Transparent Commission',
                desc: 'We take just 10% — the lowest in the industry. Traditional agencies take 40-60%. Other platforms take 20-30%. You keep more with Rena.',
              },
              {
                title: 'Insurance &amp; Protection',
                desc: 'Every booking is covered. Escrow payment protection means you always get paid for work completed. We verify all customers too.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-cream p-6"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">{item.title}</h3>
                <p
                  className="mt-2 font-jost text-sm font-light text-ink-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: item.desc }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Self-employed CTA */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-cormorant text-3xl font-light text-cream sm:text-4xl">
            Ready to Be Your Own Boss?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-jost font-light text-cream/70 leading-relaxed">
            As a self-employed cleaner with Rena, you&apos;re in control. Choose when you work, how
            much you charge, and which jobs you take. We provide the platform, the customers, and
            the support — you provide the skill.
          </p>
          <div className="mt-6 font-jost text-sm text-cream/50">
            Average cleaner on Rena: £15/hr &middot; 20hrs/week &middot; £1,200/month &middot;
            Next-day payouts
          </div>
          <button
            onClick={onApply}
            className="mt-8 bg-gold px-10 py-4 font-jost text-sm uppercase tracking-[0.15em] text-ink transition hover:bg-gold/90"
          >
            Start Your Application
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function JoinAsCleanerPage() {
  const [showForm, setShowForm] = useState(false);
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
        if (parsed.form) {
          setForm((prev) => ({ ...prev, ...parsed.form }));
        }
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
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2 text-3xl text-gold">
          &#10024;
        </div>
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Application Received!</h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          Thank you for applying to join Rena, {form.name}! We&apos;ll review your application and
          get back to you within 24-48 hours at {form.email}.
        </p>
        <p className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
          In the meantime, prepare for the verification process by having your ID and any cleaning
          certifications ready.
        </p>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER — Landing page                                            */
  /* ================================================================ */

  // Don't render until localStorage has been read to avoid flash
  if (!mounted) return null;

  if (!showForm) {
    return <JoinLandingPage onApply={() => setShowForm(true)} />;
  }

  /* ================================================================ */
  /*  RENDER — Wizard                                                  */
  /* ================================================================ */

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 bg-cream">
      <h1 className="font-cormorant text-3xl font-light text-ink">Become a Cleaner</h1>
      <p className="mt-2 font-jost font-light text-ink-2">
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
                      className={`h-px flex-1 ${idx <= currentStep ? 'bg-gold' : 'bg-cream-2'}`}
                    />
                  )}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center font-cormorant text-sm font-light transition ${
                      isCompleted
                        ? 'bg-gold text-cream'
                        : isCurrent
                          ? 'bg-ink text-cream'
                          : 'bg-cream-2 text-ink-3'
                    }`}
                    style={
                      !isCompleted && !isCurrent
                        ? { border: '0.5px solid rgba(14,14,12,0.1)' }
                        : undefined
                    }
                  >
                    {isCompleted ? '\u2713' : step.icon}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-px flex-1 ${idx < currentStep ? 'bg-gold' : 'bg-cream-2'}`}
                    />
                  )}
                </div>
                <span
                  className={`hidden text-xs sm:block font-jost ${
                    isCurrent ? 'font-normal text-ink' : isCompleted ? 'text-gold' : 'text-ink-3'
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
      <div
        className="mt-8 bg-cream-2 p-6 animate-fade-in sm:p-8"
        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
      >
        {/* ===== Step 0 – Personal ===== */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <h2 className="font-cormorant text-xl font-light text-ink">Personal Information</h2>

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
                <Label>Profile Picture</Label>
                <div className="mt-2 flex items-center gap-4">
                  {/* Preview circle */}
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    {form.profilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.profilePhoto}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-6 w-6 text-ink-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-block cursor-pointer bg-ink px-4 py-2 font-jost text-sm font-light text-cream transition hover:bg-ink/90">
                      Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              set('profilePhoto', reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {form.profilePhoto && (
                      <button
                        type="button"
                        onClick={() => set('profilePhoto', '')}
                        className="ml-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 underline hover:text-ink"
                      >
                        Remove
                      </button>
                    )}
                    <p className="mt-1 font-jost text-[11px] text-ink-3">
                      JPG, PNG or WebP. Max 5 MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Step 1 – Experience ===== */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="font-cormorant text-xl font-light text-ink">Experience &amp; Skills</h2>

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
                {/* Custom specialties added by user */}
                {form.specialties
                  .filter((s) => !SPECIALTY_OPTIONS.includes(s))
                  .map((s) => (
                    <PillToggle
                      key={s}
                      label={s}
                      active={true}
                      onClick={() => toggleArray('specialties', s)}
                    />
                  ))}
              </div>
              {/* Add custom specialty */}
              <CustomAddInput
                placeholder="Add a specialty..."
                onAdd={(value) => {
                  const titled = toTitleCase(value);
                  if (!form.specialties.includes(titled)) {
                    setForm((prev) => ({ ...prev, specialties: [...prev.specialties, titled] }));
                  }
                }}
              />
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
                {/* Custom languages added by user */}
                {form.languages
                  .filter((l) => !LANGUAGE_OPTIONS.includes(l))
                  .map((l) => (
                    <PillToggle
                      key={l}
                      label={l}
                      active={true}
                      onClick={() => toggleArray('languages', l)}
                    />
                  ))}
              </div>
              {/* Add custom language */}
              <CustomAddInput
                placeholder="Add a language..."
                onAdd={(value) => {
                  const titled = toTitleCase(value);
                  if (!form.languages.includes(titled)) {
                    setForm((prev) => ({ ...prev, languages: [...prev.languages, titled] }));
                  }
                }}
              />
            </div>

            <div>
              <Label>Bio / About You</Label>
              <textarea
                rows={4}
                required
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell potential customers about yourself, your experience, and what makes your service special..."
                className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
              <FieldError message={errors.bio} />
            </div>
          </div>
        )}

        {/* ===== Step 2 – Pricing ===== */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="font-cormorant text-xl font-light text-ink">
              Pricing &amp; Availability
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Hourly Rate (your net rate)</Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-jost font-light text-ink-3">
                    &pound;
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.50"
                    required
                    value={form.hourlyRate}
                    onChange={(e) => set('hourlyRate', e.target.value)}
                    className="w-full py-2 pl-7 pr-3 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
                <p className="mt-1 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Customers will see a slightly higher rate to cover platform costs.
                </p>
                <FieldError message={errors.hourlyRate} />
              </div>

              <div>
                <Label>Same-Day Rate</Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-jost font-light text-ink-3">
                    &pound;
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.50"
                    required
                    value={form.sameDayRate}
                    onChange={(e) => set('sameDayRate', e.target.value)}
                    className="w-full py-2 pl-7 pr-3 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
            <h2 className="font-cormorant text-xl font-light text-ink">Identity Verification</h2>

            <div>
              <Label>Photo ID</Label>
              <p className="mt-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Passport or driving licence accepted.
              </p>
              <div
                className="mt-2 bg-cream p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) set('photoIdFile', file.name);
                  }}
                  className="block w-full font-jost text-sm font-light text-ink-2 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-jost file:text-sm file:font-light file:text-cream hover:file:bg-ink/90"
                />
              </div>
              {form.photoIdFile && (
                <p className="mt-1 text-xs text-green-600">Selected: {form.photoIdFile}</p>
              )}
              <FieldError message={errors.photoIdFile} />
            </div>

            <div>
              <Label>DBS Certificate (optional)</Label>
              <div
                className="mt-2 bg-cream p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) set('dbsCertFile', file.name);
                  }}
                  className="block w-full font-jost text-sm font-light text-ink-2 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-jost file:text-sm file:font-light file:text-cream hover:file:bg-ink/90"
                />
              </div>
              {form.dbsCertFile && (
                <p className="mt-1 text-xs text-green-600">Selected: {form.dbsCertFile}</p>
              )}
            </div>

            <div
              className="bg-cream px-4 py-3"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-sm font-light text-ink-2">
                Your documents are encrypted and stored securely. They are only used for identity
                verification purposes.
              </p>
            </div>
          </div>
        )}

        {/* ===== Step 4 – Payout ===== */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2 className="font-cormorant text-xl font-light text-ink">Payout Setup</h2>

            <div
              className="bg-cream px-4 py-4"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <h3 className="font-jost font-normal text-ink">We use Stripe Connect for payouts</h3>
              <p className="mt-2 font-jost text-sm font-light text-ink-2">
                Stripe is a secure, industry-leading payment platform. Once your application is
                approved, you&apos;ll be redirected to Stripe to set up your payouts. This lets you
                receive earnings directly into your bank account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStripeMessage(true)}
              className="w-full bg-ink py-3 font-jost text-base font-normal text-cream hover:bg-ink/90 transition"
            >
              Set Up Stripe
            </button>

            {stripeMessage && (
              <div
                className="bg-cream px-4 py-3 font-jost text-sm font-light text-ink-2 animate-fade-in"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                Coming soon &mdash; Stripe Connect integration is under development. You can
                continue with your application for now.
              </div>
            )}
          </div>
        )}

        {/* ===== Step 5 – Review & Submit ===== */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="font-cormorant text-xl font-light text-ink">Review &amp; Submit</h2>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  Personal
                </h3>
                <div className="mt-2 flex items-start gap-3">
                  {form.profilePhoto && (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.profilePhoto}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <dl className="space-y-1 font-jost text-sm font-light text-ink-2">
                    <div>
                      <dt className="inline font-normal text-ink">Name:</dt>{' '}
                      <dd className="inline">{form.name}</dd>
                    </div>
                    <div>
                      <dt className="inline font-normal text-ink">Email:</dt>{' '}
                      <dd className="inline">{form.email}</dd>
                    </div>
                    <div>
                      <dt className="inline font-normal text-ink">Phone:</dt>{' '}
                      <dd className="inline">{form.phone}</dd>
                    </div>
                    <div>
                      <dt className="inline font-normal text-ink">Postcode:</dt>{' '}
                      <dd className="inline">{form.postcode}</dd>
                    </div>
                    <div>
                      <dt className="inline font-normal text-ink">DOB:</dt>{' '}
                      <dd className="inline">{form.dateOfBirth}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Experience */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  Experience
                </h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Years:</dt>{' '}
                    <dd className="inline">{form.yearsExperience}</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Services:</dt>{' '}
                    <dd className="inline">{form.serviceTypes.join(', ') || 'None'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Specialties:</dt>{' '}
                    <dd className="inline">{form.specialties.join(', ') || 'None'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Languages:</dt>{' '}
                    <dd className="inline">{form.languages.join(', ') || 'None'}</dd>
                  </div>
                </dl>
              </div>

              {/* Pricing */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  Pricing
                </h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Hourly:</dt>{' '}
                    <dd className="inline">&pound;{form.hourlyRate}/hr</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Same-day:</dt>{' '}
                    <dd className="inline">&pound;{form.sameDayRate}/hr</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Hours/week:</dt>{' '}
                    <dd className="inline">{form.hoursPerWeek}</dd>
                  </div>
                </dl>
              </div>

              {/* Identity */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  Identity
                </h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Photo ID:</dt>{' '}
                    <dd className="inline">{form.photoIdFile || 'Not uploaded'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">DBS:</dt>{' '}
                    <dd className="inline">{form.dbsCertFile || 'Not uploaded'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Bio */}
            {form.bio && (
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">Bio</h3>
                <p className="mt-1 font-jost text-sm font-light text-ink-2 whitespace-pre-line">
                  {form.bio}
                </p>
              </div>
            )}

            {/* T&C checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={(e) => set('agreedToTerms', e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-ink"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
              <span className="font-jost text-sm font-light text-ink-2">
                I agree to the{' '}
                <span className="font-normal text-ink underline">Terms &amp; Conditions</span> and
                consent to a background check as part of the verification process.
              </span>
            </label>
            <FieldError message={errors.agreedToTerms} />

            {errors.submit && (
              <div
                className="bg-red-50 px-4 py-3 font-jost text-sm font-light text-red-700"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
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
              className="px-5 py-2.5 font-jost text-sm font-normal text-ink hover:bg-cream transition"
              style={{ border: '0.5px solid #0e0e0c' }}
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
              className="bg-ink px-6 py-2.5 font-jost text-sm font-normal text-cream hover:bg-ink/90 transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-ink px-6 py-2.5 font-jost text-sm font-normal text-cream hover:bg-ink/90 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
