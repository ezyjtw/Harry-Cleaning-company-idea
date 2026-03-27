'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { getReviewsForCleaner } from '@/lib/mock-data';
import { getListedRate } from '@/lib/pricing';
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
    <div className="fixed inset-0 z-50 flex items-start justify-center fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 mt-10 mb-10 max-h-[calc(100vh-80px)] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] sm:mx-6 md:mt-16 slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-ink-3 shadow-sm ring-1 ring-ink/5 transition-all hover:bg-white hover:text-ink hover:shadow-md"
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

        {/* Scrollable content */}
        <div className="max-h-[calc(100vh-80px)] overflow-y-auto overscroll-contain">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-cream via-cream to-cream-2 px-7 pt-8 pb-7 sm:px-9 sm:pt-10 sm:pb-8">
            {/* Decorative accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ink via-ink-2 to-teal" />

            <div className="flex items-start gap-5">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-white font-cormorant text-[28px] font-semibold text-ink shadow-sm ring-1 ring-ink/5 sm:h-20 sm:w-20 sm:text-[32px]">
                {cleaner.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-cormorant text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">
                    {cleaner.name}
                  </h2>
                  <VerificationBadge
                    identityVerified={cleaner.identityVerified}
                    backgroundChecked={cleaner.backgroundChecked}
                    size="md"
                  />
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 font-jost text-[13px] font-light text-ink-3">
                  <svg
                    className="h-3.5 w-3.5 text-ink-3/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                  {cleaner.location}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <StarRating rating={cleaner.rating} />
                  <span className="font-jost text-[13px] font-light text-ink-2">
                    {cleaner.rating} ({cleaner.reviewCount} reviews)
                  </span>
                </div>
                {cleaner.availableNow && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1">
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
            <div className="mt-7 flex items-center justify-between rounded-xl bg-white/60 px-5 py-4 ring-1 ring-ink/5 backdrop-blur-sm">
              <div>
                <span className="font-jost text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
                  From
                </span>
                <div className="mt-0.5 flex items-baseline gap-0.5">
                  <span className="font-cormorant text-[30px] font-semibold text-ink">
                    &pound;{getListedRate(cleaner.hourlyRate)}
                  </span>
                  <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
                </div>
              </div>
              <Link
                href={`/book/${cleaner.id}`}
                className="rounded-xl bg-ink px-7 py-3 font-jost text-[13px] font-medium tracking-wide text-cream shadow-sm transition-all hover:bg-ink-2 hover:shadow-md active:scale-[0.98]"
              >
                Book now
              </Link>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-8 sm:px-9">
            {/* About */}
            <div>
              <h3 className="flex items-center gap-2 font-cormorant text-[18px] font-semibold text-ink">
                <svg
                  className="h-4 w-4 text-ink-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                About
              </h3>
              <p className="mt-3 font-jost text-[14px] font-light leading-[1.7] text-ink-2">
                {cleaner.bio}
              </p>
            </div>

            {/* Specialties */}
            <div className="mt-6 flex flex-wrap gap-2">
              {cleaner.specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-lg bg-cream px-3.5 py-1.5 font-jost text-[12px] font-medium text-ink-2 ring-1 ring-ink/5"
                >
                  {s}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  value: `${cleaner.yearsExperience}`,
                  label: 'Years exp.',
                  icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
                },
                {
                  value: `${cleaner.completedJobs}`,
                  label: 'Jobs done',
                  icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                },
                {
                  value: `${cleaner.rating}`,
                  label: 'Avg rating',
                  icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
                },
                {
                  value: cleaner.responseTime,
                  label: 'Response',
                  icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 rounded-xl bg-cream/60 px-3 py-4 ring-1 ring-ink/5"
                >
                  <svg
                    className="mb-1 h-4 w-4 text-ink-3/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                  <div className="font-cormorant text-[22px] font-semibold leading-none text-ink">
                    {stat.value}
                  </div>
                  <div className="font-jost text-[11px] font-light text-ink-3">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />

            {/* Detailed ratings */}
            <div>
              <h3 className="flex items-center gap-2 font-cormorant text-[18px] font-semibold text-ink">
                <svg
                  className="h-4 w-4 text-ink-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
                Detailed ratings
              </h3>
              <div className="mt-4 space-y-3.5">
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
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ink to-ink-2 transition-all duration-500"
                        style={{ width: `${(r.value / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-jost text-[13px] font-semibold text-ink">
                      {r.value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />

            {/* Availability */}
            <div>
              <h3 className="flex items-center gap-2 font-cormorant text-[18px] font-semibold text-ink">
                <svg
                  className="h-4 w-4 text-ink-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                Availability
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span
                    key={day}
                    className={`rounded-lg px-4 py-2 font-jost text-[12px] font-medium transition-colors ${
                      cleaner.availability.includes(day)
                        ? 'bg-ink text-cream shadow-sm'
                        : 'bg-cream/80 text-ink-3 ring-1 ring-ink/5'
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            {cleaner.languages.length > 0 && (
              <div className="mt-7">
                <h3 className="flex items-center gap-2 font-cormorant text-[18px] font-semibold text-ink">
                  <svg
                    className="h-4 w-4 text-ink-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
                    />
                  </svg>
                  Languages
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cleaner.languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded-lg bg-cream/80 px-3.5 py-1.5 font-jost text-[13px] font-light text-ink-2 ring-1 ring-ink/5"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {reviews.length > 0 && (
              <div className="my-8 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-cormorant text-[18px] font-semibold text-ink">
                  <svg
                    className="h-4 w-4 text-ink-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                  </svg>
                  Reviews ({reviews.length})
                </h3>
                <div className="mt-5 space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="rounded-xl bg-cream/40 p-5 ring-1 ring-ink/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-jost text-[12px] font-semibold text-ink ring-1 ring-ink/5">
                            {review.customerName.charAt(0)}
                          </div>
                          <span className="font-jost text-[13px] font-medium text-ink">
                            {review.customerName}
                          </span>
                          {review.verified && (
                            <span className="rounded-full bg-teal/10 px-2.5 py-0.5 font-jost text-[10px] font-medium text-teal ring-1 ring-teal/20">
                              Verified
                            </span>
                          )}
                        </div>
                        <span className="font-jost text-[11px] font-light text-ink-3">
                          {review.date}
                        </span>
                      </div>
                      <div className="mt-2">
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="mt-2.5 font-jost text-[13px] font-light leading-[1.7] text-ink-2">
                        {review.comment}
                      </p>
                      {review.cleanerReply && (
                        <div className="mt-3.5 rounded-lg bg-white px-4 py-3.5 ring-1 ring-ink/5">
                          <p className="font-jost text-[12px] font-medium text-ink">
                            {cleaner.name} replied
                          </p>
                          <p className="mt-1 font-jost text-[12px] font-light leading-relaxed text-ink-2">
                            {review.cleanerReply}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-9 flex flex-col items-center gap-4 border-t border-ink/5 pt-7">
              <Link
                href={`/cleaners/${cleaner.id}`}
                className="group flex items-center gap-2 font-jost text-[13px] font-medium text-ink transition-colors hover:text-ink-2"
              >
                View full profile page
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
