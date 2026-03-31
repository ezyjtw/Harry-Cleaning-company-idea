'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isInCatchmentArea } from '@/lib/catchment';
import { SERVICE_FEE_PERCENT } from '@/lib/pricing';

// ─── Types ──────────────────────────────────────────────────────

type ServiceSlug = 'regular' | 'same-day' | 'deep' | 'eot' | 'airbnb';

type PropertySize = 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED' | 'FOUR_BED' | 'FIVE_PLUS';

interface QuoteResult {
  serviceType: string;
  cleanerHourlyRate: number;
  cleanerDeepRate: number | null;
  hours: number | null;
  propertySize: string | null;
  isFixedPrice: boolean;
  cleanerGross: number;
  cleanerFee: number;
  cleanerEarns: number;
  customerSubtotal: number;
  customerServiceFee: number;
  addonTotal: number;
  totalCharged: number;
  renaEarns: number;
  breakdown: string;
}

interface ServiceAddon {
  id: string;
  name: string;
  price: number;
}

interface ServiceTypeData {
  id: string;
  slug: string;
  name: string;
  pricingModel: 'HOURLY' | 'FIXED';
  baseMultiplier: number;
  minimumHours: number | null;
  fixedPrices: { propertySize: PropertySize; customerPrice: number; estimatedHours: number }[];
  addons: ServiceAddon[];
}

// ─── Constants ──────────────────────────────────────────────────

const SERVICE_LABELS: Record<ServiceSlug, string> = {
  regular: 'Regular',
  'same-day': 'Same-Day',
  deep: 'Deep',
  eot: 'End of Tenancy',
  airbnb: 'Airbnb',
};

const PROPERTY_SIZE_LABELS: Record<PropertySize, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bed',
  TWO_BED: '2 Bed',
  THREE_BED: '3 Bed',
  FOUR_BED: '4 Bed',
  FIVE_PLUS: '5+ Bed',
};

const BEDROOM_TO_PROPERTY: Record<number, PropertySize> = {
  0: 'STUDIO',
  1: 'ONE_BED',
  2: 'TWO_BED',
  3: 'THREE_BED',
  4: 'FOUR_BED',
  5: 'FIVE_PLUS',
};

const EOT_SUGGESTED_RANGES: Record<number, [number, number]> = {
  0: [150, 200],
  1: [190, 240],
  2: [250, 300],
  3: [320, 380],
  4: [390, 450],
  5: [480, 580],
};

const AIRBNB_SUGGESTED_RANGES: Record<number, [number, number]> = {
  0: [45, 65],
  1: [55, 85],
  2: [75, 110],
  3: [95, 140],
  4: [130, 165],
};

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const DEFAULT_FLOOR_RATE = 14; // £14 as the floor rate for initial quote

/**
 * Suggested hours based on bedrooms + bathrooms for hourly services.
 * Deep cleans use a separate (higher) scale due to more intensive work.
 */
function getSuggestedHours(bedrooms: number, bathrooms: number, isDeep: boolean): number {
  // Base hours by bedroom count
  const baseByBed: Record<number, { standard: number; deep: number }> = {
    1: { standard: 2, deep: 3 },
    2: { standard: 2.5, deep: 3.5 },
    3: { standard: 3, deep: 4.5 },
    4: { standard: 3.5, deep: 5.5 },
    5: { standard: 4.5, deep: 7 },
  };
  const base = baseByBed[bedrooms] ?? baseByBed[5];
  const hours = isDeep ? base.deep : base.standard;
  // Add 0.5hr for each extra bathroom beyond the first
  const extraBath = Math.max(0, bathrooms - 1) * 0.5;
  return hours + extraBath;
}

