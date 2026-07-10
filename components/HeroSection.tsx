'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import HeroQuoteWidget from '../src/components/HeroQuoteWidget';

export default function HeroSection() {
  const t = useTranslations('Hero');

  const trustItems = [
    { label: t('vettedCleaners') },
    { label: t('idVerified') },
    { label: t('insured') },
    { label: t('verifiedReviews') },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-banner.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/50 to-ink/30" />
      </div>

      <div className="relative px-5 py-14 md:px-14 md:py-24">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-20">
          {/* Left column */}
          <div>
            <p className="mb-5 font-jost text-[12px] uppercase tracking-[0.2em] text-white/80">
              {t('trustedHome')}
            </p>

            {/* James-ruled hero restructure: the choice promise IS the headline;
                RENA-lution demotes to the signature line beneath it (option 3:
                Etna wordmark + lowercase Courier Prime for "-lution"). The old
                third line is gone. NOTE: rendered white-on-ink like all hero
                type — the "brand navy" of the ruling reads as the mock's
                light-ground colour; flagged at the gate. */}
            <h1 className="mb-4 font-newsreader text-[32px] font-semibold leading-[1.15] text-white sm:text-[40px] md:mb-5 md:text-[52px]">
              {t('subtitle')}
            </h1>

            <p className="mb-5 font-jost text-[17px] font-light text-white/90 md:mb-7 md:text-[21px]">
              {t('joinThe')}{' '}
              <span className="whitespace-nowrap">
                <span className="font-etna text-[19px] tracking-wider md:text-[24px]">RENA</span>
                <span className="font-courier lowercase text-[18px] md:text-[22px]">-lution</span>
              </span>
            </p>

            <p className="mb-8 font-jost text-[13px] font-medium uppercase tracking-[0.14em] text-white/70 md:mb-10">
              <Link href="/cleaning" className="transition-colors hover:text-white">
                {t('coverage')}
              </Link>
            </p>

            <div className="mb-8 flex flex-col gap-3 sm:flex-row md:mb-10">
              <a
                href="/cleaners"
                className="rounded-md bg-primary px-7 py-3.5 text-center font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('bookCleaner')}
              </a>
              <a
                href="#how-it-works"
                className="rounded-md border border-white/30 px-7 py-3.5 text-center font-jost text-[14px] font-normal text-white transition-colors hover:border-white/50"
              >
                {t('howItWorks')}
              </a>
            </div>

            <div className="flex flex-wrap gap-4 md:gap-5">
              {trustItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-trust-on-dark/20">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      className="text-trust-on-dark"
                    >
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="currentColor"
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
