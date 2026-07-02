'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isInCatchmentArea } from '@/lib/catchment';
import { BEDROOMS_TO_EOT_SIZE, BEDROOMS_TO_AIRBNB_SIZE } from '@/lib/constants/services';
import { SERVICE_FEE_PERCENT } from '@/lib/pricing';

// ─── Types ──────────────────────────────────────────────────────

type ServiceSlug = 'regular' | 'same-day' | 'deep' | 'eot' | 'airbnb';

interface QuoteResult {
  mode: 'area';
  serviceType: string;
  isFixedPrice: boolean;
  cleanerCount: number;
  minTotal: number;
  maxTotal: number;
  minCleanerPrice: number;
  maxCleanerPrice: number;
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
  fixedPrices: { propertySize: string; customerPrice: number; estimatedHours: number }[];
  addons: ServiceAddon[];
}

// ─── Constants ──────────────────────────────────────────────────

const SERVICE_LABELS: Record<ServiceSlug, string> = {
  regular: 'Regular',
  'same-day': 'Same day',
  deep: 'Deep clean',
  eot: 'End of tenancy',
  airbnb: 'Airbnb',
};

const SERVICE_TO_CATEGORY: Record<ServiceSlug, string> = {
  regular: 'regular',
  'same-day': 'same-day',
  deep: 'deep',
  eot: 'end-of-tenancy',
  airbnb: 'airbnb',
};

const PROPERTY_SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1bed': '1 Bed',
  '2bed': '2 Bed',
  '3bed': '3 Bed',
  '4bed': '4 Bed',
  '5bedPlus': '5+ Bed',
  '4bedPlus': '4+ Bed',
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

function getSuggestedHours(bedrooms: number, bathrooms: number, isDeep: boolean): number {
  const baseByBed: Record<number, { standard: number; deep: number }> = {
    1: { standard: 2, deep: 3 },
    2: { standard: 2.5, deep: 3.5 },
    3: { standard: 3, deep: 4.5 },
    4: { standard: 3.5, deep: 5.5 },
    5: { standard: 4.5, deep: 7 },
  };
  const base = baseByBed[bedrooms] ?? baseByBed[5];
  const hours = isDeep ? base.deep : base.standard;
  const extraBath = Math.max(0, bathrooms - 1) * 0.5;
  return hours + extraBath;
}

// ─── Sub-components ─────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-3">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-3">
          <div
            className={`h-[7px] w-[7px] rounded-full transition-all duration-300 ${
              s === current ? 'scale-125 bg-gold' : s < current ? 'bg-gold-2' : 'bg-ink/10'
            }`}
          />
          {s < total && (
            <div className={`h-px w-4 ${s < current ? 'bg-gold/40' : 'bg-ink/[0.06]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PanelFooter() {
  return (
    <div
      className="flex justify-between pt-5"
      style={{ borderTop: '1px solid rgba(27,42,74,0.06)' }}
    >
      <span className="font-jost text-[12px] font-light text-ink-3">
        From £14 / hr · No hidden fees
      </span>
      <span className="font-jost text-[12px] font-light text-ink-3">Cancel anytime</span>
    </div>
  );
}

function PostcodeBar({
  postcode,
  cleanerCount,
  onChangeClick,
}: {
  postcode: string;
  cleanerCount: number | null;
  onChangeClick: () => void;
}) {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-md bg-cream px-4 py-3"
      style={{ border: '1px solid rgba(27,42,74,0.08)' }}
    >
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-gold/10">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3 7L6 10L11 4"
            stroke="#2F80ED"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="flex-1 font-jost text-[13px] text-ink">{postcode}</span>
      {cleanerCount !== null && (
        <span className="font-jost text-[11px] text-gold-2">
          {cleanerCount > 0
            ? `${cleanerCount} cleaner${cleanerCount !== 1 ? 's' : ''} nearby`
            : 'No cleaners nearby yet'}
        </span>
      )}
      <button
        onClick={onChangeClick}
        className="font-jost text-[11px] uppercase tracking-[0.08em] text-gold"
      >
        CHANGE
      </button>
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-2 font-jost text-[13px] transition ${
        selected ? 'bg-gold text-white' : 'text-ink-2'
      }`}
      style={!selected ? { border: '1px solid rgba(27,42,74,0.12)' } : undefined}
    >
      {children}
    </button>
  );
}

// ─── Main Widget ────────────────────────────────────────────────

