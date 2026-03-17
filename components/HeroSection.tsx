'use client';

import { useState } from 'react';

const trustItems = [
  { label: 'DBS checked' },
  { label: 'ID verified' },
  { label: 'Insured' },
  { label: 'Verified reviews' },
];

const serviceChips = ['Regular', 'One-off', 'Deep clean', 'End of tenancy', 'Airbnb', 'Same day'];

function GoldCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L5 9L10 3" stroke="#b8975a" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export default function HeroSection() {
  const [step, setStep] = useState<1 | 2>(1);
  const [address, setAddress] = useState('');
  const [activeChip, setActiveChip] = useState('Regular');

  const handleContinue = () => {
    if (address.trim()) setStep(2);
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
          {step === 1 ? (
            <>
              <p className="mb-6 font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
                Get an instant quote
              </p>

              <div className="flex" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                  placeholder="Enter your address or postcode"
                  className="flex-1 bg-transparent px-4 py-3 font-jost text-[14px] font-light text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <button
                  onClick={handleContinue}
                  className="bg-ink px-6 font-jost text-[13px] font-normal text-cream"
                >
                  Continue
                </button>
              </div>

              <p className="mb-7 mt-2 font-jost text-[12px] font-light text-ink-3">
                e.g. 14 Kensington Gardens, London, W2 4BT
              </p>

              <div
                className="flex justify-between pt-5"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <span className="font-jost text-[12px] font-light text-ink-3">
                  From £18 / hr · No hidden fees
                </span>
                <span className="font-jost text-[12px] font-light text-ink-3">Cancel anytime</span>
              </div>
            </>
          ) : (
            <>
              {/* Confirmed address bar */}
              <div
                className="mb-6 flex items-center gap-3 bg-cream-2 px-4 py-3"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div
                  className="flex h-[18px] w-[18px] items-center justify-center"
                  style={{ border: '0.5px solid #b8975a' }}
                >
                  <GoldCheck />
                </div>
                <span className="flex-1 font-jost text-[13px] font-light text-ink">{address}</span>
                <button
                  onClick={() => setStep(1)}
                  className="font-jost text-[11px] uppercase tracking-[0.08em] text-gold"
                >
                  CHANGE
                </button>
              </div>

              {/* Service chips */}
              <p className="mb-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                What type of clean?
              </p>
              <div className="mb-7 flex flex-wrap gap-2">
                {serviceChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setActiveChip(chip)}
                    className={`px-4 py-2 font-jost text-[13px] font-light ${
                      activeChip === chip ? 'bg-ink text-cream' : 'text-ink-2'
                    }`}
                    style={
                      activeChip !== chip ? { border: '0.5px solid rgba(14,14,12,0.1)' } : undefined
                    }
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* CTA */}
              <button className="mb-6 w-full bg-ink py-4 font-jost text-[13px] tracking-[0.08em] text-cream">
                See available cleaners →
              </button>

              <div
                className="flex justify-between pt-5"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <span className="font-jost text-[12px] font-light text-ink-3">
                  From £18 / hr · No hidden fees
                </span>
                <span className="font-jost text-[12px] font-light text-ink-3">Cancel anytime</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
