'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import CleanerIdentity from '../src/components/CleanerIdentity';

// Curated marketing showcase (not live data) — rendered through the real
// CleanerIdentity J-card grammar so it reads exactly like the browse experience.
const SAMPLE_CLEANERS = [
  {
    name: 'Maria Santos',
    location: 'Barking, London',
    rating: 4.9,
    reviewCount: 520,
    hourlyRate: 18,
  },
  {
    name: 'Agnieszka Kowalska',
    location: 'Dagenham, London',
    rating: 4.92,
    reviewCount: 402,
    hourlyRate: 16,
  },
  {
    name: 'Sofia Dimitrova',
    location: 'Stratford, London',
    rating: 4.88,
    reviewCount: 310,
    hourlyRate: 19,
  },
];

/** Editorial step numeral + divider — retokened, kept from the old layout. */
function StepHead({ n, title }: { n: string; title: string }) {
  return (
    <>
      <div className="mb-5 font-newsreader text-[64px] font-semibold leading-none text-ink/10 md:text-[72px]">
        {n}
      </div>
      <div className="mb-5 h-[2px] w-8 rounded bg-primary" />
      <h3 className="mb-2.5 font-newsreader text-[16px] font-semibold text-ink">{title}</h3>
    </>
  );
}

/**
 * A 4:5 media slot for the step screenshots. James is generating how-step-1.png
 * (hand holding an iPhone on the Rena browse page) and how-step-3.png (the C2
 * booking-confirmation screen). Until an asset lands, `src` is left null and a
 * clean muted placeholder renders (no dev text) — swap null → the path and the
 * <Image> takes over.
 */
function StepMedia({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      <div className="aspect-[4/5] overflow-hidden rounded-md border border-line bg-surface shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={380}
          height={475}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-line bg-primary-soft">
      <svg
        className="h-10 w-10 text-primary/25"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.25}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const t = useTranslations('HowItWorks');

  return (
    <section id="how-it-works" className="bg-page">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-primary">
          {t('sectionTitle')}
        </p>
        <h2 className="mb-10 font-newsreader text-[24px] font-semibold leading-tight text-ink md:mb-14 md:text-[32px]">
          <span className="font-etna tracking-wider">RENA</span> {t('sectionSubtitle')}
        </h2>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {/* Step 1 — enter your postcode / browse */}
          <div className="flex flex-col">
            <StepHead n="01" title={t('step1Title')} />
            <p className="mb-4 font-jost text-[14px] font-light leading-[1.7] text-ink-3 md:min-h-[96px]">
              {t('step1Description')}
            </p>
            <StepMedia src="/images/how-step-1.png" alt="Browsing cleaners on the Rena app" />
          </div>

          {/* Step 2 — choose someone you trust (real card grammar) */}
          <div className="flex flex-col">
            <StepHead n="02" title={t('step2Title')} />
            <p className="mb-4 font-jost text-[14px] font-light leading-[1.7] text-ink-3 md:min-h-[96px]">
              {t('step2Description')}
            </p>
            <div className="flex aspect-[4/5] flex-col justify-center gap-3 rounded-md border border-line bg-surface p-4 shadow-sm">
              {SAMPLE_CLEANERS.map((c) => (
                <CleanerIdentity
                  key={c.name}
                  photo={null}
                  name={c.name}
                  verified
                  rating={c.rating}
                  reviewCount={c.reviewCount}
                  meta={
                    <>
                      {c.location} · £{c.hourlyRate}/hr
                    </>
                  }
                />
              ))}
            </div>
          </div>

          {/* Step 3 — they arrive, you relax */}
          <div className="flex flex-col">
            <StepHead n="03" title={t('step3Title')} />
            <p className="mb-4 font-jost text-[14px] font-light leading-[1.7] text-ink-3 md:min-h-[96px]">
              {t('step3Description')}
            </p>
            <StepMedia src="/images/how-step-3.png" alt="Your booking confirmed in the Rena app" />
          </div>
        </div>
      </div>
    </section>
  );
}
