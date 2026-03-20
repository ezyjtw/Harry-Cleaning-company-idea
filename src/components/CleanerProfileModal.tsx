'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { getReviewsForCleaner } from '@/lib/mock-data';
import type { Cleaner } from '@/lib/types';

import StarRating from './StarRating';
import VerificationBadge from './VerificationBadge';

interface CleanerProfileModalProps {
  cleaner: Cleaner;
  onClose: () => void;
}

export default function CleanerProfileModal({ cleaner, onClose }: CleanerProfileModalProps) {
  const reviews = getReviewsForCleaner(cleaner.id);

  // Lock body scroll & handle escape
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 mt-8 mb-8 max-h-[calc(100vh-64px)] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:mx-6 md:mt-12">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center text-ink-3 transition-colors hover:text-ink"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-cream px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white font-cormorant text-[26px] font-semibold text-ink sm:h-20 sm:w-20 sm:text-[32px]">
              {cleaner.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-cormorant text-[26px] font-semibold leading-tight text-ink sm:text-[32px]">
                  {cleaner.name}
                </h2>
                <VerificationBadge
                  identityVerified={cleaner.identityVerified}
                  backgroundChecked={cleaner.backgroundChecked}
                  size="md"
                />
              </div>
              <p className="mt-1 font-jost text-[13px] font-light text-ink-3">{cleaner.location}</p>
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={cleaner.rating} />
                <span className="font-jost text-[13px] font-light text-ink-2">
                  {cleaner.rating} ({cleaner.reviewCount} reviews)
                </span>
              </div>
              {cleaner.availableNow && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                  </span>
                  <span className="font-jost text-[12px] font-medium text-teal">
                    Available today &middot; responds in {cleaner.responseTime}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Price + book */}
          <div className="mt-6 flex items-end justify-between">
            <div>
              <span className="font-cormorant text-[28px] font-semibold text-ink">
                &pound;{cleaner.hourlyRate}
              </span>
              <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/book/${cleaner.id}`}
                className="rounded-md bg-ink px-5 py-2.5 font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
              >
                Book now
              </Link>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8 sm:px-8">
          {/* About */}
          <p className="font-jost text-[14px] font-light leading-relaxed text-ink-2">
            {cleaner.bio}
          </p>

          {/* Specialties */}
          <div className="mt-5 flex flex-wrap gap-2">
            {cleaner.specialties.map((s) => (
              <span
                key={s}
                className="rounded-full bg-cream px-3 py-1 font-jost text-[12px] font-medium text-ink-2"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: `${cleaner.yearsExperience}`, label: 'Years experience' },
              { value: `${cleaner.completedJobs}`, label: 'Jobs completed' },
              { value: `${cleaner.rating}`, label: 'Avg rating' },
              { value: cleaner.responseTime, label: 'Response time' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-cormorant text-[24px] font-semibold text-ink">
                  {stat.value}
                </div>
                <div className="font-jost text-[11px] font-light text-ink-3">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Detailed ratings */}
          <div className="mt-8">
            <h3 className="font-cormorant text-[18px] font-semibold text-ink">Detailed ratings</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Thoroughness', value: cleaner.categoryRatings.thoroughness },
                { label: 'Punctuality', value: cleaner.categoryRatings.punctuality },
                { label: 'Communication', value: cleaner.categoryRatings.communication },
                { label: 'Value for money', value: cleaner.categoryRatings.value },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-28 font-jost text-[13px] font-light text-ink-2">
                    {r.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-2">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${(r.value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-jost text-[13px] font-medium text-ink">
                    {r.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="mt-8">
            <h3 className="font-cormorant text-[18px] font-semibold text-ink">Availability</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span
                  key={day}
                  className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium ${
                    cleaner.availability.includes(day) ? 'bg-ink text-cream' : 'bg-cream text-ink-3'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          {/* Languages */}
          {cleaner.languages.length > 0 && (
            <div className="mt-6">
              <h3 className="font-cormorant text-[18px] font-semibold text-ink">Languages</h3>
              <p className="mt-2 font-jost text-[13px] font-light text-ink-2">
                {cleaner.languages.join(', ')}
              </p>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="mt-8">
              <h3 className="font-cormorant text-[18px] font-semibold text-ink">
                Reviews ({reviews.length})
              </h3>
              <div className="mt-4 space-y-4">
                {reviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="border-t border-ink/5 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-jost text-[13px] font-medium text-ink">
                          {review.customerName}
                        </span>
                        {review.verified && (
                          <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-teal">
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="font-jost text-[11px] font-light text-ink-3">
                        {review.date}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="mt-2 font-jost text-[13px] font-light leading-relaxed text-ink-2">
                      {review.comment}
                    </p>
                    {review.cleanerReply && (
                      <div className="mt-3 rounded-md bg-cream px-4 py-3">
                        <p className="font-jost text-[12px] font-medium text-ink">
                          {cleaner.name} replied
                        </p>
                        <p className="mt-1 font-jost text-[12px] font-light text-ink-2">
                          {review.cleanerReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View full profile link */}
          <div className="mt-8 border-t border-ink/5 pt-6 text-center">
            <Link
              href={`/cleaners/${cleaner.id}`}
              className="font-jost text-[13px] font-medium text-ink underline underline-offset-4 transition-colors hover:text-ink-2"
            >
              View full profile page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
