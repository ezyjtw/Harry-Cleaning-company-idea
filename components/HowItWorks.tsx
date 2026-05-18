'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

const SAMPLE_CLEANERS = [
  {
    name: 'Maria Santos',
    location: 'Barking, London',
    rating: 4.9,
    reviewCount: 520,
    hourlyRate: 18,
    bio: 'Professional cleaner with 8 years of experience. I take pride in leaving every home spotless and fresh.',
    specialties: ['Deep Cleaning', 'Regular Cleaning', 'Pet-Friendly'],
    yearsExperience: 8,
    completedJobs: 520,
    availableNow: true,
    verified: true,
  },
  {
    name: 'Katarzyna Nowak',
    location: 'Ilford, London',
    rating: 4.85,
    reviewCount: 245,
    hourlyRate: 15,
    bio: 'Reliable and efficient cleaner with 5 years UK experience. Fluent in Polish and English.',
    specialties: ['Regular Cleaning', 'Pet-Friendly'],
    yearsExperience: 5,
    completedJobs: 245,
    availableNow: false,
    verified: true,
  },
  {
    name: 'Elena Petrova',
    location: 'Romford, London',
    rating: 4.75,
    reviewCount: 178,
    hourlyRate: 17,
    bio: 'Attention to detail is my priority. I speak Bulgarian, Russian, and English.',
    specialties: ['Deep Cleaning', 'End of Tenancy'],
    yearsExperience: 4,
    completedJobs: 178,
    availableNow: true,
    verified: true,
  },
  {
    name: 'Agnieszka Kowalska',
    location: 'Dagenham, London',
    rating: 4.92,
    reviewCount: 402,
    hourlyRate: 16,
    bio: 'Hard-working cleaner from Poland. 7 years experience in London homes. Spotless finish every time.',
    specialties: ['Regular Cleaning', 'Deep Cleaning', 'Airbnb'],
    yearsExperience: 7,
    completedJobs: 402,
    availableNow: false,
    verified: true,
  },
  {
    name: 'Aisha Johnson',
    location: 'Chelmsford, Essex',
    rating: 4.7,
    reviewCount: 189,
    hourlyRate: 20,
    bio: 'Experienced in end-of-tenancy and Airbnb turnovers. Fast, thorough, and always on time.',
    specialties: ['End of Tenancy', 'Airbnb Cleaning'],
    yearsExperience: 6,
    completedJobs: 189,
    availableNow: true,
    verified: true,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'text-gold' : 'text-ink/10'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function MiniCleanerCard({ cleaner }: { cleaner: (typeof SAMPLE_CLEANERS)[number] }) {
  return (
    <div
      className="w-[280px] shrink-0 rounded-lg bg-white p-5 shadow-sm"
      style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream font-jost text-[16px] font-semibold text-ink">
          {cleaner.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate font-jost text-[14px] font-medium uppercase text-ink">
              {cleaner.name}
            </h4>
            {cleaner.verified && (
              <svg
                className="h-3.5 w-3.5 shrink-0 text-teal"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="font-jost text-[11px] font-light text-ink-3">{cleaner.location}</p>
        </div>
        <div className="text-right">
          <span className="font-jost text-[16px] font-semibold text-ink">
            &pound;{cleaner.hourlyRate}
          </span>
          <span className="font-jost text-[10px] font-light text-ink-3">/hr</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <StarRating rating={cleaner.rating} />
        <span className="font-jost text-[11px] font-light text-ink-2">
          {cleaner.rating} ({cleaner.reviewCount})
        </span>
        {cleaner.availableNow && (
          <span className="ml-auto flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
            <span className="font-jost text-[10px] font-medium text-teal">Available today</span>
          </span>
        )}
      </div>

      <p className="mb-3 line-clamp-2 font-jost text-[12px] font-light leading-relaxed text-ink-2">
        {cleaner.bio}
      </p>

      <div className="flex flex-wrap gap-1">
        {cleaner.specialties.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-full bg-cream px-2.5 py-0.5 font-jost text-[10px] font-medium text-ink-2"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function CleanerCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener('scroll', updateButtons, { passive: true });
    return () => el.removeEventListener('scroll', updateButtons);
  }, [updateButtons]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {SAMPLE_CLEANERS.map((cleaner) => (
          <MiniCleanerCard key={cleaner.name} cleaner={cleaner} />
        ))}
      </div>

      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute -left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-cream"
          style={{ border: '0.5px solid rgba(27,42,74,0.1)' }}
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-cream"
          style={{ border: '0.5px solid rgba(27,42,74,0.1)' }}
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function HowItWorks() {
  const t = useTranslations('HowItWorks');

  return (
    <section id="how-it-works" className="bg-cream">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-gold">
          {t('sectionTitle')}
        </p>
        <h2 className="mb-10 font-cormorant text-[32px] font-light leading-tight text-ink md:mb-14 md:text-[42px]">
          {t('sectionSubtitle')}
        </h2>

        <div className="grid grid-cols-1 gap-14 md:gap-16">
          {/* Step 1 — Enter your postcode */}
          <div>
            <div className="mb-6 flex items-baseline gap-4">
              <span className="font-cormorant text-[64px] font-semibold leading-none text-ink/10 md:text-[72px]">
                01
              </span>
              <div>
                <div className="mb-1 h-[2px] w-8 rounded bg-gold" />
                <h3 className="font-jost text-[16px] font-semibold text-ink">{t('step1Title')}</h3>
              </div>
            </div>
            <p className="mb-6 max-w-[600px] font-jost text-[14px] font-light leading-[1.7] text-ink-3">
              {t('step1Description')}
            </p>
            <div
              className="max-w-[500px] overflow-hidden rounded-lg shadow-sm"
              style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
            >
              <Image
                src="/images/Enter your postcode.png"
                alt="Enter your postcode to find cleaners near you"
                width={500}
                height={280}
                className="w-full object-cover"
              />
            </div>
          </div>

          {/* Step 2 — Choose someone you trust */}
          <div>
            <div className="mb-6 flex items-baseline gap-4">
              <span className="font-cormorant text-[64px] font-semibold leading-none text-ink/10 md:text-[72px]">
                02
              </span>
              <div>
                <div className="mb-1 h-[2px] w-8 rounded bg-gold" />
                <h3 className="font-jost text-[16px] font-semibold text-ink">{t('step2Title')}</h3>
              </div>
            </div>
            <p className="mb-6 max-w-[600px] font-jost text-[14px] font-light leading-[1.7] text-ink-3">
              {t('step2Description')}
            </p>
            <CleanerCarousel />
          </div>

          {/* Step 3 — They arrive, you relax */}
          <div>
            <div className="mb-6 flex items-baseline gap-4">
              <span className="font-cormorant text-[64px] font-semibold leading-none text-ink/10 md:text-[72px]">
                03
              </span>
              <div>
                <div className="mb-1 h-[2px] w-8 rounded bg-gold" />
                <h3 className="font-jost text-[16px] font-semibold text-ink">{t('step3Title')}</h3>
              </div>
            </div>
            <p className="mb-6 max-w-[600px] font-jost text-[14px] font-light leading-[1.7] text-ink-3">
              {t('step3Description')}
            </p>
            <div
              className="flex h-[200px] max-w-[500px] items-center justify-center rounded-lg bg-white md:h-[280px]"
              style={{ border: '1px dashed rgba(27,42,74,0.15)' }}
            >
              <div className="text-center">
                <svg
                  className="mx-auto mb-3 h-10 w-10 text-ink/15"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                  />
                </svg>
                <p className="font-jost text-[13px] text-ink-3">Image placeholder</p>
                <p className="mt-1 font-jost text-[11px] text-ink-3/60">
                  Add your image to /public/images/
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
