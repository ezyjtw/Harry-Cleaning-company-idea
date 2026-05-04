'use client';

import Image from 'next/image';
import { useState } from 'react';

const trustItems = [
  { label: 'Vetted cleaners' },
  { label: 'ID verified' },
  { label: 'Insured' },
  { label: 'Verified reviews' },
];

type ServiceType = 'regular' | 'one-off' | 'deep' | 'eot' | 'airbnb' | 'same-day';

const SERVICE_LABELS: Record<ServiceType, string> = {
  regular: 'Regular',
  'one-off': 'One-off',
  deep: 'Deep clean',
  eot: 'End of tenancy',
  airbnb: 'Airbnb',
  'same-day': 'Same day',
};

const SERVICE_MULTIPLIERS: Record<ServiceType, number> = {
  regular: 1,
  'one-off': 1.15,
  deep: 1.45,
  eot: 1.0, // fixed-price — multiplier not used
  airbnb: 1.0, // fixed-price — multiplier not used
  'same-day': 1.3,
};

const BASE_RATE = 25;

// Fixed prices for EOT and Airbnb per spec (keyed by bedroom count)
const EOT_FIXED_PRICES: Record<number, number> = {
  0: 175,
  1: 220,
  2: 280,
  3: 350,
  4: 430,
  5: 550,
};
const AIRBNB_FIXED_PRICES: Record<number, number> = {
  0: 55,
  1: 75,
  2: 95,
  3: 120,
  4: 155,
  5: 155,
};

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function getCleanerCount(postcode: string): number {
  let hash = 0;
  for (let i = 0; i < postcode.length; i++) {
    hash = (hash * 31 + postcode.charCodeAt(i)) | 0;
  }
  return 4 + (Math.abs(hash) % 5);
}

function computeEstimate(
  bedrooms: number,
  bathrooms: number,
  serviceType: ServiceType
): { low: number; high: number; isFixed: boolean } {
  // EOT and Airbnb use fixed prices from the spec
  if (serviceType === 'eot') {
    const price = EOT_FIXED_PRICES[Math.min(bedrooms, 5)] ?? 280;
    return { low: price, high: price, isFixed: true };
  }
  if (serviceType === 'airbnb') {
    const price = AIRBNB_FIXED_PRICES[Math.min(bedrooms, 5)] ?? 95;
    return { low: price, high: price, isFixed: true };
  }
  const hours = bedrooms * 0.5 + bathrooms * 0.75 + 1;
  const multiplier = SERVICE_MULTIPLIERS[serviceType];
  const mid = hours * BASE_RATE * multiplier;
  const low = Math.round(mid * 0.9);
  const high = Math.round(mid * 1.1);
  return { low, high, isFixed: false };
}

function BlueCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 7L6 10L11 4"
        stroke="#2F80ED"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-3">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-3">
          <div
            className={`h-[7px] w-[7px] rounded-full transition-all duration-300 ${
              s === current ? 'scale-125 bg-gold' : s < current ? 'bg-gold-2' : 'bg-ink/10'
            }`}
          />
          {s < 4 && <div className={`h-px w-4 ${s < current ? 'bg-gold/40' : 'bg-ink/[0.06]'}`} />}
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
        <BlueCheck />
      </div>
      <span className="flex-1 font-jost text-[13px] text-ink">{postcode}</span>
      {cleanerCount !== null && (
        <span className="font-jost text-[11px] text-gold-2">{cleanerCount} cleaners nearby</span>
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

export default function HeroSection() {
  const [step, setStep] = useState(1);

  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [confirmedPostcode, setConfirmedPostcode] = useState('');
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);

  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('regular');

  const estimate =
    bedrooms !== null && bathrooms !== null
      ? computeEstimate(bedrooms, bathrooms, serviceType)
      : null;

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

  const handleBackToStep1 = () => {
    setStep(1);
  };

  const canProceedStep2 = bedrooms !== null && bathrooms !== null;

  const handleReset = () => {
    setStep(1);
    setPostcode('');
    setConfirmedPostcode('');
    setCleanerCount(null);
    setBedrooms(null);
    setBathrooms(null);
    setServiceType('regular');
  };

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
          onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSubmit()}
          placeholder="Enter your postcode"
          className="flex-1 bg-transparent px-4 py-3 font-jost text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          onClick={handlePostcodeSubmit}
          className="bg-gold px-6 font-jost text-[13px] font-medium text-white"
        >
          Continue
        </button>
      </div>

      {postcodeError ? (
        <p className="mb-7 mt-2 font-jost text-[12px] text-red-500">{postcodeError}</p>
      ) : (
        <p className="mb-7 mt-2 font-jost text-[12px] text-ink-3">e.g. SW1A 1AA or NW1 6XE</p>
      )}

      <PanelFooter />
    </>
  );

  const renderStep2 = () => (
    <>
      <PostcodeBar
        postcode={confirmedPostcode}
        cleanerCount={cleanerCount}
        onChangeClick={handleBackToStep1}
      />

      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Bedrooms</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setBedrooms(n)}
            className={`rounded-md px-4 py-2 font-jost text-[13px] ${
              bedrooms === n ? 'bg-gold text-white' : 'text-ink-2'
            }`}
            style={bedrooms !== n ? { border: '1px solid rgba(27,42,74,0.12)' } : undefined}
          >
            {n === 5 ? '5+' : n}
          </button>
        ))}
      </div>

      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Bathrooms</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setBathrooms(n)}
            className={`rounded-md px-4 py-2 font-jost text-[13px] ${
              bathrooms === n ? 'bg-gold text-white' : 'text-ink-2'
            }`}
            style={bathrooms !== n ? { border: '1px solid rgba(27,42,74,0.12)' } : undefined}
          >
            {n === 4 ? '4+' : n}
          </button>
        ))}
      </div>

      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        What type of clean?
      </p>
      <div className="mb-7 flex flex-wrap gap-2">
        {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((key) => (
          <button
            key={key}
            onClick={() => setServiceType(key)}
            className={`rounded-md px-4 py-2 font-jost text-[13px] ${
              serviceType === key ? 'bg-gold text-white' : 'text-ink-2'
            }`}
            style={serviceType !== key ? { border: '1px solid rgba(27,42,74,0.12)' } : undefined}
          >
            {SERVICE_LABELS[key]}
          </button>
        ))}
      </div>

      <button
        onClick={() => canProceedStep2 && setStep(3)}
        className={`mb-6 w-full rounded-md py-4 font-jost text-[13px] tracking-[0.08em] transition-opacity ${
          canProceedStep2 ? 'bg-gold text-white' : 'cursor-not-allowed bg-gold/30 text-white'
        }`}
        disabled={!canProceedStep2}
      >
        Get estimate
      </button>

      <PanelFooter />
    </>
  );

  const renderStep3 = () => {
    if (!estimate) return null;
    return (
      <>
        <PostcodeBar
          postcode={confirmedPostcode}
          cleanerCount={cleanerCount}
          onChangeClick={handleBackToStep1}
        />

        <div className="mb-6 flex flex-wrap gap-2">
          <span
            className="rounded-md px-3 py-1.5 font-jost text-[11px] text-ink-2"
            style={{ border: '1px solid rgba(27,42,74,0.1)' }}
          >
            {bedrooms} bed · {bathrooms} bath
          </span>
          <span
            className="rounded-md px-3 py-1.5 font-jost text-[11px] text-ink-2"
            style={{ border: '1px solid rgba(27,42,74,0.1)' }}
          >
            {SERVICE_LABELS[serviceType]}
          </span>
        </div>

        <div
          className="mb-7 rounded-md px-6 py-6 text-center"
          style={{ border: '1px solid rgba(27,42,74,0.08)', background: '#F7F9FC' }}
        >
          <p className="mb-2 font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {estimate.isFixed ? 'Fixed price' : 'Estimated cost'}
          </p>
          <p className="font-cormorant text-[44px] font-light leading-none text-ink">
            {estimate.isFixed ? `Approx. £${estimate.low}` : `£${estimate.low} – £${estimate.high}`}
          </p>
          <p className="mt-3 font-jost text-[12px] text-ink-3">
            {estimate.isFixed
              ? 'Add-ons available at checkout'
              : 'Exact price shown when you choose your cleaner'}
          </p>
        </div>

        <button
          onClick={() => setStep(4)}
          className="mb-3 w-full rounded-md bg-gold py-4 font-jost text-[13px] tracking-[0.08em] text-white"
        >
          Continue
        </button>

        <button
          onClick={() => setStep(2)}
          className="mb-6 w-full rounded-md py-3 font-jost text-[13px] text-ink-2"
          style={{ border: '1px solid rgba(27,42,74,0.12)' }}
        >
          Adjust details
        </button>

        <PanelFooter />
      </>
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
      <>
        <PostcodeBar
          postcode={confirmedPostcode}
          cleanerCount={cleanerCount}
          onChangeClick={handleBackToStep1}
        />

        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 flex h-[48px] w-[48px] items-center justify-center rounded-full bg-gold-2/10">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10L8 14L16 6"
                stroke="#00BFA6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="mb-1 font-jost text-[15px] font-medium text-ink">
            Ready to find your cleaner
          </p>
          <p className="font-jost text-[13px] text-ink-3">
            Browse {cleanerCount} cleaners near{' '}
            <span className="text-ink">{confirmedPostcode}</span> for a{' '}
            <span className="text-ink">{SERVICE_LABELS[serviceType].toLowerCase()} clean</span>
          </p>
        </div>

        <div
          className="mb-7 flex items-center justify-between rounded-md px-5 py-4"
          style={{ border: '1px solid rgba(27,42,74,0.08)', background: '#F7F9FC' }}
        >
          <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Estimated
          </span>
          <span className="font-cormorant text-[24px] font-light text-ink">
            {estimate.isFixed ? `Approx. £${estimate.low}` : `£${estimate.low} – £${estimate.high}`}
          </span>
        </div>

        <a
          href={`/cleaners?${params.toString()}`}
          className="mb-3 flex w-full items-center justify-center rounded-md bg-gold py-4 font-jost text-[13px] tracking-[0.08em] text-white"
        >
          Choose a cleaner
        </a>

        <button onClick={handleReset} className="mb-6 w-full py-2 font-jost text-[12px] text-ink-3">
          Start over
        </button>

        <PanelFooter />
      </>
    );
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image src="/images/hero-banner.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A]/70 via-[#1B2A4A]/50 to-[#1B2A4A]/30" />
      </div>

      <div className="relative px-5 py-14 md:px-14 md:py-24">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-20">
          {/* Left column */}
          <div>
            <p className="mb-5 font-jost text-[12px] uppercase tracking-[0.2em] text-white/80">
              Trusted home cleaning
            </p>

            <h1 className="mb-5 font-cormorant text-[28px] font-light leading-[1.1] text-white sm:text-[36px] md:mb-7 md:text-[50px] whitespace-nowrap">
              Join the cleaning <em className="text-gold-2">Rena-lution</em>
            </h1>

            <p className="mb-3 font-cormorant text-[24px] font-light leading-[1.2] text-white/90 md:text-[34px]">
              Pick the cleaner that fits you.
            </p>

            <p className="mb-8 max-w-[420px] font-jost text-[15px] font-light leading-[1.8] text-white/90 md:mb-10 md:text-[16px]">
              Browse personally vetted cleaners in your area. Read genuine reviews, choose someone
              you trust, and book in two minutes.
            </p>

            <div className="mb-8 flex flex-col gap-3 sm:flex-row md:mb-10">
              <a
                href="/cleaners"
                className="rounded-md bg-gold px-7 py-3.5 text-center font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Book a cleaner
              </a>
              <a
                href="#how-it-works"
                className="rounded-md border border-white/30 px-7 py-3.5 text-center font-jost text-[14px] font-normal text-white transition-colors hover:border-white/50"
              >
                How it works
              </a>
            </div>

            <div className="flex flex-wrap gap-4 md:gap-5">
              {trustItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gold-2/20">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="#00BFA6"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="font-jost text-[12px] text-white/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — booking panel */}
          <div
            className="rounded-lg bg-white p-6 shadow-soft md:p-10"
            style={{ border: '1px solid rgba(27,42,74,0.06)' }}
          >
            <StepDots current={step} />
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </div>
      </div>
    </section>
  );
}
