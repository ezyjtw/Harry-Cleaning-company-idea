'use client';

import Image from 'next/image';

import HeroQuoteWidget from '../src/components/HeroQuoteWidget';

const trustItems = [
  { label: 'Vetted cleaners' },
  { label: 'ID verified' },
  { label: 'Insured' },
  { label: 'Verified reviews' },
];

export default function HeroSection() {
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

            <h1 className="mb-5 font-cormorant text-[28px] font-light leading-[1.1] text-white sm:text-[36px] md:mb-7 md:text-[50px]">
              Join the cleaning{' '}
              <em className="not-italic font-etna tracking-wider text-white md:tracking-widest">
                RENA-LUTION
              </em>
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

          {/* Right column — quote widget */}
          <HeroQuoteWidget />
        </div>
      </div>
    </section>
  );
}