function getCleanerCount(postcode: string): number {
  let hash = 0;
  for (let i = 0; i < postcode.length; i++) {
    hash = (hash * 31 + postcode.charCodeAt(i)) | 0;
  }
  return 4 + (Math.abs(hash) % 5);
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
  const [serviceSlug, setServiceSlug] = useState<ServiceSlug>('regular');
  const [hours, setHours] = useState(3);
  const [frequency, setFrequency] = useState<'WEEKLY' | 'FORTNIGHTLY' | 'ONE_OFF'>('ONE_OFF');

  // Step 3 — quote & addons
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [availableAddons, setAvailableAddons] = useState<ServiceAddon[]>([]);
  const [services, setServices] = useState<ServiceTypeData[]>([]);

  // Out-of-area waitlist
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch services on mount
  useEffect(() => {
    fetch('/api/pricing/services')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch(() => {});
  }, []);

  const isFixed = serviceSlug === 'eot' || serviceSlug === 'airbnb';

  // Auto-suggest hours when bedrooms, bathrooms, or service type changes
  useEffect(() => {
    if (isFixed || bedrooms === null || bathrooms === null) return;
    const isDeep = serviceSlug === 'deep';
    const suggested = getSuggestedHours(bedrooms, bathrooms, isDeep);
    const minHours = isDeep ? 3 : 2;
    setHours(Math.max(minHours, Math.round(suggested)));
  }, [bedrooms, bathrooms, serviceSlug, isFixed]);

  // Update available addons when service changes
  useEffect(() => {
    const svc = services.find((s) => s.slug === serviceSlug);
    setAvailableAddons(svc?.addons ?? []);
    setSelectedAddons([]);
  }, [serviceSlug, services]);

  const fetchQuote = useCallback(
    async (addonIds: string[] = selectedAddons) => {
      if (bedrooms === null || bathrooms === null) return;

      const propertySize = BEDROOM_TO_PROPERTY[bedrooms] ?? 'FIVE_PLUS';
      const body: Record<string, unknown> = {
        serviceSlug,
        cleanerHourlyRate: DEFAULT_FLOOR_RATE,
      };

      if (isFixed) {
        body.propertySize = propertySize;
      } else {
        body.hours = hours;
        if (serviceSlug === 'regular') body.frequency = frequency;
      }

      if (addonIds.length > 0) body.addons = addonIds;

      setQuoteLoading(true);
      try {
        const res = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          setQuote(data);
          // Store in sessionStorage for navigation survival
          sessionStorage.setItem('rena_active_quote', JSON.stringify(data));
        }
      } catch {
        // silently fail
      } finally {
        setQuoteLoading(false);
      }
    },
    [bedrooms, bathrooms, serviceSlug, hours, frequency, isFixed, selectedAddons]
  );

  const handleAddonToggle = (addonId: string) => {
    const next = selectedAddons.includes(addonId)
      ? selectedAddons.filter((id) => id !== addonId)
      : [...selectedAddons, addonId];
    setSelectedAddons(next);

    // Debounced re-fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchQuote(next), 300);
  };

  // ─── Handlers ──────────────────────────────────────────────

  const handlePostcodeSubmit = () => {
    const trimmed = postcode.trim();
    if (!UK_POSTCODE_REGEX.test(trimmed)) {
      setPostcodeError('Please enter a valid UK postcode');
      return;
    }
    setPostcodeError('');

    if (!isInCatchmentArea(trimmed)) {
      setConfirmedPostcode(trimmed.toUpperCase());
      setShowWaitlist(true);
      return;
    }

    setShowWaitlist(false);
    setConfirmedPostcode(trimmed.toUpperCase());
    setCleanerCount(getCleanerCount(trimmed));
    setStep(2);
  };

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail.trim(), postcode: confirmedPostcode }),
      });
      setWaitlistSubmitted(true);
    } catch {
      // silently fail
    } finally {
      setWaitlistLoading(false);
    }
  };

  const canProceedStep2 = bedrooms !== null && bathrooms !== null;

  const handleStep2Next = async () => {
    if (!canProceedStep2) return;
    setStep(3);
    await fetchQuote();
  };

  // ─── Step indicator ────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => {
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

      {/* Out-of-area waitlist */}
      {showWaitlist && !waitlistSubmitted && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-semibold text-amber-800">
            We&apos;re expanding to your area soon
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Leave your email and we&apos;ll notify you when we launch near{' '}
            <span className="font-medium">{confirmedPostcode}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleWaitlistSubmit();
              }}
              placeholder="your@email.com"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="button"
              onClick={handleWaitlistSubmit}
              disabled={waitlistLoading || !waitlistEmail.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {waitlistLoading ? 'Sending...' : 'Notify Me'}
            </button>
          </div>
        </div>
      )}

      {showWaitlist && waitlistSubmitted && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">You&apos;re on the list</p>
          <p className="mt-1 text-xs text-green-700">
            We&apos;ll email you as soon as we launch in your area.
          </p>
        </div>
      )}
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
        <label className="block text-sm font-semibold text-gray-700">
          {isFixed ? 'Property Size' : 'Bedrooms'}
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(isFixed
            ? [
                { n: 0, label: 'Studio' },
                { n: 1, label: '1 Bed' },
                { n: 2, label: '2 Bed' },
                { n: 3, label: '3 Bed' },
                { n: 4, label: '4 Bed' },
                { n: 5, label: '5+' },
              ]
            : [
                { n: 1, label: '1' },
                { n: 2, label: '2' },
                { n: 3, label: '3' },
                { n: 4, label: '4' },
                { n: 5, label: '5+' },
              ]
          ).map(({ n, label }) => (
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
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bathrooms — hide for fixed-price services */}
      {!isFixed && (
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
      )}

      {/* Type of clean */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-gray-700">Type of Clean</label>
        <select
          value={serviceSlug}
          onChange={(e) => {
            const val = e.target.value as ServiceSlug;
            setServiceSlug(val);
            // Auto-set bathrooms for fixed services so canProceedStep2 works
            if (val === 'eot' || val === 'airbnb') {
              if (bathrooms === null) setBathrooms(1);
            }
          }}
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {(Object.keys(SERVICE_LABELS) as ServiceSlug[]).map((key) => (
            <option key={key} value={key}>
              {SERVICE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Hours slider — hourly services only */}
      {!isFixed && (
        <div className="mt-5">
          <label className="block text-sm font-semibold text-gray-700">Hours: {hours}</label>
          <input
            type="range"
            min={serviceSlug === 'deep' ? 3 : 2}
            max={8}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{serviceSlug === 'deep' ? '3 hrs' : '2 hrs'}</span>
            <span>8 hrs</span>
          </div>
        </div>
      )}

      {/* Frequency — regular only */}
      {serviceSlug === 'regular' && (
        <div className="mt-5">
          <label className="block text-sm font-semibold text-gray-700">Frequency</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { val: 'WEEKLY' as const, label: 'Weekly' },
              { val: 'FORTNIGHTLY' as const, label: 'Fortnightly' },
              { val: 'ONE_OFF' as const, label: 'One-off' },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setFrequency(val)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  frequency === val
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price range preview for EOT/Airbnb */}
      {isFixed &&
        bedrooms !== null &&
        (() => {
          const ranges = serviceSlug === 'eot' ? EOT_SUGGESTED_RANGES : AIRBNB_SUGGESTED_RANGES;
          const key = Math.min(bedrooms, serviceSlug === 'eot' ? 5 : 4);
          const range = ranges[key];
          if (!range) return null;
          const low = Math.ceil(range[0] * 1.06);
          const high = Math.ceil(range[1] * 1.06);
          return (
            <div className="mt-5 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-center">
              <span className="text-sm font-semibold text-brand-700">
                Prices from &pound;{low} &ndash; &pound;{high}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                depending on your cleaner. Includes 6% service fee.
              </p>
            </div>
          );
        })()}

      {/* Next */}
      <button
        type="button"
        onClick={handleStep2Next}
        disabled={!canProceedStep2}
        className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {isFixed ? 'Browse Cleaners' : 'Get Estimate'}
      </button>
    </div>
  );

  const renderStep3 = () => {
    if (quoteLoading) {
      return (
        <div className="animate-fade-in text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Calculating your quote...</p>
        </div>
      );
    }

    if (!quote) return null;

    return (
      <div className="animate-fade-in">
        {/* Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
            {confirmedPostcode}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {isFixed
              ? PROPERTY_SIZE_LABELS[BEDROOM_TO_PROPERTY[bedrooms ?? 1] ?? 'ONE_BED']
              : `${bedrooms} bed · ${bathrooms} bath`}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {SERVICE_LABELS[serviceSlug]}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center">Your Instant Estimate</h3>

        <div className="mt-5 rounded-xl bg-gradient-to-br from-brand-50 to-white border border-brand-200 p-6 text-center">
          {quote.isFixedPrice ? (
            <>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Typical Price Range
              </div>
              {(() => {
                const ranges =
                  serviceSlug === 'eot' ? EOT_SUGGESTED_RANGES : AIRBNB_SUGGESTED_RANGES;
                const key = Math.min(bedrooms ?? 1, serviceSlug === 'eot' ? 5 : 4);
                const range = ranges[key];
                const low = range ? Math.ceil(range[0] * 1.06) : 0;
                const high = range ? Math.ceil(range[1] * 1.06) : 0;
                return (
                  <div className="mt-2 text-3xl font-extrabold text-brand-700">
                    &pound;{low} &ndash; &pound;{high}
                  </div>
                );
              })()}
              <p className="mt-2 text-xs text-gray-500">
                depending on your cleaner. Includes 6% service fee.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Choose a cleaner to see their exact price for your property size.
              </p>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Estimated Cost
              </div>
              <div className="mt-2 text-4xl font-extrabold text-brand-700">
                &pound;{quote.totalCharged.toFixed(2)}
              </div>
              {/* Price breakdown for hourly services */}
              <div className="mt-4 text-left text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Cleaner rate</span>
                  <span>&pound;{quote.customerSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service fee ({SERVICE_FEE_PERCENT}%)</span>
                  <span>&pound;{quote.customerServiceFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>&pound;{quote.totalCharged.toFixed(2)}</span>
                </div>
              </div>
              {serviceSlug === 'regular' && frequency !== 'ONE_OFF' && (
                <p className="mt-2 text-xs text-gray-500">
                  &pound;{quote.totalCharged.toFixed(2)} per visit &middot; Billed after each clean
                </p>
              )}
            </>
          )}
          <p className="mt-3 text-sm text-gray-500">
            Exact price shown when you choose your cleaner
          </p>
        </div>

        {/* Add-ons for EOT and Airbnb */}
        {isFixed && availableAddons.length > 0 && (
          <div className="mt-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Optional Add-ons
            </label>
            <div className="space-y-2">
              {availableAddons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.id)}
                    onChange={() => handleAddonToggle(addon.id)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="flex-1 text-sm text-gray-700">{addon.name}</span>
                  <span className="text-sm font-medium text-gray-500">+&pound;{addon.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setStep(4)}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition"
        >
          {isFixed ? 'Browse available cleaners' : 'Continue'}
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
    if (!quote) return null;
    const params = new URLSearchParams({
      postcode: confirmedPostcode,
      serviceType: serviceSlug,
      bedrooms: String(bedrooms),
      bathrooms: String(bathrooms ?? 1),
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
            {SERVICE_LABELS[serviceSlug].toLowerCase()} clean
          </span>
        </p>

        <div className="mt-3 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
          <span className="text-sm font-semibold text-brand-700">
            &pound;{quote.totalCharged.toFixed(2)}
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
            setServiceSlug('regular');
            setQuote(null);
            setSelectedAddons([]);
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
