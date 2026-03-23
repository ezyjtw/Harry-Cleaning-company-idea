'use client';

import { useState } from 'react';

type ServiceType = 'regular' | 'deep' | 'end_of_tenancy' | 'airbnb';

const SERVICE_LABELS: Record<ServiceType, string> = {
  regular: 'Regular',
  deep: 'Deep',
  end_of_tenancy: 'End of Tenancy',
  airbnb: 'AirBnB',
};

const SERVICE_MULTIPLIERS: Record<ServiceType, number> = {
  regular: 1,
  deep: 1.4,
  end_of_tenancy: 1.8,
  airbnb: 1.3,
};

const BASE_RATE = 25; // £/hr

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function getCleanerCount(postcode: string): number {
  // Deterministic mock count 4-8 based on postcode characters
  let hash = 0;
  for (let i = 0; i < postcode.length; i++) {
    hash = (hash * 31 + postcode.charCodeAt(i)) | 0;
  }
  return 4 + (Math.abs(hash) % 5); // 4–8
}

function computeEstimate(
  bedrooms: number,
  bathrooms: number,
  serviceType: ServiceType
): { low: number; high: number } {
  const hours = bedrooms * 0.5 + bathrooms * 0.75 + 1;
  const multiplier = SERVICE_MULTIPLIERS[serviceType];
  const mid = hours * BASE_RATE * multiplier;
  const low = Math.round(mid * 0.9);
  const high = Math.round(mid * 1.1);
  return { low, high };
}

export default function HeroQuoteWidget() {
  const [step, setStep] = useState(1);

  // Step 1
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);
  const [confirmedPostcode, setConfirmedPostcode] = useState('');

  // Step 2
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('regular');

  // Derived
  const estimate =
    bedrooms !== null && bathrooms !== null
      ? computeEstimate(bedrooms, bathrooms, serviceType)
      : null;

  // ─── Handlers ──────────────────────────────────────────────

  const handlePostcodeSubmit = () => {
    const trimmed = postcode.trim();
    if (!UK_POSTCODE_REGEX.test(trimmed)) {
      setPostcodeError('Please enter a valid UK postcode');
      return;
    }
    setPostcodeError('');
    setConfirmedPostcode(trimmed.toUpperCase());
    setCleanerCount(getCleanerCount(trimmed));
    setStep(2);
  };

  const canProceedStep2 = bedrooms !== null && bathrooms !== null;

  const handleStep2Next = () => {
    if (canProceedStep2) setStep(3);
  };

  // ─── Step indicator ────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => {
            // Only allow navigating back to completed steps
            if (s < step) setStep(s);
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
            s === step
              ? 'bg-brand-600 text-white scale-110 shadow-md'
              : s < step
                ? 'bg-brand-200 text-brand-700 cursor-pointer hover:bg-brand-300'
                : 'bg-gray-200 text-gray-400 cursor-default'
          }`}
          aria-label={`Step ${s}`}
          disabled={s > step}
        >
          {s < step ? (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            s
          )}
        </button>
      ))}
    </div>
  );

  // ─── Steps ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="animate-fade-in">
      <h3 className="text-lg font-bold text-gray-900 text-center">Get an Instant Quote</h3>
      <p className="mt-1 text-sm text-gray-500 text-center">
        Enter your postcode to find cleaners near you
      </p>

      <div className="mt-5 flex gap-2">
        <input
          type="text"
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value);
            if (postcodeError) setPostcodeError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePostcodeSubmit();
          }}
          placeholder="e.g. SW1A 1AA"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={handlePostcodeSubmit}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition"
        >
          Search
        </button>
      </div>

      {postcodeError && <p className="mt-2 text-sm text-red-500">{postcodeError}</p>}
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-fade-in">
      {/* Postcode chip */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Searching near {confirmedPostcode}
        </span>
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          {cleanerCount} cleaners near you
        </span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 text-center">Tell us about your home</h3>

      {/* Bedrooms */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-gray-700">Bedrooms</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBedrooms(n)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                bedrooms === n
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n === 5 ? '5+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Bathrooms */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-gray-700">Bathrooms</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBathrooms(n)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                bathrooms === n
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n === 4 ? '4+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Type of clean */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-gray-700">Type of Clean</label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((key) => (
            <option key={key} value={key}>
              {SERVICE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={handleStep2Next}
        disabled={!canProceedStep2}
        className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Get Estimate
      </button>
    </div>
  );

  const renderStep3 = () => {
    if (!estimate) return null;
    return (
      <div className="animate-fade-in">
        {/* Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
            {confirmedPostcode}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {bedrooms} bed &middot; {bathrooms} bath
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {SERVICE_LABELS[serviceType]}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center">Your Instant Estimate</h3>

        <div className="mt-5 rounded-xl bg-gradient-to-br from-brand-50 to-white border border-brand-200 p-6 text-center">
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Estimated Cost
          </div>
          <div className="mt-2 text-4xl font-extrabold text-brand-700">
            &pound;{estimate.low} &ndash; &pound;{estimate.high}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Exact price shown when you choose your cleaner
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStep(4)}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition"
        >
          Continue
        </button>

        <button
          type="button"
          onClick={() => setStep(2)}
          className="mt-2 w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          Adjust Details
        </button>
      </div>
    );
  };

  const renderStep4 = () => {
    if (!estimate) return null;
    const params = new URLSearchParams({
      postcode: confirmedPostcode,
      serviceType,
      bedrooms: String(bedrooms),
      bathrooms: String(bathrooms),
    });

    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <svg
            className="h-8 w-8 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h3 className="mt-4 text-lg font-bold text-gray-900">Ready to find your cleaner</h3>
        <p className="mt-1 text-sm text-gray-500">
          Browse {cleanerCount} cleaners near{' '}
          <span className="font-medium text-brand-700">{confirmedPostcode}</span> for a{' '}
          <span className="font-medium text-brand-700">
            {SERVICE_LABELS[serviceType].toLowerCase()} clean
          </span>
        </p>

        <div className="mt-3 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
          <span className="text-sm font-semibold text-brand-700">
            &pound;{estimate.low} &ndash; &pound;{estimate.high}
          </span>
          <span className="ml-1 text-sm text-gray-500">estimated</span>
        </div>

        <a
          href={`/cleaners?${params.toString()}`}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition shadow-soft"
        >
          Choose a Cleaner
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>

        <button
          type="button"
          onClick={() => {
            setStep(1);
            setPostcode('');
            setConfirmedPostcode('');
            setCleanerCount(null);
            setBedrooms(null);
            setBathrooms(null);
            setServiceType('regular');
          }}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Start over
        </button>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white/95 backdrop-blur-sm p-6 sm:p-8 shadow-soft">
      <StepIndicator />
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}
