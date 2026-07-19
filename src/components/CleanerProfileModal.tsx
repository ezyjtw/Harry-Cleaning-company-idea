'use client';

import { useEffect, useState } from 'react';

import { serviceTypeLabel } from '@/lib/constants/services';
import type { Cleaner } from '@/lib/types';

import { buildBookUrl } from './CleanerCard';
import CleanerProfileView, {
  type CleanerProfileData,
  type ProfileService,
  type ProfileReviewItem,
} from './CleanerProfileView';

interface ReviewData {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
  cleanerReply?: string;
  categoryRatings: {
    thoroughness: number;
    punctuality: number;
    communication: number;
  };
}

interface CleanerProfileModalProps {
  cleaner: Cleaner;
  onClose: () => void;
  /** Customer's search postcode — forwarded to /book so the address step
   *  auto-looks-up without re-entry. */
  postcode?: string;
  /** Bedrooms from the quote widget / directory — forwarded to /book (B3). */
  bedrooms?: number | null;
  /** Backup-picker context only: when provided, a "Select as backup" footer
   *  button renders, calling this (the same selection handler as the bench). */
  onSelectBackup?: () => void;
  isSelectedBackup?: boolean;
  /** In-flow context (e.g. the wizard browse step): the profile's "Book" button
   *  calls this instead of navigating to /book. */
  onBook?: () => void;
  bookLabel?: string;
}

