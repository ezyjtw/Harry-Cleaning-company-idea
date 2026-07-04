'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import CleanerAvatar from '../src/components/CleanerAvatar';
import StarRating from '../src/components/StarRating';

interface MiniCleaner {
  id: string | null; // null = curated fallback (no real profile)
  name: string;
  photo: string | null;
  rating: number;
  reviewCount: number;
  location: string;
  fromPrice: number | null;
}

// Curated fallback — only ever shown if the live fetch fails or returns nothing,
// rendered through the IDENTICAL mini-card. id=null so taps route to browse.
const SAMPLE_CLEANERS: MiniCleaner[] = [
  {
    id: null,
    name: 'Maria Santos',
    photo: null,
    rating: 4.9,
    reviewCount: 520,
    location: 'Barking, London',
    fromPrice: 18,
  },
  {
    id: null,
    name: 'Katarzyna Nowak',
    photo: null,
    rating: 4.85,
    reviewCount: 245,
    location: 'Ilford, London',
    fromPrice: 15,
  },
  {
    id: null,
    name: 'Elena Petrova',
    photo: null,
    rating: 4.75,
    reviewCount: 178,
    location: 'Romford, London',
    fromPrice: 17,
  },
  {
    id: null,
    name: 'Agnieszka Kowalska',
    photo: null,
    rating: 4.92,
    reviewCount: 402,
    location: 'Dagenham, London',
    fromPrice: 16,
  },
  {
    id: null,
    name: 'Aisha Johnson',
    photo: null,
    rating: 4.7,
    reviewCount: 189,
    location: 'Chelmsford, Essex',
    fromPrice: 20,
  },
  {
    id: null,
    name: 'Sofia Dimitrova',
    photo: null,
    rating: 4.88,
    reviewCount: 310,
    location: 'Stratford, London',
    fromPrice: 19,
  },
];

const PAGE_SIZE = 6;

function MiniCard({ c }: { c: MiniCleaner }) {
  const firstName = c.name.split(' ')[0];
  const href = c.id ? `/cleaners/${c.id}` : '/cleaners';
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface p-3 text-center transition-colors hover:bg-page"
    >
      <CleanerAvatar photo={c.photo} name={c.name} size={44} />
      <p className="mt-1 w-full truncate font-jost text-[12px] font-medium text-ink">{firstName}</p>
      {c.reviewCount > 0 ? (
        <span className="flex items-center gap-1">
          <StarRating rating={c.rating} />
          <span className="font-jost text-[10px] font-light text-ink-3">{c.rating}</span>
        </span>
      ) : (
        <span className="font-jost text-[10px] font-light text-ink-3">New to Rena</span>
      )}
      <p className="w-full truncate font-jost text-[10px] font-light text-ink-3">{c.location}</p>
      {c.fromPrice !== null && (
        <p className="font-jost text-[11px] font-medium text-ink-2">from £{c.fromPrice}</p>
      )}
    </Link>
  );
}

function LiveCleanerGrid() {
  const [cleaners, setCleaners] = useState<MiniCleaner[]>(SAMPLE_CLEANERS);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cleaners?limit=${PAGE_SIZE * 3}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const raw = Array.isArray(data?.cleaners) ? data.cleaners : [];
        const mapped: MiniCleaner[] = raw.map((c: Record<string, unknown>) => ({
          id: (c.id as string) ?? null,
          name: (c.name as string) || 'Cleaner',
          photo: ((c.photo || c.image) as string) || null,
          rating: (c.rating as number) || 0,
          reviewCount: (c.reviewCount as number) || 0,
          location: (c.location as string) || '',
          fromPrice: (c.hourlyRateRegular as number) ?? (c.hourlyRateDeep as number) ?? null,
        }));
        // Never empty, never broken — fall back to the curated set.
        if (mapped.length > 0) setCleaners(mapped);
      })
      .catch(() => {
        /* keep the curated fallback already in state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(cleaners.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = cleaners.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="rounded-md border border-line bg-page p-3">
      {/* 2 rows × 3 cols on desktop; collapses to 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((c, i) => (
          <MiniCard key={c.id ?? `sample-${safePage}-${i}`} c={c} />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: pageCount }, (_, i) => (
              <span
                key={i}
                className={`h-[6px] rounded-full transition-all ${
                  i === safePage ? 'w-4 bg-primary' : 'w-[6px] bg-ink/15'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => (p === 0 ? pageCount - 1 : p - 1))}
              aria-label="Previous cleaners"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-page"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => (p === pageCount - 1 ? 0 : p + 1))}
              aria-label="More cleaners"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-page"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
 * 4:5 media slot for the step screenshots (steps 1 & 3). Replace the PNG at the
 * given path via GitHub upload and it renders automatically.
 */
function StepMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-[4/5] overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <Image src={src} alt={alt} width={380} height={475} className="h-full w-full object-cover" />
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

          {/* Step 2 — choose someone you trust (live cleaner grid-carousel) */}
          <div className="flex flex-col">
            <StepHead n="02" title={t('step2Title')} />
            <p className="mb-4 font-jost text-[14px] font-light leading-[1.7] text-ink-3 md:min-h-[96px]">
              {t('step2Description')}
            </p>
            <LiveCleanerGrid />
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