export default function HeroQuoteWidget() {
  // Steps: 1=postcode, 2=property, 3=estimate+addons, 4=done
  const [step, setStep] = useState(1);

  // Step 1
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);
  const [confirmedPostcode, setConfirmedPostcode] = useState('');

  // Out-of-area waitlist
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Step 2
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [serviceSlug, setServiceSlug] = useState<ServiceSlug>('regular');
  const [hours, setHours] = useState(3);

  // Step 3 — quote & addons
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [availableAddons, setAvailableAddons] = useState<ServiceAddon[]>([]);
  const [services, setServices] = useState<ServiceTypeData[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFixed = serviceSlug === 'eot' || serviceSlug === 'airbnb';

  // Fetch services on mount
  useEffect(() => {
    fetch('/api/pricing/services')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch(() => {});
  }, []);

  // Auto-suggest hours
  useEffect(() => {
    if (isFixed || bedrooms === null || bathrooms === null) return;
    const isDeep = serviceSlug === 'deep';
    const suggested = getSuggestedHours(bedrooms, bathrooms, isDeep);
    const minHours = isDeep ? 3 : 2;
    setHours(Math.max(minHours, Math.round(suggested)));
  }, [bedrooms, bathrooms, serviceSlug, isFixed]);

  // Update addons when service changes
  useEffect(() => {
    const svc = services.find((s) => s.slug === serviceSlug);
    setAvailableAddons(svc?.addons ?? []);
    setSelectedAddons([]);
  }, [serviceSlug, services]);

  const fetchQuote = useCallback(
    async (_addonIds: string[] = selectedAddons) => {
      if (bedrooms === null || bathrooms === null || !confirmedPostcode) return;

      const body: Record<string, unknown> = {
        postcode: confirmedPostcode,
        serviceSlug,
      };

      if (isFixed) {
        const propertySizeSlug =
          serviceSlug === 'eot'
            ? BEDROOMS_TO_EOT_SIZE[bedrooms]
            : BEDROOMS_TO_AIRBNB_SIZE[bedrooms];
        if (!propertySizeSlug) return;
        body.propertySize = propertySizeSlug;
      } else {
        body.hours = hours;
      }

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
          sessionStorage.setItem('rena_active_quote', JSON.stringify(data));
        }
      } catch {
        // error state handled by !quote check in renderStep3
      } finally {
        setQuoteLoading(false);
      }
    },
    [bedrooms, bathrooms, serviceSlug, hours, isFixed, selectedAddons, confirmedPostcode]
  );

  const handleAddonToggle = (addonId: string) => {
    const next = selectedAddons.includes(addonId)
      ? selectedAddons.filter((id) => id !== addonId)
      : [...selectedAddons, addonId];
    setSelectedAddons(next);
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
    setCleanerCount(null); // loading — real count fetched below
    setStep(2);

    // #3: real "N cleaners nearby" — the count of cleaners actually serving this
    // postcode (same distance/travel-time filter the cleaner grid uses). Fire-and-
    // forget; graceful on error/0. `total` is the full count, independent of limit.
    fetch(`/api/cleaners?postcode=${encodeURIComponent(trimmed)}&limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCleanerCount(typeof d?.total === 'number' ? d.total : null))
      .catch(() => setCleanerCount(null));
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

  const handleStep2Next = async () => {
    if (bedrooms === null || bathrooms === null) return;
    setStep(3);
    await fetchQuote();
  };

  const handleReset = () => {
    setStep(1);
    setPostcode('');
    setConfirmedPostcode('');
    setCleanerCount(null);
    setBedrooms(null);
    setBathrooms(null);
    setServiceSlug('regular');
    setQuote(null);
    setSelectedAddons([]);
  };

  const canProceedStep2 = bedrooms !== null && bathrooms !== null;

  const buildBookingUrl = () => {
    const category = SERVICE_TO_CATEGORY[serviceSlug];
    const params = new URLSearchParams({
      postcode: confirmedPostcode,
      bedrooms: String(bedrooms),
      bathrooms: String(bathrooms ?? 1),
    });
    return `/services/${category}?${params.toString()}`;
  };

  // ─── Steps ────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <p className="mb-6 font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
        Get an instant quote
      </p>

      <div
        className="flex overflow-hidden rounded-md"
        style={{ border: '1px solid rgba(27,42,74,0.12)' }}
      >
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
          placeholder="Enter your postcode"
          className="flex-1 bg-transparent px-4 py-3 font-jost text-[14px] text-ink outline-none placeholder:text-ink-3/60"
        />
        <button
          onClick={handlePostcodeSubmit}
          className="bg-gold px-7 font-jost text-[13px] tracking-[0.04em] text-white transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </div>

      {postcodeError ? (
        <p className="mb-7 mt-2 font-jost text-[12px] text-red-500">{postcodeError}</p>
      ) : (
        <p className="mb-7 mt-2 font-jost text-[12px] text-ink-3">e.g. IG11 7QR</p>
      )}

      {/* Out-of-area waitlist */}
      {showWaitlist && !waitlistSubmitted && (
        <div
          className="mb-4 rounded-md bg-cream p-4"
          style={{ border: '1px solid rgba(27,42,74,0.08)' }}
        >
          <p className="font-jost text-[13px] font-medium text-ink">
            We&apos;re expanding to your area soon
          </p>
          <p className="mt-1 font-jost text-[12px] text-ink-3">
            Leave your email and we&apos;ll notify you when we launch near{' '}
            <span className="font-medium">{confirmedPostcode}</span>. Just one email when we go live
            — no marketing without your consent.
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
              className="flex-1 rounded-md border border-ink/10 bg-white px-3 py-2 font-jost text-[13px] placeholder:text-ink-3/60 outline-none focus:border-gold"
            />
            <button
              onClick={handleWaitlistSubmit}
              disabled={waitlistLoading || !waitlistEmail.trim()}
              className="rounded-md bg-gold px-4 py-2 font-jost text-[12px] font-medium text-white disabled:opacity-50"
            >
              {waitlistLoading ? '...' : 'Notify me'}
            </button>
          </div>
        </div>
      )}

      {showWaitlist && waitlistSubmitted && (
        <div
          className="mb-4 rounded-md bg-cream p-4"
          style={{ border: '1px solid rgba(27,42,74,0.08)' }}
        >
          <p className="font-jost text-[13px] font-medium text-gold">You&apos;re on the list</p>
          <p className="mt-1 font-jost text-[12px] text-ink-3">
            We&apos;ll email you as soon as we launch in your area.
          </p>
        </div>
      )}

      <PanelFooter />
    </>
  );

  const renderStep2 = () => (
    <>
      <PostcodeBar
        postcode={confirmedPostcode}
        cleanerCount={cleanerCount}
        onChangeClick={() => setStep(1)}
      />

      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        {isFixed ? 'Property size' : 'Bedrooms'}
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
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
          <OptionButton key={n} selected={bedrooms === n} onClick={() => setBedrooms(n)}>
            {label}
          </OptionButton>
        ))}
      </div>

      {/* Bathrooms — hide for fixed-price */}
      {!isFixed && (
        <>
          <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Bathrooms
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((n) => (
              <OptionButton key={n} selected={bathrooms === n} onClick={() => setBathrooms(n)}>
                {n === 4 ? '4+' : n}
              </OptionButton>
            ))}
          </div>
        </>
      )}

      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        What type of clean?
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(SERVICE_LABELS) as ServiceSlug[]).map((key) => {
          const isSameDay = key === 'same-day';
          if (isSameDay) {
            return (
              <span
                key={key}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 font-jost text-[13px] text-ink-3/50 cursor-not-allowed"
                style={{ border: '1px solid rgba(27,42,74,0.08)' }}
              >
                {SERVICE_LABELS[key]}
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[9px] uppercase tracking-[0.08em] text-ink-3">
                  Soon
                </span>
              </span>
            );
          }
          return (
            <OptionButton
              key={key}
              selected={serviceSlug === key}
              onClick={() => {
                setServiceSlug(key);
                if ((key === 'eot' || key === 'airbnb') && bathrooms === null) setBathrooms(1);
              }}
            >
              {SERVICE_LABELS[key]}
            </OptionButton>
          );
        })}
      </div>

      {/* Hours slider — hourly services only */}
      {!isFixed && (
        <div className="mb-6">
          <p className="mb-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Hours: {hours}
          </p>
          <input
            type="range"
            min={serviceSlug === 'deep' ? 3 : 2}
            max={8}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full accent-gold"
          />
          <div className="flex justify-between font-jost text-[11px] text-ink-3/60">
            <span>{serviceSlug === 'deep' ? '3 hrs' : '2 hrs'}</span>
            <span>8 hrs</span>
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
            <div
              className="mb-6 rounded-md bg-cream px-4 py-3 text-center"
              style={{ border: '1px solid rgba(27,42,74,0.08)' }}
            >
              <span className="font-jost text-[13px] font-medium text-ink">
                Prices from &pound;{low} &ndash; &pound;{high}
              </span>
              <p className="mt-1 font-jost text-[11px] text-ink-3">
                depending on your cleaner. Includes {SERVICE_FEE_PERCENT}% service fee.
              </p>
            </div>
          );
        })()}

      <button
        onClick={handleStep2Next}
        disabled={!canProceedStep2}
        className={`mb-6 w-full rounded-md py-4 font-jost text-[13px] tracking-[0.08em] transition-opacity ${
          canProceedStep2 ? 'bg-gold text-white' : 'cursor-not-allowed bg-gold/30 text-white'
        }`}
      >
        {isFixed ? 'See prices' : 'Get estimate'}
      </button>

      <PanelFooter />
    </>
  );

  const renderStep3 = () => {
    if (quoteLoading) {
      return (
        <div className="py-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="mt-3 font-jost text-[13px] text-ink-3">Calculating your quote...</p>
        </div>
      );
    }

    if (!quote) {
      return (
        <div className="py-10 text-center">
          <p className="mb-1 font-cormorant text-[22px] font-light text-ink">
            Something went wrong
          </p>
          <p className="mb-5 font-jost text-[13px] font-light text-ink-3">
            We couldn&apos;t calculate your quote. Please try again.
          </p>
          <button
            onClick={() => fetchQuote()}
            className="rounded-md bg-gold px-6 py-3 font-jost text-[13px] tracking-[0.08em] text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <button
            onClick={() => setStep(2)}
            className="mt-3 block w-full py-2 font-jost text-[12px] text-ink-3 transition hover:text-ink"
          >
            Go back
          </button>
        </div>
      );
    }

    return (
      <>
        <PostcodeBar
          postcode={confirmedPostcode}
          cleanerCount={cleanerCount}
          onChangeClick={() => setStep(1)}
        />

        {/* Summary chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span
            className="rounded-md px-3 py-1.5 font-jost text-[11px] text-ink-2"
            style={{ border: '1px solid rgba(27,42,74,0.1)' }}
          >
            {isFixed
              ? (() => {
                  const b = bedrooms ?? 1;
                  const slug =
                    serviceSlug === 'eot' ? BEDROOMS_TO_EOT_SIZE[b] : BEDROOMS_TO_AIRBNB_SIZE[b];
                  if (!slug) return `${b} bed`;
                  return PROPERTY_SIZE_LABELS[slug] ?? slug;
                })()
              : `${bedrooms} bed · ${bathrooms} bath`}
          </span>
          <span
            className="rounded-md px-3 py-1.5 font-jost text-[11px] text-ink-2"
            style={{ border: '1px solid rgba(27,42,74,0.1)' }}
          >
            {SERVICE_LABELS[serviceSlug]}
          </span>
          {!isFixed && (
            <span
              className="rounded-md px-3 py-1.5 font-jost text-[11px] text-ink-2"
              style={{ border: '1px solid rgba(27,42,74,0.1)' }}
            >
              {hours} hrs
            </span>
          )}
        </div>

        {/* Estimate display */}
        <div
          className="mb-6 rounded-md bg-cream p-5 text-center"
          style={{ border: '1px solid rgba(27,42,74,0.06)' }}
        >
          <p className="font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
            Estimated price
          </p>
          {quote.cleanerCount > 0 ? (
            <>
              <p className="mt-2 font-cormorant text-[36px] font-light text-ink">
                from &pound;{quote.minTotal.toFixed(2)}
              </p>
              <p className="mt-2 font-jost text-[12px] text-ink-3">
                Based on {quote.cleanerCount} cleaner{quote.cleanerCount !== 1 ? 's' : ''} near you.
                Includes {SERVICE_FEE_PERCENT}% service fee.
              </p>
            </>
          ) : (
            <>
              {(() => {
                const ranges =
                  serviceSlug === 'eot' ? EOT_SUGGESTED_RANGES : AIRBNB_SUGGESTED_RANGES;
                const key = Math.min(bedrooms ?? 1, serviceSlug === 'eot' ? 5 : 4);
                const range = ranges[key];
                const low = range ? Math.ceil(range[0] * 1.06) : 0;
                return (
                  <p className="mt-2 font-cormorant text-[36px] font-light text-ink">
                    from &pound;{low}
                  </p>
                );
              })()}
              <p className="mt-2 font-jost text-[12px] text-ink-3">
                Typical starting price for your area. Includes {SERVICE_FEE_PERCENT}% service fee.
              </p>
            </>
          )}
          <p className="mt-3 font-jost text-[11px] text-ink-3">
            Exact price shown when you choose your cleaner
          </p>
        </div>

        {/* Add-ons for EOT and Airbnb */}
        {isFixed && availableAddons.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Optional add-ons
            </p>
            <div className="space-y-2">
              {availableAddons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 transition hover:bg-cream"
                  style={{ border: '1px solid rgba(27,42,74,0.1)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.id)}
                    onChange={() => handleAddonToggle(addon.id)}
                    className="h-4 w-4 rounded border-ink/20 accent-gold"
                  />
                  <span className="flex-1 font-jost text-[13px] text-ink">{addon.name}</span>
                  <span className="font-jost text-[12px] font-medium text-ink-3">
                    +&pound;{addon.price}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setStep(4)}
          className="mb-3 w-full rounded-md bg-gold py-4 font-jost text-[13px] tracking-[0.08em] text-white transition-opacity hover:opacity-90"
        >
          Continue
        </button>

        <button
          onClick={() => setStep(2)}
          className="mb-6 w-full rounded-md py-3 font-jost text-[13px] text-ink-2 transition hover:bg-cream"
          style={{ border: '1px solid rgba(27,42,74,0.12)' }}
        >
          Adjust details
        </button>

        <PanelFooter />
      </>
    );
  };

  const renderStep4 = () => {
    if (!quote) {
      return (
        <div className="py-10 text-center">
          <p className="mb-5 font-jost text-[14px] font-light text-ink-2">
            Your quote is no longer available.
          </p>
          <button
            onClick={handleReset}
            className="rounded-md bg-gold px-6 py-3 font-jost text-[13px] tracking-[0.08em] text-white transition-opacity hover:opacity-90"
          >
            Start over
          </button>
        </div>
      );
    }
    return (
      <>
        <div className="mb-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="#C9A96E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="mt-3 font-cormorant text-[22px] font-light text-ink">
            Ready to find your cleaner
          </p>
          <p className="mt-1 font-jost text-[13px] font-light text-ink-3">
            {cleanerCount && cleanerCount > 0
              ? `Browse ${cleanerCount} cleaner${cleanerCount !== 1 ? 's' : ''} near `
              : 'Find a cleaner near '}
            <span className="font-medium text-ink">{confirmedPostcode}</span>
          </p>
        </div>

        <div
          className="mb-6 rounded-md bg-cream px-4 py-3 text-center"
          style={{ border: '1px solid rgba(27,42,74,0.06)' }}
        >
          <span className="font-cormorant text-[20px] font-light text-ink">
            from &pound;{quote.minTotal.toFixed(2)}
          </span>
          <span className="ml-2 font-jost text-[12px] text-ink-3">estimated</span>
        </div>

        {/* Two genuinely different paths: direct booking (high-intent) vs browse-first. */}
        <a
          href={buildBookingUrl()}
          className="mb-3 flex w-full items-center justify-center rounded-md bg-gold py-4 font-jost text-[13px] tracking-[0.08em] text-white transition-opacity hover:opacity-90"
        >
          Book a clean
        </a>

        <a
          href={`/cleaners?postcode=${encodeURIComponent(confirmedPostcode)}`}
          className="mb-3 flex w-full items-center justify-center rounded-md py-3 font-jost text-[13px] tracking-[0.08em] text-ink transition hover:bg-cream"
          style={{ border: '1px solid rgba(27,42,74,0.10)' }}
        >
          Browse cleaners
        </a>

        <button
          onClick={handleReset}
          className="mb-6 w-full py-2 font-jost text-[12px] text-ink-3 transition hover:text-ink"
        >
          Start over
        </button>

        <PanelFooter />
      </>
    );
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div
      className="rounded-lg bg-white p-6 shadow-soft md:p-10"
      style={{ border: '1px solid rgba(27,42,74,0.06)' }}
    >
      <StepDots current={step} total={4} />
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}
