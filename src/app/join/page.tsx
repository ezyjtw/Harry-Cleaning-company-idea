'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import { useAnalytics } from '@/lib/hooks/useAnalytics';

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

  // Step 2 – Pricing
  hourlyRate: string;
  sameDayRate: string;
  hoursPerWeek: string;

  // Step 3 – Identity & Right to Work
  photoIdFile: string;
  rightToWorkDocType: string;
  rightToWorkDocFile: string;
  rightToWorkShareCode: string;
  rightToWorkExpiryDate: string;

  // Step 4 – DBS & Background Check
  dbsOption: 'existing' | 'new' | '';
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

  hourlyRate: '',
  sameDayRate: '',
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
  const monthly = Math.round((weekly * 52) / 12);
  const yearly = weekly * 52;

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
      if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
      if (!form.password || form.password.length < 8)
        e.password = 'Password must be at least 8 characters';
      else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
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
          profilePhoto: profilePhoto?.slice(0, 200) || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrors({
          submit: data?.error || 'Something went wrong. Please try again.',
        });
        return;
      }

      const result = await response.json();
      const cleanerId = result.cleaner?.id;

      // Upload documents in the background after profile creation
      if (cleanerId) {
        const docs: { data: string; type: string }[] = [];
        if (photoIdFile && photoIdFile.startsWith('data:'))
          docs.push({ data: photoIdFile, type: 'photo_id' });
        if (rightToWorkDocFile && rightToWorkDocFile.startsWith('data:'))
          docs.push({ data: rightToWorkDocFile, type: 'right_to_work' });
        if (dbsCertFile && dbsCertFile.startsWith('data:'))
          docs.push({ data: dbsCertFile, type: 'dbs_certificate' });

        for (const doc of docs) {
          try {
            await fetch('/api/cleaners/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cleanerId,
                documentType: doc.type,
                fileData: doc.data,
              }),
            });
          } catch {
            // Document upload failure shouldn't block application success
          }
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
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2 text-3xl text-gold">
          &#10024;
        </div>
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">Application Received!</h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          Thank you for applying to join Rena, {form.name}! Your account has been created.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block bg-ink px-8 py-3 font-jost text-[11px] uppercase tracking-[0.15em] text-cream transition hover:bg-ink/90"
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
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        set('photoIdFile', reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="block w-full font-jost text-sm font-light text-ink-2 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-jost file:text-sm file:font-light file:text-cream hover:file:bg-ink/90"
                />
              </div>
              {form.photoIdFile && <p className="mt-1 text-xs text-green-600">Photo ID uploaded</p>}
              <FieldError message={errors.photoIdFile} />
            </div>

            {/* ---- Right to Work ---- */}
            <div className="mt-6 pt-6" style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}>
              <h2 className="font-cormorant text-xl font-light text-ink">Right to Work</h2>
              <p className="mt-1 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                UK law requires us to verify your right to work before you can accept bookings.
              </p>

              <div className="mt-4">
                <Label>Document type</Label>
                <select
                  value={form.rightToWorkDocType}
                  onChange={(e) => set('rightToWorkDocType', e.target.value)}
                  className="mt-1 block w-full border bg-cream px-3 py-2 font-jost text-sm font-light text-ink"
                  style={{ borderColor: 'rgba(14,14,12,0.1)' }}
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
                  <p className="mt-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Get your code at gov.uk/prove-right-to-work
                  </p>
                  <input
                    type="text"
                    value={form.rightToWorkShareCode}
                    onChange={(e) => set('rightToWorkShareCode', e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4E"
                    maxLength={9}
                    className="mt-1 block w-full border bg-cream px-3 py-2 font-jost text-sm font-light text-ink placeholder:text-ink-3/50"
                    style={{ borderColor: 'rgba(14,14,12,0.1)' }}
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
                    className="mt-1 block w-full border bg-cream px-3 py-2 font-jost text-sm font-light text-ink"
                    style={{ borderColor: 'rgba(14,14,12,0.1)' }}
                  />
                </div>
              )}

              <div className="mt-4">
                <Label>Upload document</Label>
                <p className="mt-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Upload a clear photo or scan of your right to work document.
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
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          set('rightToWorkDocFile', reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full font-jost text-sm font-light text-ink-2 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-jost file:text-sm file:font-light file:text-cream hover:file:bg-ink/90"
                  />
                </div>
                {form.rightToWorkDocFile && (
                  <p className="mt-1 text-xs text-green-600">Right to work document uploaded</p>
                )}
                <FieldError message={errors.rightToWorkDocFile} />
              </div>
            </div>

            <div
              className="bg-cream px-4 py-3"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-sm font-light text-ink-2">
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
            <h2 className="font-cormorant text-xl font-light text-ink">
              DBS &amp; Background Check
            </h2>
            <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
              A DBS (Disclosure and Barring Service) check helps us ensure the safety of our
              customers. You can either provide an existing certificate or apply for a new one
              through Rena.
            </p>

            {/* DBS Option Selection */}
            <div>
              <Label>Do you have an existing DBS certificate?</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => set('dbsOption', 'existing')}
                  className={`p-4 text-left transition ${
                    form.dbsOption === 'existing'
                      ? 'bg-ink text-cream'
                      : 'bg-cream text-ink hover:bg-cream-2'
                  }`}
                  style={
                    form.dbsOption !== 'existing'
                      ? { border: '0.5px solid rgba(14,14,12,0.1)' }
                      : undefined
                  }
                >
                  <span className="block font-jost text-sm font-normal">
                    Yes, I have a DBS certificate
                  </span>
                  <span
                    className={`mt-1 block font-jost text-[11px] ${form.dbsOption === 'existing' ? 'text-cream/70' : 'text-ink-3'}`}
                  >
                    Upload your existing certificate for verification
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => set('dbsOption', 'new')}
                  className={`p-4 text-left transition ${
                    form.dbsOption === 'new'
                      ? 'bg-ink text-cream'
                      : 'bg-cream text-ink hover:bg-cream-2'
                  }`}
                  style={
                    form.dbsOption !== 'new'
                      ? { border: '0.5px solid rgba(14,14,12,0.1)' }
                      : undefined
                  }
                >
                  <span className="block font-jost text-sm font-normal">
                    No, I need a new DBS check
                  </span>
                  <span
                    className={`mt-1 block font-jost text-[11px] ${form.dbsOption === 'new' ? 'text-cream/70' : 'text-ink-3'}`}
                  >
                    We&apos;ll guide you through the application process
                  </span>
                </button>
              </div>
              <FieldError message={errors.dbsOption} />
            </div>

            {/* Existing DBS Details */}
            {form.dbsOption === 'existing' && (
              <div
                className="space-y-4 bg-cream p-5 animate-fade-in"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <h3 className="font-jost text-sm font-normal text-ink">DBS Certificate Details</h3>
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
                  <p className="mt-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Clear photo or scan of the full certificate. We will verify the certificate
                    number and status via the DBS Update Service.
                  </p>
                  <div
                    className="mt-2 bg-cream-2 p-4"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                      className="block w-full font-jost text-sm font-light text-ink-2 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:font-jost file:text-sm file:font-light file:text-cream hover:file:bg-ink/90"
                    />
                  </div>
                  {form.dbsCertFile && (
                    <p className="mt-1 text-xs text-green-600">DBS certificate uploaded</p>
                  )}
                  <FieldError message={errors.dbsCertFile} />
                </div>
              </div>
            )}

            {/* New DBS Application */}
            {form.dbsOption === 'new' && (
              <div
                className="space-y-3 bg-cream p-5 animate-fade-in"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <h3 className="font-jost text-sm font-normal text-ink">Apply for a DBS Check</h3>
                <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
                  Rena partners with an accredited DBS umbrella body to process your check. Once
                  your application is submitted, the DBS check typically takes 2-8 weeks to
                  complete.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gold">&#10003;</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      Basic DBS check &mdash; included free with your Rena application
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gold">&#10003;</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      Enhanced DBS check &mdash; required for certain service types (£23 fee
                      applies)
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gold">&#10003;</span>
                    <p className="font-jost text-sm font-light text-ink-2">
                      You can start accepting bookings once your DBS is returned and verified
                    </p>
                  </div>
                </div>
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  We&apos;ll email you with instructions after you submit your application.
                </p>
              </div>
            )}

            {/* Liveness / Selfie Verification */}
            <div className="mt-6 pt-6" style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}>
              <h2 className="font-cormorant text-xl font-light text-ink">Identity Verification</h2>
              <p className="mt-1 font-jost text-sm font-light text-ink-2 leading-relaxed">
                To confirm you are who you say you are, we need a live selfie to match against the
                photo ID you uploaded in the previous step. This is a one-time check to protect both
                you and our customers.
              </p>

              <div
                className="mt-4 bg-cream p-5"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream-2"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                    <div className="mt-3 flex items-center gap-3">
                      <label className="inline-block cursor-pointer bg-ink px-4 py-2 font-jost text-sm font-light text-cream transition hover:bg-ink/90">
                        {form.selfiePhoto ? 'Retake Selfie' : 'Take Selfie'}
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
              className="bg-cream px-4 py-3"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-sm font-light text-ink-2">
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
            <h2 className="font-cormorant text-xl font-light text-ink">Payout Setup</h2>

            <div
              className="bg-cream px-4 py-4"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <h3 className="font-jost font-normal text-ink">We use Ryft for payouts</h3>
              <p className="mt-2 font-jost text-sm font-light text-ink-2">
                Ryft is a secure payment platform. Once your application is approved, you&apos;ll be
                redirected to Ryft to set up your payouts. This lets you receive earnings directly
                into your bank account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRyftMessage(true)}
              className="w-full bg-ink py-3 font-jost text-base font-normal text-cream hover:bg-ink/90 transition"
            >
              Set Up Ryft
            </button>

            {ryftMessage && (
              <div
                className="bg-cream px-4 py-3 font-jost text-sm font-light text-ink-2 animate-fade-in"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                    <dt className="inline font-normal text-ink">Selfie verified:</dt>{' '}
                    <dd className="inline">{form.livenessComplete ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </div>

              {/* DBS */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  DBS Check
                </h3>
                <dl className="mt-2 space-y-1 font-jost text-sm font-light text-ink-2">
                  <div>
                    <dt className="inline font-normal text-ink">Option:</dt>{' '}
                    <dd className="inline">
                      {form.dbsOption === 'existing'
                        ? 'Existing certificate'
                        : form.dbsOption === 'new'
                          ? 'New application'
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
                        <dd className="inline">{form.dbsCertFile || 'Not uploaded'}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              {/* Right to Work */}
              <div className="p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                  Right to Work
                </h3>
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
                    <dd className="inline">{form.rightToWorkDocFile || 'Not uploaded'}</dd>
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

          {currentStep < 6 ? (
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
