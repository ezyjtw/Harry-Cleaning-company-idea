'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import PasswordRequirements from '@/components/ui/PasswordRequirements';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

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
  password: string;
  confirmPassword: string;
  profilePhoto: string; // base64 data URL from uploaded image

  // Step 1 – Experience
  yearsExperience: string;
  serviceTypes: string[];
  specialties: string[];
  languages: string[];
  bio: string;

  // Step 2 – Pricing (keyed by service type from step 1)
  serviceRates: Record<string, string>;
  hoursPerWeek: string;

  // Step 3 – Identity & Right to Work
  photoIdFile: string;
  rightToWorkDocType: string;
  rightToWorkDocFile: string;
  rightToWorkShareCode: string;
  rightToWorkExpiryDate: string;

  // Step 4 – DBS & Background Check
  dbsOption: 'existing' | 'want' | 'none' | '';
  dbsCertFile: string;
  dbsCertNumber: string;
  dbsCertIssueDate: string;
  selfiePhoto: string; // base64 for liveness check
  livenessComplete: boolean;

  // Step 5 – Payout (no persistent data, just UI)

  // Step 6 – Review & Submit
  agreedToTerms: boolean;
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  postcode: '',
  dateOfBirth: '',
  password: '',
  confirmPassword: '',
  profilePhoto: '',

  yearsExperience: '',
  serviceTypes: [],
  specialties: [],
  languages: [],
  bio: '',

  serviceRates: {},
  hoursPerWeek: '',

  photoIdFile: '',
  rightToWorkDocType: '',
  rightToWorkDocFile: '',
  rightToWorkShareCode: '',
  rightToWorkExpiryDate: '',

  dbsOption: '',
  dbsCertFile: '',
  dbsCertNumber: '',
  dbsCertIssueDate: '',
  selfiePhoto: '',
  livenessComplete: false,

  agreedToTerms: false,
};

const STORAGE_KEY = 'rena-join-wizard';

/* ------------------------------------------------------------------ */
/*  Option lists                                                       */
/* ------------------------------------------------------------------ */

const SERVICE_TYPE_OPTIONS = ['Standard', 'Deep', 'Same Day', 'End of Tenancy', 'AirBnB'];

const SERVICE_RATE_INFO: Record<
  string,
  { label: string; description: string; range: string; model: string; hourly: boolean }
> = {
  Standard: {
    label: 'Regular Cleaning',
    description: 'Weekly or fortnightly recurring cleans',
    range: '£14 – £35/hr',
    model: '2–4 hours',
    hourly: true,
  },
  Deep: {
    label: 'Deep Cleaning',
    description: 'Intensive top-to-bottom cleaning',
    range: '£20 – £51/hr',
    model: '3–8 hours',
    hourly: true,
  },
  'End of Tenancy': {
    label: 'End of Tenancy',
    description: 'Fixed price by property size',
    range: '£150 – £580',
    model: 'Fixed by property size',
    hourly: false,
  },
  'Same Day': {
    label: 'Same-Day Cleaning',
    description: 'Urgent booking for same-day service',
    range: '£18 – £46/hr',
    model: '2–4 hours',
    hourly: true,
  },
  AirBnB: {
    label: 'Airbnb / Short-Let',
    description: 'Fixed price turnaround between guests',
    range: '£45 – £165',
    model: 'Fixed by property size',
    hourly: false,
  },
};