function minPrice(map?: Record<string, number>): number | null {
  if (!map) return null;
  const vals = Object.values(map).filter((n) => typeof n === 'number' && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

export default function CleanerProfileModal({
  cleaner,
  onClose,
  postcode,
  bedrooms,
  onSelectBackup,
  isSelectedBackup,
  onBook,
  bookLabel,
}: CleanerProfileModalProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  // H28: verified imported reviews, shown in their own labelled section.
  const [importedReviews, setImportedReviews] = useState<
    {
      id: string;
      rating: number;
      text: string | null;
      source: string;
      reviewerName: string | null;
    }[]
  >([]);

  useEffect(() => {
    fetch(`/api/cleaners/${cleaner.id}/reviews`)
      .then((res) => (res.ok ? res.json() : { reviews: [], imported: [] }))
      .then((payload: { reviews?: Array<Record<string, unknown>>; imported?: [] } | []) => {
        // Endpoint shape moved from bare array → {reviews, imported} (H28);
        // tolerate both so a cached client never crashes mid-deploy.
        const data = Array.isArray(payload) ? payload : (payload.reviews ?? []);
        setImportedReviews(Array.isArray(payload) ? [] : (payload.imported ?? []));
        setReviews(
          data.map((r) => ({
            id: r.id as string,
            customerName: ((r.client as Record<string, unknown>)?.name as string) || 'Customer',
            rating: Number(r.rating),
            comment: (r.text as string) || '',
            date: new Date(r.createdAt as string).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            verified: (r.isVerifiedBooking as boolean) || false,
            cleanerReply: (r.reply as string) || undefined,
            categoryRatings: {
              thoroughness: Number(r.thoroughness || 0),
              punctuality: Number(r.punctuality || 0),
              communication: Number(r.communication || 0),
            },
          }))
        );
      })
      .catch(() => setReviews([]));
  }, [cleaner.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Sub-rating bars aggregated from the fetched reviews that carry sub-ratings.
  const rated = reviews.filter((r) => r.categoryRatings.thoroughness > 0);
  const avg = (pick: (r: ReviewData) => number) =>
    rated.length ? rated.reduce((s, r) => s + pick(r), 0) / rated.length : 0;
  const ratings = rated.length
    ? [
        { label: 'Thoroughness', value: avg((r) => r.categoryRatings.thoroughness) },
        { label: 'Punctuality', value: avg((r) => r.categoryRatings.punctuality) },
        { label: 'Communication', value: avg((r) => r.categoryRatings.communication) },
        // B7 (James-ruled): no value-for-money row — not collected by the form.
      ]
    : null;

  const st = cleaner.serviceTypes || [];
  const services: ProfileService[] = [];
  if (st.includes('regular') && cleaner.hourlyRateRegular)
    services.push({
      label: serviceTypeLabel('regular'),
      price: `£${cleaner.hourlyRateRegular.toFixed(2)}/hr`,
    });
  if (st.includes('deep') && cleaner.hourlyRateDeep)
    services.push({
      label: serviceTypeLabel('deep'),
      price: `£${cleaner.hourlyRateDeep.toFixed(2)}/hr`,
    });
  if (st.includes('same_day') && cleaner.hourlyRateSameDay)
    services.push({
      label: serviceTypeLabel('same_day'),
      price: `£${cleaner.hourlyRateSameDay.toFixed(2)}/hr`,
      soon: true,
    });
  {
    const m = st.includes('end_of_tenancy') ? minPrice(cleaner.eotPrices) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('end_of_tenancy'), price: `from £${m.toFixed(2)}` });
  }
  {
    const m = st.includes('airbnb') ? minPrice(cleaner.airbnbPrices) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('airbnb'), price: `from £${m.toFixed(2)}` });
  }

  const reviewItems: ProfileReviewItem[] = reviews.map((r) => ({
    id: r.id,
    name: r.customerName,
    rating: r.rating,
    text: r.comment,
    date: r.date,
    verified: r.verified,
    reply: r.cleanerReply,
  }));

  const data: CleanerProfileData = {
    id: cleaner.id,
    name: cleaner.name,
    photo: cleaner.photo || null,
    location: cleaner.location,
    rating: cleaner.rating,
    reviewCount: cleaner.reviewCount,
    idVerified: cleaner.identityVerified,
    insured: cleaner.insured,
    backgroundChecked: cleaner.backgroundChecked,
    fromPrice: cleaner.hourlyRateRegular ?? cleaner.hourlyRateDeep ?? null,
    bookHref: buildBookUrl(cleaner.id, postcode, bedrooms),
    founding: cleaner.founding,
    onBook,
    bookLabel,
    about: cleaner.bio,
    ratings,
    // H25: population label + imported footnote — the fetched imports are now
    // the direct truth (H28), no count inference needed.
    subRatedCount: rated.length,
    hasImportedReviews: importedReviews.length > 0,
    // H28: separated section beneath the Rena reviews.
    importedReviews: importedReviews.map((r) => ({
      id: r.id,
      name: r.reviewerName || 'Reviewer',
      rating: r.rating,
      text: r.text || '',
      source: r.source,
    })),
    experience: {
      years: cleaner.yearsExperience || null,
      jobs: cleaner.completedJobs,
    },
    languages: cleaner.languages || [],
    services,
    reviews: reviewItems,
    reviewsSubtitle: 'Only verified customers who completed a booking can leave reviews.',
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-md" onClick={onClose} />
      <div className="slide-up relative z-10 mx-4 mb-10 mt-10 flex max-h-[calc(100vh-80px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] sm:mx-6 md:mt-16">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-ink-3 shadow-sm ring-1 ring-ink/5 backdrop-blur-sm transition-all hover:bg-white hover:text-ink hover:shadow-md"
          aria-label="Close"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <CleanerProfileView data={data} />
        </div>
        {onSelectBackup && (
          <div className="shrink-0 border-t border-line bg-surface p-4">
            <button
              type="button"
              onClick={onSelectBackup}
              className={`w-full rounded-[10px] px-6 py-2.5 font-jost text-sm font-semibold transition-colors ${
                isSelectedBackup
                  ? 'border border-primary bg-primary-soft text-primary'
                  : 'bg-primary text-white hover:bg-primary-hover'
              }`}
            >
              {isSelectedBackup ? '✓ Selected as backup' : 'Select as backup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
