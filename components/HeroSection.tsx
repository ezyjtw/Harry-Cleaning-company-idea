'use client';

import { useState } from 'react';

const trustItems = [
  { label: 'DBS checked' },
  { label: 'ID verified' },
  { label: 'Insured' },
  { label: 'Verified reviews' },
];

type ServiceType = 'regular' | 'deep' | 'end_of_tenancy' | 'airbnb' | 'one_off' | 'same_day';

const SERVICE_LABELS: Record<ServiceType, string> = {
  regular: 'Regular',
  one_off: 'One-off',
  deep: 'Deep clean',
  end_of_tenancy: 'End of tenancy',
  airbnb: 'Airbnb',
  same_day: 'Same day',
};

const SERVICE_MULTIPLIERS: Record<ServiceType, number> = {
  regular: 1,
  one_off: 1,
  deep: 1.5,
  end_of_tenancy: 1.8,
  airbnb: 1.3,
  same_day: 1.2,
};

const BASE_RATE = 25;

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
): { low: number; high: number } {
  const hours = bedrooms * 0.5 + bathrooms * 0.75 + 1;
  const multiplier = SERVICE_MULTIPLIERS[serviceType];
  const mid = hours * BASE_RATE * multiplier;
  const low = Math.round(mid * 0.9);
  const high = Math.round(mid * 1.1);
  return { low, high };
}

function GoldCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L5 9L10 3" stroke="#b8975a" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-3">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-3">
          <div
            className={`h-[6px] w-[6px] transition-all duration-300 ${
              s === current ? 'bg-ink scale-125' : s < current ? 'bg-gold' : 'bg-ink/10'
            }`}
          />
          {s < 4 && <div className={`h-px w-4 ${s < current ? 'bg-gold/40' : 'bg-ink/[0.06]'}`} />}
        </div>
      ))}
    </div>
  );
}

/* ── Shared footer ────────────────────────────────────────────── */
function PanelFooter() {
  return (
    <div
      className="flex justify-between pt-5"
      style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
    >
      <span className="font-jost text-[12px] font-light text-ink-3">
        From £18 / hr · No hidden fees
      </span>
      <span className="font-jost text-[12px] font-light text-ink-3">Cancel anytime</span>
    </div>
  );
}