const SPECIALTY_OPTIONS = [
  'Standard Cleaning',
  'Deep Cleaning',
  'Eco-Friendly',
  'Pet-Friendly',
  'Kitchen Specialist',
  'Bathroom Specialist',
  'Kosher Kitchen',
  'Halal-Conscious Cleaning',
  'Prayer Room Care',
  'Post-Construction',
  'Elderly/Assisted Living',
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
  { label: 'DBS Check', icon: '5' },
  { label: 'Payout', icon: '6' },
  { label: 'Review', icon: '7' },
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
  return <label className="block font-jost text-sm font-light text-ink-2">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1.5 w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
      style={{ border: '1px solid rgba(14,14,12,0.1)' }}
    />
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 font-jost text-[12px] text-red-500">{message}</p>;
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
      className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
        active
          ? 'bg-ink text-cream shadow-sm'
          : 'bg-white text-ink-2 hover:bg-cream-2 hover:text-ink'
      }`}
      style={active ? undefined : { border: '1px solid rgba(14,14,12,0.1)' }}
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
    <div className="mt-3">
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
          className="flex-1 rounded-lg bg-white px-4 py-2 font-jost text-[13px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
          style={{ border: '1px solid rgba(14,14,12,0.1)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 rounded-lg bg-ink px-5 py-2 font-jost text-[13px] font-light text-cream transition hover:bg-ink/90"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1.5 font-jost text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Earnings calculator                                                */
/* ------------------------------------------------------------------ */

// 2025/26 UK self-employed tax/NI estimate
function estimateTakeHome(gross: number): {
  incomeTax: number;
  nationalInsurance: number;
  takeHome: number;
} {
  const PERSONAL_ALLOWANCE = 12570;
  const BASIC_RATE_LIMIT = 50270;
  const CLASS2_THRESHOLD = 6725;
  const CLASS2_WEEKLY = 3.45;
  const CLASS4_LOWER = 12570;
  const CLASS4_UPPER = 50270;

  let incomeTax = 0;
  const taxable = Math.max(0, gross - PERSONAL_ALLOWANCE);
  const basicBand = Math.min(taxable, BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE);
  const higherBand = Math.max(0, taxable - basicBand);
  incomeTax = basicBand * 0.2 + higherBand * 0.4;

  let nationalInsurance = 0;
  if (gross > CLASS2_THRESHOLD) {
    nationalInsurance += CLASS2_WEEKLY * 52;
  }
  const class4Lower = Math.min(Math.max(0, gross - CLASS4_LOWER), CLASS4_UPPER - CLASS4_LOWER);
  const class4Upper = Math.max(0, gross - CLASS4_UPPER);
  nationalInsurance += class4Lower * 0.06 + class4Upper * 0.02;

  return {
    incomeTax: Math.round(incomeTax),
    nationalInsurance: Math.round(nationalInsurance),
    takeHome: Math.round(gross - incomeTax - nationalInsurance),
  };
}

function EarningsCalculator() {
  const [hours, setHours] = useState(20);
  const [showTakeHome, setShowTakeHome] = useState(false);
  const rate = 15;
  const weekly = hours * rate;
  const monthly = Math.round((weekly * 52) / 12);
  const yearly = weekly * 52;
  const tax = estimateTakeHome(yearly);

  return (
    <div className="mt-6">
      <label className="block font-jost text-sm font-light text-ink-2">
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
          <p className="font-jost text-xs font-light text-ink-3 mt-1">Per week</p>
        </div>
        <div className="text-center">
          <p className="font-cormorant text-2xl sm:text-3xl font-light text-gold">
            £{monthly.toLocaleString()}
          </p>
          <p className="font-jost text-xs font-light text-ink-3 mt-1">Per month</p>
        </div>
        <div className="text-center">
          <p className="font-cormorant text-2xl sm:text-3xl font-light text-ink">
            £{yearly.toLocaleString()}
          </p>
          <p className="font-jost text-xs font-light text-ink-3 mt-1">Per year (gross)</p>
        </div>
      </div>

      {/* Take-home toggle */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => setShowTakeHome(!showTakeHome)}
          className="inline-flex items-center gap-1.5 font-jost text-[12px] text-gold hover:text-gold/80 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M7 4v4M5.5 6.5h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {showTakeHome ? 'Hide' : 'Show'} estimated take-home
        </button>
      </div>

      {showTakeHome && (
        <div
          className="mt-4 rounded-xl bg-cream-2/50 p-4"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-cormorant text-lg font-light text-ink">
                £{tax.incomeTax.toLocaleString()}
              </p>
              <p className="font-jost text-[11px] font-light text-ink-3 mt-0.5">Income tax</p>
            </div>
            <div>
              <p className="font-cormorant text-lg font-light text-ink">
                £{tax.nationalInsurance.toLocaleString()}
              </p>
              <p className="font-jost text-[11px] font-light text-ink-3 mt-0.5">
                National Insurance
              </p>
            </div>
            <div>
              <p className="font-cormorant text-lg font-light text-gold">
                £{tax.takeHome.toLocaleString()}
              </p>
              <p className="font-jost text-[11px] font-light text-ink-3 mt-0.5">Est. take-home</p>
            </div>
          </div>
          <p className="mt-3 font-jost text-[10px] text-ink-3/70 text-center">
            Estimate based on 2025/26 UK self-employed tax rates. Does not account for expenses,
            student loans, or other deductions. This is for illustration only and is not tax advice.
          </p>
        </div>
      )}

      <p className="mt-3 font-jost text-[11px] text-ink-3 text-center">
        Based on an average of £{rate}/hr. Top-rated cleaners earn £20–£30/hr.
      </p>
      <p className="mt-1.5 font-jost text-[10px] text-ink-3/70 text-center">
        Earnings shown are gross. As a self-employed cleaner you are responsible for your own tax
        and National Insurance.
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
              className="rounded-full bg-gold px-10 py-4 font-jost text-sm uppercase tracking-[0.15em] text-ink shadow-sm transition hover:bg-gold/90"
            >
              Apply Now
            </button>
            <a
              href="#why-rena"
              className="rounded-full px-8 py-4 font-jost text-sm uppercase tracking-[0.15em] text-cream/80 transition hover:text-cream"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
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
                desc: 'We only take a 10% commission — one of the lowest in the industry.',
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
            className="mt-10 rounded-2xl bg-white p-6 shadow-sm sm:p-10"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
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
                desc: 'No waiting weeks for your money. Complete a job today, see the payment in your bank account the next business day via Ryft.',
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
                desc: 'We take just 10% — one of the lowest in the industry. Traditional agencies take 40-60%. Other platforms take 20-30%. You keep more with Rena.',
              },
              {
                title: 'You\u2019re Covered',
                desc: 'Every booking is covered. Escrow payment protection means you always get paid for work completed. We verify all customers too.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl bg-white p-6 shadow-sm"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
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
            className="mt-8 rounded-full bg-gold px-10 py-4 font-jost text-sm uppercase tracking-[0.15em] text-ink shadow-sm transition hover:bg-gold/90"
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
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ryftMessage, setRyftMessage] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { trackStep, trackFormError, trackConversion } = useAnalytics('cleaner_signup');

  // Track initial page view
  useEffect(() => {
    trackStep(1, 'join_page_view');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Restore from localStorage on mount ---- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) {
          const restored = { ...parsed.form };
          const fileFields = [
            'photoIdFile',
            'rightToWorkDocFile',
            'dbsCertFile',
            'selfiePhoto',
            'profilePhoto',
          ];
          for (const f of fileFields) {
            if (restored[f] === '[uploaded]') restored[f] = '';
          }
          setForm((prev) => ({ ...prev, ...restored }));
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
      const {
        photoIdFile,
        rightToWorkDocFile,
        dbsCertFile,
        selfiePhoto,
        profilePhoto,
        password,
        confirmPassword,
        ...rest
      } = form;
      void password;
      void confirmPassword;
      const persistable = {
        ...rest,
        photoIdFile: photoIdFile ? '[uploaded]' : '',
        rightToWorkDocFile: rightToWorkDocFile ? '[uploaded]' : '',
        dbsCertFile: dbsCertFile ? '[uploaded]' : '',
        selfiePhoto: selfiePhoto ? '[uploaded]' : '',
        profilePhoto: profilePhoto ? '[uploaded]' : '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form: persistable, currentStep }));
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
      if (!form.dateOfBirth) {
        e.dateOfBirth = 'Date of birth is required';
      } else {
        const dob = new Date(form.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 18) e.dateOfBirth = 'You must be at least 18 years old to register';
      }
      if (!form.password) e.password = 'Password is required';
      else {
        const pwResult = validatePasswordPolicy(form.password);
        if (!pwResult.valid) e.password = pwResult.errors[0];
        else if (form.password !== form.confirmPassword)
          e.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 1) {
      if (!form.yearsExperience) e.yearsExperience = 'Required';
      else if (Number(form.yearsExperience) > 50) e.yearsExperience = 'Maximum 50 years';
      else if (Number(form.yearsExperience) < 0) e.yearsExperience = 'Must be 0 or more';
      if (form.serviceTypes.length === 0) e.serviceTypes = 'Select at least one service type';
      if (form.languages.length === 0) e.languages = 'Select at least one language';
      if (!form.bio.trim()) e.bio = 'Please write a short bio';
    }

    if (step === 2) {
      for (const svc of form.serviceTypes) {
        const info = SERVICE_RATE_INFO[svc];
        if (info?.hourly) {
          const rate = Number(form.serviceRates[svc]);
          if (!form.serviceRates[svc] || rate < 1) {
            e[`rate_${svc}`] = `Enter your ${info.label.toLowerCase()} rate`;
          } else if (rate < 14) {
            e[`rate_${svc}`] = 'Minimum rate is £14/hr';
          } else if (rate > 100) {
            e[`rate_${svc}`] = 'Maximum rate is £100/hr';
          }
        }
      }
      if (!form.hoursPerWeek || Number(form.hoursPerWeek) < 1)
        e.hoursPerWeek = 'Enter your typical hours per week';
    }

    if (step === 3) {
      if (!form.photoIdFile) e.photoIdFile = 'Photo ID is required';
      if (!form.rightToWorkDocType) e.rightToWorkDocType = 'Please select your document type';
      if (!form.rightToWorkDocFile) e.rightToWorkDocFile = 'Right to work document is required';
      if (form.rightToWorkDocType === 'share_code' && !form.rightToWorkShareCode.trim()) {
        e.rightToWorkShareCode = 'Please enter your gov.uk share code';
      }
    }

    if (step === 4) {
      if (!form.dbsOption) e.dbsOption = 'Please select a DBS option';
      if (form.dbsOption === 'existing') {
        if (!form.dbsCertNumber.trim()) e.dbsCertNumber = 'DBS certificate number is required';
        else if (!/^\d{12}$/.test(form.dbsCertNumber.trim()))
          e.dbsCertNumber = 'Must be a 12-digit number';
        if (!form.dbsCertIssueDate) e.dbsCertIssueDate = 'Issue date is required';
        else {
          const issued = new Date(form.dbsCertIssueDate);
          const threeYearsAgo = new Date();
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          if (issued < threeYearsAgo)
            e.dbsCertIssueDate = 'DBS certificate must be less than 3 years old';
        }
        if (!form.dbsCertFile) e.dbsCertFile = 'Please upload your DBS certificate';
      }
      if (!form.selfiePhoto) e.selfiePhoto = 'Selfie is required for identity verification';
    }

    // Step 5 has no required fields (payout)

    if (step === 6) {
      if (!form.agreedToTerms) e.agreedToTerms = 'You must agree to continue';
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Track validation errors for funnel analysis
      Object.entries(e).forEach(([field, message]) => {
        trackFormError(field, message, STEPS[step]?.label);
      });
    }
    return Object.keys(e).length === 0;
  }

  /* ---- Navigation ---- */
  function goNext() {
    if (!validate(currentStep)) return;
    const nextStep = Math.min(currentStep + 1, 6);
    // Map wizard step (0-6) to funnel step (2-8: personal, experience, pricing, identity, dbs, payout, review)
    trackStep(nextStep + 2, STEPS[nextStep]?.label?.toLowerCase() ?? `step_${nextStep}`);
    setCurrentStep(nextStep);
    setErrors({});
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
    setErrors({});
  }

  /* ---- Submit ---- */
  async function handleSubmit() {
    if (!validate(6)) return;
    setSubmitting(true);
    try {
      // Strip large base64 file fields from the main request to stay under body limits.
      // Documents are uploaded separately after profile creation.
      const {
        photoIdFile,
        rightToWorkDocFile,
        dbsCertFile,
        selfiePhoto,
        profilePhoto,
        confirmPassword: _,
        ...formData
      } = form;

      const response = await fetch('/api/cleaners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          hasPhotoId: !!photoIdFile,
          hasRtwDoc: !!rightToWorkDocFile,
          hasDbsCert: !!dbsCertFile,
          hasSelfie: !!selfiePhoto,
          selfiePhoto: !!selfiePhoto,
          profilePhoto: profilePhoto || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        let message = 'Something went wrong. Please try again.';
        if (response.status === 409) {
          message =
            data?.error || 'An account with this email already exists. Please log in instead.';
        } else if (response.status === 400) {
          message = data?.error || 'Please check your details and try again.';
        } else if (data?.error && typeof data.error === 'string' && data.error.length < 120) {
          message = data.error;
        }
        setErrors({ submit: message });
        return;
      }

      const result = await response.json();
      const cleanerId = result.cleaner?.id;

      // Upload documents after profile creation
      if (cleanerId) {
        const docs: { data: string; type: string; label: string }[] = [];
        if (photoIdFile && photoIdFile.startsWith('data:'))
          docs.push({ data: photoIdFile, type: 'photo_id', label: 'Photo ID' });
        if (rightToWorkDocFile && rightToWorkDocFile.startsWith('data:'))
          docs.push({ data: rightToWorkDocFile, type: 'right_to_work', label: 'Right to Work' });
        if (dbsCertFile && dbsCertFile.startsWith('data:'))
          docs.push({ data: dbsCertFile, type: 'dbs_certificate', label: 'DBS Certificate' });

        const failedUploads: string[] = [];
        for (const doc of docs) {
          try {
            const uploadRes = await fetch('/api/cleaners/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cleanerId,
                documentType: doc.type,
                fileData: doc.data,
              }),
            });
            if (!uploadRes.ok) {
              failedUploads.push(doc.label);
            }
          } catch {
            failedUploads.push(doc.label);
          }
        }

        if (failedUploads.length > 0) {
          setErrors({
            submit: `Your application was submitted, but the following documents failed to upload: ${failedUploads.join(', ')}. Please re-upload them from your cleaner dashboard after logging in.`,
          });
        }
      }

      localStorage.removeItem(STORAGE_KEY);
      trackConversion({ email: form.email });

      // Auto-sign in and redirect to cleaner dashboard
      if (form.password) {
        const signInResult = await signIn('credentials', {
          email: form.email,
          password: form.password,
          redirect: false,
        });
        if (!signInResult?.error) {
          router.push('/cleaner');
          return;
        }
      }

      setSubmitted(true);
    } catch {
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  /* ================================================================ */
  /*  RENDER — Success screen (fallback if auto-login fails)          */
  /* ================================================================ */

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center bg-cream min-h-screen flex flex-col items-center justify-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-3xl text-gold">
          &#10024;
        </div>
        <h1 className="mt-8 font-cormorant text-3xl font-light text-ink sm:text-4xl">
          Application Received!
        </h1>
        <p className="mt-4 max-w-md font-jost text-sm font-light text-ink-2 leading-relaxed">
          Thank you for applying to join Rena, {form.name}! Your account has been created and is
          being reviewed.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-gold px-10 py-3 font-jost text-[13px] font-light text-ink shadow-sm transition hover:bg-gold/90"
        >
          Log in to your dashboard
        </Link>
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
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 bg-cream min-h-screen">
      <div className="text-center">
        <p className="font-jost text-[11px] uppercase tracking-[0.2em] text-gold">Application</p>
        <h1 className="mt-2 font-cormorant text-3xl font-light text-ink sm:text-4xl">
          Become a Cleaner
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-jost text-sm font-light text-ink-2">
          Complete the steps below to join our network of trusted cleaning professionals.
        </p>
      </div>

      {/* ---------- Step indicator ---------- */}
      <nav className="mt-10" aria-label="Progress">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <li key={step.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  {idx > 0 && (
                    <div
                      className={`h-[1.5px] flex-1 transition-colors duration-300 ${idx <= currentStep ? 'bg-gold' : 'bg-ink/[0.06]'}`}
                    />
                  )}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-cormorant text-sm font-light transition-all duration-300 ${
                      isCompleted
                        ? 'bg-gold text-cream shadow-sm'
                        : isCurrent
                          ? 'bg-ink text-cream shadow-md'
                          : 'bg-white text-ink-3'
                    }`}
                    style={
                      !isCompleted && !isCurrent
                        ? { border: '1px solid rgba(14,14,12,0.08)' }
                        : undefined
                    }
                  >
                    {isCompleted ? '\u2713' : step.icon}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-[1.5px] flex-1 transition-colors duration-300 ${idx < currentStep ? 'bg-gold' : 'bg-ink/[0.06]'}`}
                    />
                  )}
                </div>
                <span
                  className={`hidden text-[11px] sm:block font-jost tracking-wide ${
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
        className="mt-10 rounded-2xl bg-white p-6 shadow-sm animate-fade-in sm:p-8"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        {/* ===== Step 0 – Personal ===== */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Personal Information
            </h2>

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
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <select
                    value={form.dateOfBirth ? new Date(form.dateOfBirth).getDate().toString() : ''}
                    onChange={(e) => {
                      const parts = form.dateOfBirth ? form.dateOfBirth.split('-') : ['', '', ''];
                      const day = e.target.value.padStart(2, '0');
                      if (parts[0] && parts[1]) set('dateOfBirth', `${parts[0]}-${parts[1]}-${day}`);
                      else set('dateOfBirth', `0000-01-${day}`);
                    }}
                    className="w-full rounded-lg bg-white px-3 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition appearance-none"
                    style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                  >
                    <option value="" disabled>Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={form.dateOfBirth ? (new Date(form.dateOfBirth).getMonth() + 1).toString() : ''}
                    onChange={(e) => {
                      const parts = form.dateOfBirth ? form.dateOfBirth.split('-') : ['', '', ''];
                      const month = e.target.value.padStart(2, '0');
                      const day = parts[2] || '01';
                      const year = parts[0] || '0000';
                      set('dateOfBirth', `${year}-${month}-${day}`);
                    }}
                    className="w-full rounded-lg bg-white px-3 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition appearance-none"
                    style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                  >
                    <option value="" disabled>Month</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={form.dateOfBirth && !form.dateOfBirth.startsWith('0000') ? new Date(form.dateOfBirth).getFullYear().toString() : ''}
                    onChange={(e) => {
                      const parts = form.dateOfBirth ? form.dateOfBirth.split('-') : ['', '', ''];
                      const month = parts[1] || '01';
                      const day = parts[2] || '01';
                      set('dateOfBirth', `${e.target.value}-${month}-${day}`);
                    }}
                    className="w-full rounded-lg bg-white px-3 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition appearance-none"
                    style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                  >
                    <option value="" disabled>Year</option>
                    {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 18 - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <FieldError message={errors.dateOfBirth} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                  />
                  <PasswordRequirements password={form.password} />
                  <FieldError message={errors.password} />
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                  />
                  <FieldError message={errors.confirmPassword} />
                </div>
              </div>
              <div>
                <Label>Profile Picture</Label>
                <div className="mt-3 flex items-start gap-5">
                  {/* Preview circle */}
                  <div
                    className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream-2"
                    style={{ border: '2px solid rgba(14,14,12,0.08)' }}
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
                        className="h-10 w-10 text-ink-3/40"
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
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-ink px-4 py-2 font-jost text-[13px] font-light text-cream transition hover:bg-ink/90">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        Upload
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
                      <label
                        className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg px-4 py-2 font-jost text-[13px] font-light text-ink transition hover:bg-cream-2"
                        style={{ border: '1px solid rgba(14,14,12,0.12)' }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                          />
                        </svg>
                        Take Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
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
                          className="font-jost text-xs font-light text-ink-3 underline hover:text-ink"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-2 font-jost text-[11px] text-ink-3">
                      JPG, PNG or WebP. Max 5 MB. A clear headshot works best.
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
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Experience &amp; Skills
            </h2>

            <div>
              <Label>Years of Experience</Label>
              <Input
                type="number"
                min="0"
                max="50"
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
              <FieldError message={errors.languages} />
            </div>

            <div>
              <Label>Bio / About You</Label>
              <textarea
                rows={4}
                required
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell potential customers about yourself, your experience, and what makes your service special..."
                className="mt-1.5 w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition resize-none"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
              <FieldError message={errors.bio} />
            </div>
          </div>
        )}

        {/* ===== Step 2 – Pricing ===== */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Pricing &amp; Availability
            </h2>

            {/* Per-service rate inputs for hourly services */}
            <div className="space-y-4">
              {form.serviceTypes
                .filter((svc) => SERVICE_RATE_INFO[svc]?.hourly)
                .map((svc) => {
                  const info = SERVICE_RATE_INFO[svc];
                  return (
                    <div key={svc}>
                      <Label>{info.label} Rate</Label>
                      <div className="relative mt-1.5">
                        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-jost text-[14px] font-light text-ink-3">
                          &pound;
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="0.50"
                          required
                          value={form.serviceRates[svc] || ''}
                          onChange={(e) =>
                            set('serviceRates', {
                              ...form.serviceRates,
                              [svc]: e.target.value,
                            })
                          }
                          className="w-full rounded-lg bg-white py-2.5 pl-8 pr-4 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                          style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                        />
                      </div>
                      <p className="mt-1.5 font-jost text-[11px] text-ink-3">
                        Typical range: {info.range}
                      </p>
                      <FieldError message={errors[`rate_${svc}`]} />
                    </div>
                  );
                })}
            </div>

            {/* Note about fixed-price services */}
            {form.serviceTypes.some((svc) => !SERVICE_RATE_INFO[svc]?.hourly) && (
              <p className="font-jost text-[12px] text-ink-3">
                {form.serviceTypes
                  .filter((svc) => !SERVICE_RATE_INFO[svc]?.hourly)
                  .map((svc) => SERVICE_RATE_INFO[svc]?.label || svc)
                  .join(' and ')}{' '}
                pricing is set in your profile once your account is approved.
              </p>
            )}

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
        )}

        {/* ===== Step 3 – Identity ===== */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Identity Verification
            </h2>

            <div>
              <Label>Photo ID</Label>
              <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
                Passport or driving licence accepted.
              </p>
              <div
                className="mt-2 rounded-lg bg-cream-2/50 p-4"
                style={{ border: '1px dashed rgba(14,14,12,0.12)' }}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        set('photoIdFile', reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="block w-full font-jost text-[13px] font-light text-ink-2 file:mr-4 file:rounded-lg file:border-0 file:bg-ink file:px-5 file:py-2 file:font-jost file:text-[13px] file:font-light file:text-cream file:cursor-pointer hover:file:bg-ink/90 file:transition"
                />
              </div>
              {form.photoIdFile && <p className="mt-1 text-xs text-green-600">Photo ID uploaded</p>}
              <FieldError message={errors.photoIdFile} />
            </div>

            {/* ---- Right to Work ---- */}
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}>
              <h3 className="font-cormorant text-xl font-light text-ink">Right to Work</h3>
              <p className="mt-1 font-jost text-xs font-light text-ink-3">
                UK law requires us to verify your right to work before you can accept bookings.
              </p>

              <div className="mt-4">
                <Label>Document type</Label>
                <select
                  value={form.rightToWorkDocType}
                  onChange={(e) => set('rightToWorkDocType', e.target.value)}
                  className="mt-1.5 block w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition appearance-none"
                  style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                >
                  <option value="">Select document type...</option>
                  <option value="uk_passport">UK Passport</option>
                  <option value="irish_passport">Irish Passport</option>
                  <option value="brp">Biometric Residence Permit (BRP)</option>
                  <option value="eu_settled">EU Settled Status</option>
                  <option value="eu_pre_settled">EU Pre-Settled Status</option>
                  <option value="share_code">Home Office Share Code</option>
                  <option value="visa">Work Visa</option>
                </select>
                <FieldError message={errors.rightToWorkDocType} />
              </div>

              {form.rightToWorkDocType === 'share_code' && (
                <div className="mt-4">
                  <Label>Home Office share code</Label>
                  <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
                    Get your code at gov.uk/prove-right-to-work
                  </p>
                  <input
                    type="text"
                    value={form.rightToWorkShareCode}
                    onChange={(e) => set('rightToWorkShareCode', e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4E"
                    maxLength={9}
                    className="mt-1.5 block w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                    style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                  />
                  <FieldError message={errors.rightToWorkShareCode} />
                </div>
              )}

              {(form.rightToWorkDocType === 'brp' ||
                form.rightToWorkDocType === 'eu_pre_settled' ||
                form.rightToWorkDocType === 'visa') && (
                <div className="mt-4">
                  <Label>Document expiry date</Label>
                  <input
                    type="date"
                    value={form.rightToWorkExpiryDate}
                    onChange={(e) => set('rightToWorkExpiryDate', e.target.value)}
                    className="mt-1.5 block w-full rounded-lg bg-white px-4 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                    style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
              )}

              <div className="mt-4">
                <Label>Upload document</Label>
                <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
                  Upload a clear photo or scan of your right to work document.
                </p>
                <div
                  className="mt-2 rounded-lg bg-cream-2/50 p-4"
                  style={{ border: '1px dashed rgba(14,14,12,0.12)' }}
                >
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          set('rightToWorkDocFile', reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full font-jost text-[13px] font-light text-ink-2 file:mr-4 file:rounded-lg file:border-0 file:bg-ink file:px-5 file:py-2 file:font-jost file:text-[13px] file:font-light file:text-cream file:cursor-pointer hover:file:bg-ink/90 file:transition"
                  />
                </div>
                {form.rightToWorkDocFile && (
                  <p className="mt-1 text-xs text-green-600">Right to work document uploaded</p>
                )}
                <FieldError message={errors.rightToWorkDocFile} />
              </div>
            </div>

            <div
              className="rounded-lg bg-cream-2/50 px-4 py-3"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <p className="font-jost text-[12px] font-light text-ink-3 leading-relaxed">
                Your documents are encrypted and stored securely. They are only used for identity
                and right to work verification purposes. We are required by law to verify your
                eligibility to work in the United Kingdom before you can accept bookings.
              </p>
            </div>
          </div>
        )}

        {/* ===== Step 4 – DBS & Background Check ===== */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              DBS &amp; Background Check
            </h2>
            <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
              A DBS (Disclosure and Barring Service) check helps us ensure the safety of our
              customers. Customers strongly prefer cleaners who are DBS checked.
            </p>

            {/* DBS Option Selection */}
            <div>
              <Label>Do you have a DBS certificate?</Label>
              <div className="mt-3 grid gap-3">
                {(
                  [
                    {
                      value: 'existing' as const,
                      title: 'Yes, I have a DBS certificate',
                      desc: 'Upload your existing certificate for verification',
                    },
                    {
                      value: 'want' as const,
                      title: 'No, but I want to apply for a DBS check',
                      desc: 'We’ll show you how to apply for a DBS check',
                    },
                    {
                      value: 'none' as const,
                      title: 'I don’t have a DBS certificate',
                      desc: 'You can still join, but DBS-checked cleaners get more bookings',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('dbsOption', opt.value)}
                    className={`rounded-xl p-4 text-left transition-all duration-200 ${
                      form.dbsOption === opt.value
                        ? 'bg-ink text-cream shadow-md'
                        : 'bg-white text-ink hover:shadow-sm'
                    }`}
                    style={
                      form.dbsOption !== opt.value
                        ? { border: '1px solid rgba(14,14,12,0.08)' }
                        : undefined
                    }
                  >
                    <span className="block font-jost text-[14px] font-normal">{opt.title}</span>
                    <span
                      className={`mt-1 block font-jost text-[12px] font-light ${form.dbsOption === opt.value ? 'text-cream/70' : 'text-ink-3'}`}
                    >
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
              <FieldError message={errors.dbsOption} />
            </div>

            {/* Existing DBS Details */}
            {form.dbsOption === 'existing' && (
              <div
                className="space-y-4 rounded-xl bg-cream-2/50 p-5 animate-fade-in"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-xl font-light text-ink">
                  DBS Certificate Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Certificate Number</Label>
                    <Input
                      type="text"
                      placeholder="12-digit number"
                      maxLength={12}
                      value={form.dbsCertNumber}
                      onChange={(e) => set('dbsCertNumber', e.target.value.replace(/[^0-9]/g, ''))}
                    />
                    <FieldError message={errors.dbsCertNumber} />
                  </div>
                  <div>
                    <Label>Issue Date</Label>
                    <Input
                      type="date"
                      value={form.dbsCertIssueDate}
                      onChange={(e) => set('dbsCertIssueDate', e.target.value)}
                    />
                    <FieldError message={errors.dbsCertIssueDate} />
                  </div>
                </div>
                <div>
                  <Label>Upload DBS Certificate</Label>
                  <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
                    Clear photo or scan of the full certificate. We will verify the certificate
                    number and status via the DBS Update Service.
                  </p>
                  <div
                    className="mt-2 rounded-lg bg-cream-2/50 p-4"
                    style={{ border: '1px dashed rgba(14,14,12,0.12)' }}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            set('dbsCertFile', reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="block w-full font-jost text-[13px] font-light text-ink-2 file:mr-4 file:rounded-lg file:border-0 file:bg-ink file:px-5 file:py-2 file:font-jost file:text-[13px] file:font-light file:text-cream file:cursor-pointer hover:file:bg-ink/90 file:transition"
                    />
                  </div>
                  {form.dbsCertFile && (
                    <p className="mt-1 text-xs text-green-600">DBS certificate uploaded</p>
                  )}
                  <FieldError message={errors.dbsCertFile} />
                </div>
              </div>
            )}

            {/* Want a DBS — instructions */}
            {form.dbsOption === 'want' && (
              <div
                className="space-y-3 rounded-xl bg-cream-2/50 p-5 animate-fade-in"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-xl font-light text-ink">
                  How to Get a DBS Certificate
                </h3>
                <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
                  You can apply for a Basic DBS check online through the GOV.UK website. It
                  typically costs £18 and takes 2–4 weeks to arrive.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 font-jost text-sm text-gold">1.</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      Visit{' '}
                      <a
                        href="https://www.gov.uk/request-copy-criminal-record"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold underline"
                      >
                        gov.uk/request-copy-criminal-record
                      </a>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 font-jost text-sm text-gold">2.</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      Select &ldquo;Basic DBS check&rdquo; and follow the application steps
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 font-jost text-sm text-gold">3.</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      Once you receive your certificate, upload it in your Rena profile
                    </p>
                  </div>
                </div>
                <p className="font-jost text-[11px] text-ink-3">
                  You can continue your application now and upload your DBS certificate later from
                  your profile.
                </p>
              </div>
            )}

            {/* No DBS — nudge */}
            {form.dbsOption === 'none' && (
              <div
                className="space-y-3 rounded-xl bg-cream-2/50 p-5 animate-fade-in"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
                  You can still register without a DBS certificate, but please be aware that
                  customers strongly prefer DBS-checked cleaners. Cleaners with a verified DBS badge
                  typically receive{' '}
                  <strong className="font-normal text-ink">3–5x more bookings</strong>.
                </p>
                <p className="font-jost text-[11px] text-ink-3">
                  You can apply for a DBS check at any time and upload it to your profile later.
                </p>
              </div>
            )}

            {/* Liveness / Selfie Verification */}
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}>
              <h3 className="font-cormorant text-xl font-light text-ink">Identity Verification</h3>
              <p className="mt-1 font-jost text-sm font-light text-ink-2 leading-relaxed">
                To confirm you are who you say you are, we need a live selfie to match against the
                photo ID you uploaded in the previous step. This is a one-time check to protect both
                you and our customers.
              </p>

              <div
                className="mt-4 rounded-xl bg-cream-2/50 p-5"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                    style={{ border: '1px solid rgba(14,14,12,0.08)' }}
                  >
                    {form.selfiePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.selfiePhoto}
                        alt="Selfie preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-8 w-8 text-ink-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-jost text-sm font-normal text-ink">Take a Selfie</h3>
                    <p className="mt-1 font-jost text-[11px] text-ink-3">
                      Please look directly at the camera in a well-lit area. Remove sunglasses and
                      hats. We&apos;ll compare this with your photo ID to verify your identity.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-ink px-4 py-2 font-jost text-[13px] font-light text-cream transition hover:bg-ink/90">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                          />
                        </svg>
                        {form.selfiePhoto ? 'Retake' : 'Take Selfie'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                set('selfiePhoto', reader.result);
                                set('livenessComplete', true);
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      <label
                        className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg px-4 py-2 font-jost text-[13px] font-light text-ink transition hover:bg-cream-2"
                        style={{ border: '1px solid rgba(14,14,12,0.12)' }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        Upload Photo
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
                                set('selfiePhoto', reader.result);
                                set('livenessComplete', true);
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {form.selfiePhoto && (
                        <span className="font-jost text-xs text-green-600">
                          &#10003; Selfie captured
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <FieldError message={errors.selfiePhoto} />
            </div>

            <div
              className="rounded-lg bg-cream-2/50 px-4 py-3"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <p className="font-jost text-[12px] font-light text-ink-3 leading-relaxed">
                Your selfie and DBS certificate are encrypted and processed securely. The selfie is
                compared against your photo ID to confirm your identity. All data is handled in
                accordance with UK GDPR and destroyed after the verification is complete.
              </p>
            </div>
          </div>
        )}

        {/* ===== Step 5 – Payout ===== */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Payout Setup
            </h2>

            <div
              className="rounded-xl bg-cream-2/50 px-5 py-5"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <h3 className="font-jost text-[14px] font-normal text-ink">
                We use Ryft for payouts
              </h3>
              <p className="mt-2 font-jost text-[13px] font-light text-ink-2 leading-relaxed">
                Ryft is a secure payment platform. Once your application is approved, you&apos;ll be
                redirected to Ryft to set up your payouts. This lets you receive earnings directly
                into your bank account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRyftMessage(true)}
              className="w-full rounded-xl bg-ink py-3 font-jost text-[14px] font-normal text-cream hover:bg-ink/90 transition"
            >
              Set Up Ryft
            </button>

            {ryftMessage && (
              <div
                className="rounded-lg bg-gold/10 px-4 py-3 font-jost text-[13px] font-light text-ink-2 animate-fade-in"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                Coming soon &mdash; Ryft integration is under development. You can continue with
                your application for now.
              </div>
            )}
          </div>
        )}

        {/* ===== Step 6 – Review & Submit ===== */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <h2
              className="font-cormorant text-2xl font-light text-ink pb-3 mb-1"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.08)' }}
            >
              Review &amp; Submit
            </h2>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal */}
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Personal</h3>
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
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Experience</h3>
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
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Pricing</h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  {form.serviceTypes
                    .filter((svc) => SERVICE_RATE_INFO[svc]?.hourly)
                    .map((svc) => (
                      <div key={svc}>
                        <dt className="inline font-normal text-ink">
                          {SERVICE_RATE_INFO[svc]?.label}:
                        </dt>{' '}
                        <dd className="inline">&pound;{form.serviceRates[svc] || '–'}/hr</dd>
                      </div>
                    ))}
                  {form.serviceTypes.some((svc) => !SERVICE_RATE_INFO[svc]?.hourly) && (
                    <div>
                      <dt className="inline font-normal text-ink">Fixed-price:</dt>{' '}
                      <dd className="inline">
                        {form.serviceTypes
                          .filter((svc) => !SERVICE_RATE_INFO[svc]?.hourly)
                          .map((s) => SERVICE_RATE_INFO[s]?.label || s)
                          .join(', ')}{' '}
                        (set in profile)
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-normal text-ink">Hours/week:</dt>{' '}
                    <dd className="inline">{form.hoursPerWeek}</dd>
                  </div>
                </dl>
              </div>

              {/* Identity */}
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Identity</h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Photo ID:</dt>{' '}
                    <dd className="inline">
                      {form.photoIdFile ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Uploaded
                        </span>
                      ) : (
                        'Not uploaded'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Selfie verified:</dt>{' '}
                    <dd className="inline">{form.livenessComplete ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </div>

              {/* DBS */}
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">DBS Check</h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Option:</dt>{' '}
                    <dd className="inline">
                      {form.dbsOption === 'existing'
                        ? 'Existing certificate'
                        : form.dbsOption === 'want'
                          ? 'Will apply'
                          : form.dbsOption === 'none'
                            ? 'Not yet'
                            : 'Not selected'}
                    </dd>
                  </div>
                  {form.dbsOption === 'existing' && (
                    <>
                      <div>
                        <dt className="inline font-normal text-ink">Cert no:</dt>{' '}
                        <dd className="inline">{form.dbsCertNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline font-normal text-ink">Issue date:</dt>{' '}
                        <dd className="inline">{form.dbsCertIssueDate || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline font-normal text-ink">Certificate:</dt>{' '}
                        <dd className="inline">
                          {form.dbsCertFile ? (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Uploaded
                            </span>
                          ) : (
                            'Not uploaded'
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              {/* Right to Work */}
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Right to Work</h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Document type:</dt>{' '}
                    <dd className="inline">
                      {{
                        uk_passport: 'UK Passport',
                        irish_passport: 'Irish Passport',
                        brp: 'Biometric Residence Permit',
                        eu_settled: 'EU Settled Status',
                        eu_pre_settled: 'EU Pre-Settled Status',
                        share_code: 'Home Office Share Code',
                        visa: 'Work Visa',
                      }[form.rightToWorkDocType] || 'Not selected'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-normal text-ink">Document:</dt>{' '}
                    <dd className="inline">
                      {form.rightToWorkDocFile ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Uploaded
                        </span>
                      ) : (
                        'Not uploaded'
                      )}
                    </dd>
                  </div>
                  {form.rightToWorkShareCode && (
                    <div>
                      <dt className="inline font-normal text-ink">Share code:</dt>{' '}
                      <dd className="inline">{form.rightToWorkShareCode}</dd>
                    </div>
                  )}
                  {form.rightToWorkExpiryDate && (
                    <div>
                      <dt className="inline font-normal text-ink">Expires:</dt>{' '}
                      <dd className="inline">{form.rightToWorkExpiryDate}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Bio */}
            {form.bio && (
              <div
                className="rounded-xl bg-cream-2/50 p-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <h3 className="font-cormorant text-lg font-light text-ink">Bio</h3>
                <p className="mt-1 font-jost text-sm font-light text-ink-2 whitespace-pre-line">
                  {form.bio}
                </p>
              </div>
            )}

            {/* T&C checkbox */}
            <label className="flex items-start gap-3 cursor-pointer rounded-lg p-3 hover:bg-cream-2/50 transition">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={(e) => set('agreedToTerms', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-gold"
              />
              <span className="font-jost text-[13px] font-light text-ink-2">
                I agree to the{' '}
                <span className="font-normal text-gold underline">Terms &amp; Conditions</span> and
                consent to a background check as part of the verification process.
              </span>
            </label>
            <FieldError message={errors.agreedToTerms} />

            {errors.submit && (
              <div
                className="rounded-lg bg-red-50 px-4 py-3 font-jost text-[13px] font-light text-red-700"
                style={{ border: '1px solid rgba(239,68,68,0.15)' }}
              >
                {errors.submit}
              </div>
            )}
          </div>
        )}

        {/* ---------- Navigation buttons ---------- */}
        <div className="mt-10 flex items-center justify-between">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-full px-6 py-2.5 font-jost text-[13px] font-light text-ink hover:bg-cream-2 transition"
              style={{ border: '1px solid rgba(14,14,12,0.12)' }}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-ink px-8 py-2.5 font-jost text-[13px] font-light text-cream shadow-sm hover:bg-ink/90 transition"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-ink px-8 py-2.5 font-jost text-[13px] font-light text-cream shadow-sm hover:bg-ink/90 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
