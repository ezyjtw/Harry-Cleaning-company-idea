import Link from 'next/link';

import type { Cleaner } from '@/lib/types';

import StarRating from './StarRating';
import VerificationBadge from './VerificationBadge';

interface CleanerCardProps {
  cleaner: Cleaner;
  onViewProfile?: () => void;
}

export default function CleanerCard({ cleaner, onViewProfile }: CleanerCardProps) {
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
            <VerificationBadge
              identityVerified={cleaner.identityVerified}
              backgroundChecked={cleaner.backgroundChecked}
            />
          </div>
          <p className="font-jost text-[12px] font-light text-ink-3">{cleaner.location}</p>
        </div>

        {/* Rate */}
        <div className="text-right">
          <span className="font-jost text-[20px] font-semibold text-ink">
            &pound;{cleaner.hourlyRate}
          </span>
          <span className="font-jost text-[11px] font-light text-ink-3">/hr</span>
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
