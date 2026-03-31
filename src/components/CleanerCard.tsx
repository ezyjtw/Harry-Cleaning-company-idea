import Link from 'next/link';

import { getListedRate } from '@/lib/pricing';
import type { Cleaner } from '@/lib/types';

import StarRating from './StarRating';

interface CleanerCardProps {
  cleaner: Cleaner;
  onViewProfile?: () => void;
  /** For EOT/Airbnb: show fixed price + 6% service fee instead of hourly rate */
  fixedServicePrice?: number | null;
  /** Label like "2-bed EOT" to display alongside fixed price */
  fixedServiceLabel?: string;
}

export default function CleanerCard({
  cleaner,
  onViewProfile,
  fixedServicePrice,
  fixedServiceLabel,
}: CleanerCardProps) {
  return (
    <div
      className="group flex cursor-pointer flex-col bg-white transition-shadow hover:shadow-md"
      style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
      onClick={onViewProfile}
    >
      {/* Top section */}
      <div className="flex items-start gap-4 px-5 pt-5 pb-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream font-jost text-[18px] font-semibold text-ink">
          {cleaner.name.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-jost text-[16px] font-medium text-ink">{cleaner.name}</h3>
            {(cleaner.identityVerified || cleaner.backgroundChecked) && (
              <svg
                className="h-4 w-4 shrink-0 text-teal"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-label="Verified"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="font-jost text-[12px] font-light text-ink-3">{cleaner.location}</p>
        </div>

        {/* Rate */}
        <div className="text-right">
          {fixedServicePrice !== null && fixedServicePrice !== undefined ? (
            <>
              <span className="font-jost text-[20px] font-semibold text-ink">
                &pound;{(Math.round(fixedServicePrice * 1.06 * 100) / 100).toFixed(2)}
              </span>
              <p className="font-jost text-[10px] font-light text-ink-3">incl. 6% fee</p>
            </>
          ) : (
            <>
              <span className="font-jost text-[20px] font-semibold text-ink">
                &pound;{getListedRate(cleaner.hourlyRate).toFixed(2)}
              </span>
              <span className="font-jost text-[11px] font-light text-ink-3">/hr</span>
            </>
          )}
        </div>
      </div>

      {/* Rating row */}
      <div className="flex items-center gap-2 px-5">
        <StarRating rating={cleaner.rating} />
        <span className="font-jost text-[12px] font-light text-ink-2">
          {cleaner.rating} ({cleaner.reviewCount})
        </span>
        {cleaner.availableNow && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            <span className="font-jost text-[11px] font-medium text-teal">Available today</span>
          </span>
        )}
      </div>

      {/* Fixed service price label */}
      {fixedServicePrice !== null && fixedServicePrice !== undefined && fixedServiceLabel && (
        <div
          className="mt-3 mx-5 rounded bg-gold/5 px-3 py-2"
          style={{ border: '0.5px solid rgba(184,151,90,0.15)' }}
        >
          <p className="font-jost text-[12px] font-medium text-ink">
            Total for your {fixedServiceLabel}: &pound;
            {(Math.round(fixedServicePrice * 1.06 * 100) / 100).toFixed(2)}
          </p>
          <p className="font-jost text-[10px] font-light text-ink-3">Includes 6% service fee</p>
        </div>
      )}

      {/* Bio */}
      <p className="mt-3 line-clamp-2 px-5 font-jost text-[13px] font-light leading-relaxed text-ink-2">
        {cleaner.bio}
      </p>

      {/* Specialties */}
      <div className="mt-3 flex flex-wrap gap-1.5 px-5">
        {cleaner.specialties.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-full bg-cream px-3 py-1 font-jost text-[11px] font-medium text-ink-2"
          >
            {s}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-ink/5 px-5 py-3 mt-4">
        <span className="font-jost text-[11px] font-light text-ink-3">
          {cleaner.yearsExperience} yrs experience &middot; {cleaner.completedJobs} jobs
        </span>
        <Link
          href={`/book/${cleaner.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-jost text-[11px] font-medium uppercase tracking-[0.1em] text-ink underline underline-offset-4 transition-colors hover:text-ink-2"
        >
          Book now
        </Link>
      </div>
    </div>
  );
}