/* ── Confirmed postcode bar (reused in steps 2-4) ─────────────── */
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
      className="mb-6 flex items-center gap-3 bg-cream-2 px-4 py-3"
      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
    >
      <div
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"
        style={{ border: '0.5px solid #b8975a' }}
      >
        <GoldCheck />
      </div>
      <span className="flex-1 font-jost text-[13px] font-light text-ink">{postcode}</span>
      {cleanerCount !== null && (
        <span className="font-jost text-[11px] font-light text-gold">
          {cleanerCount} cleaners nearby
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

export default function HeroSection() {
  const [step, setStep] = useState(1);

  // Step 1
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [confirmedPostcode, setConfirmedPostcode] = useState('');
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);

  // Step 2
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('regular');

  // Derived
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

  /* ── Step 1: Postcode ─────────────────────────────────────── */
  const renderStep1 = () => (
    <>
      <p className="mb-6 font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
        Get an instant quote
      </p>

      <div className="flex" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
        <input
          type="text"
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value);
            if (postcodeError) setPostcodeError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSubmit()}
          placeholder="Enter your postcode"
          className="flex-1 bg-transparent px-4 py-3 font-jost text-[14px] font-light text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          onClick={handlePostcodeSubmit}
          className="bg-ink px-6 font-jost text-[13px] font-normal text-cream"
        >
          Continue
        </button>
      </div>

      {postcodeError ? (
        <p className="mb-7 mt-2 font-jost text-[12px] font-light text-red-500">{postcodeError}</p>
      ) : (
        <p className="mb-7 mt-2 font-jost text-[12px] font-light text-ink-3">
          e.g. SW1A 1AA or E4 7AP
        </p>
      )}

      <PanelFooter />
    </>
  );

  /* ── Step 2: Home details + service type ───────────────────── */
  const renderStep2 = () => (
    <>
      <PostcodeBar
        postcode={confirmedPostcode}
        cleanerCount={cleanerCount}
        onChangeClick={handleBackToStep1}
      />

      {/* Bedrooms */}
      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Bedrooms</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setBedrooms(n)}
            className={`px-4 py-2 font-jost text-[13px] font-light ${
              bedrooms === n ? 'bg-ink text-cream' : 'text-ink-2'
            }`}
            style={bedrooms !== n ? { border: '0.5px solid rgba(14,14,12,0.1)' } : undefined}
          >
            {n === 5 ? '5+' : n}
          </button>
        ))}
      </div>

      {/* Bathrooms */}
      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Bathrooms</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setBathrooms(n)}
            className={`px-4 py-2 font-jost text-[13px] font-light ${
              bathrooms === n ? 'bg-ink text-cream' : 'text-ink-2'
            }`}
            style={bathrooms !== n ? { border: '0.5px solid rgba(14,14,12,0.1)' } : undefined}
          >
            {n === 4 ? '4+' : n}
          </button>
        ))}
      </div>

      {/* Service type */}
      <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        What type of clean?
      </p>
      <div className="mb-7 flex flex-wrap gap-2">
        {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((key) => (
          <button
            key={key}
            onClick={() => setServiceType(key)}
            className={`px-4 py-2 font-jost text-[13px] font-light ${
              serviceType === key ? 'bg-ink text-cream' : 'text-ink-2'
            }`}
            style={serviceType !== key ? { border: '0.5px solid rgba(14,14,12,0.1)' } : undefined}
          >
            {SERVICE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => canProceedStep2 && setStep(3)}
        className={`mb-6 w-full py-4 font-jost text-[13px] tracking-[0.08em] transition-opacity ${
          canProceedStep2 ? 'bg-ink text-cream' : 'bg-ink/30 text-cream cursor-not-allowed'
        }`}
        disabled={!canProceedStep2}
      >
        Get estimate →
      </button>

      <PanelFooter />
    </>
  );

  /* ── Step 3: Estimate ─────────────────────────────────────── */
  const renderStep3 = () => {
    if (!estimate) return null;
    return (
      <>
        <PostcodeBar
          postcode={confirmedPostcode}
          cleanerCount={cleanerCount}
          onChangeClick={handleBackToStep1}
        />

        {/* Summary chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span
            className="px-3 py-1.5 font-jost text-[11px] font-light text-ink-2"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            {bedrooms} bed · {bathrooms} bath
          </span>
          <span
            className="px-3 py-1.5 font-jost text-[11px] font-light text-ink-2"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            {SERVICE_LABELS[serviceType]}
          </span>
        </div>

        {/* Estimate display */}
        <div
          className="mb-7 px-6 py-6 text-center"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <p className="mb-2 font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
            Estimated cost
          </p>
          <p className="font-cormorant text-[44px] font-light leading-none text-ink">
            £{estimate.low} – £{estimate.high}
          </p>
          <p className="mt-3 font-jost text-[12px] font-light text-ink-3">
            Exact price shown when you choose your cleaner
          </p>
        </div>

        <button
          onClick={() => setStep(4)}
          className="mb-3 w-full bg-ink py-4 font-jost text-[13px] tracking-[0.08em] text-cream"
        >
          Continue →
        </button>

        <button
          onClick={() => setStep(2)}
          className="mb-6 w-full py-3 font-jost text-[13px] font-light text-ink-2"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          Adjust details
        </button>

        <PanelFooter />
      </>
    );
  };

  /* ── Step 4: Confirmation ──────────────────────────────────── */
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
          {/* Checkmark */}
          <div
            className="mx-auto mb-5 flex h-[48px] w-[48px] items-center justify-center"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L8 14L16 6" stroke="#b8975a" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          </div>

          <p className="mb-1 font-jost text-[15px] font-normal text-ink">
            Ready to find your cleaner
          </p>
          <p className="font-jost text-[13px] font-light text-ink-3">
            Browse {cleanerCount} cleaners near{' '}
            <span className="text-ink">{confirmedPostcode}</span> for a{' '}
            <span className="text-ink">{SERVICE_LABELS[serviceType].toLowerCase()} clean</span>
          </p>
        </div>

        {/* Estimate reminder */}
        <div
          className="mb-7 flex items-center justify-between px-5 py-4"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Estimated
          </span>
          <span className="font-cormorant text-[24px] font-light text-ink">
            £{estimate.low} – £{estimate.high}
          </span>
        </div>

        <a
          href={`/cleaners?${params.toString()}`}
          className="mb-3 flex w-full items-center justify-center bg-ink py-4 font-jost text-[13px] tracking-[0.08em] text-cream"
        >
          Choose a cleaner →
        </a>

        <button
          onClick={handleReset}
          className="mb-6 w-full py-2 font-jost text-[12px] font-light text-ink-3"
        >
          Start over
        </button>

        <PanelFooter />
      </>
    );
  };

  return (
    <section className="bg-cream px-14 py-24">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 items-center gap-24">
        {/* Left column */}
        <div>
          <div className="mb-7 flex items-center gap-3">
            <div className="h-px w-6 bg-gold" />
            <span className="font-jost text-[11px] uppercase tracking-[0.18em] text-gold">
              Home cleaning, elevated
            </span>
          </div>

          <h1 className="mb-7 font-cormorant text-[68px] font-light leading-[1.05] text-ink">
            A cleaner
            <br />
            you&apos;ll want
            <br />
            to <em className="text-gold">keep</em>
          </h1>

          <p className="mb-11 max-w-[400px] font-jost text-[16px] font-light leading-[1.8] text-ink-2">
            Browse DBS-checked, personally vetted cleaners in your area. Read genuine reviews,
            choose someone you trust, and book in two minutes.
          </p>

          <div className="mb-12 flex gap-3">
            <a
              href="/cleaners"
              className="bg-ink px-7 py-3.5 font-jost text-[14px] font-normal text-cream"
            >
              Find cleaners near me
            </a>
            <a
              href="#how-it-works"
              className="px-7 py-3.5 font-jost text-[14px] font-normal text-ink"
              style={{ border: '0.5px solid #0e0e0c' }}
            >
              How it works
            </a>
          </div>

          <div className="flex gap-6">
            {trustItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="flex h-[18px] w-[18px] items-center justify-center"
                  style={{ border: '0.5px solid #b8975a' }}
                >
                  <GoldCheck />
                </div>
                <span className="font-jost text-[12px] font-light text-ink-3">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — booking panel */}
        <div className="bg-white p-10" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <StepDots current={step} />
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </section>
  );
}
