import Link from 'next/link';

import type { Cleaner } from '@/lib/types';

import StarRating from './StarRating';

interface CleanerCardProps {
  cleaner: Cleaner;
  onViewProfile?: () => void;
  /** For EOT/Airbnb: show fixed price + 6% service fee instead of hourly rate */
  fixedServicePrice?: number | null;
  /** Label like "2-bed EOT" to display alongside fixed price */
  fixedServiceLabel?: string;
  /** Distance in miles from customer's search postcode */
  distance?: number | null;
  /** Customer's search postcode — forwarded to /book so the address step
   *  auto-looks-up without re-entry. */
  postcode?: string;
}

/** Green circle-check, pinned to the headshot's bottom-right. */
function VerifiedCheck() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white"
      aria-label="Verified"
    >
      <svg className="h-5 w-5 text-trust" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function CleanerCard({
  cleaner,
  onViewProfile,
  fixedServicePrice,
  fixedServiceLabel,
  distance,
  postcode,
}: CleanerCardProps) {
  const isVerified = cleaner.identityVerified || cleaner.backgroundChecked;
  const hasFixed = fixedServicePrice !== null && fixedServicePrice !== undefined;
  const fixedWithFee = hasFixed
    ? (Math.round((fixedServicePrice as number) * 1.06 * 100) / 100).toFixed(2)
    : null;

  return (
    <div
      className="group flex cursor-pointer flex-col rounded-[16px] border border-line bg-surface p-5 transition-shadow hover:shadow-md"
      onClick={onViewProfile}
    >
      <div className="flex items-start gap-4">
        {/* 80px headshot — photo if present, else serif initial on primary-soft */}
        <div className="relative shrink-0">
          {cleaner.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cleaner.photo}
              alt={cleaner.name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft font-newsreader text-[30px] font-medium text-primary">
              {cleaner.name.charAt(0)}
            </div>
          )}
          {isVerified && <VerifiedCheck />}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-newsreader text-[19px] font-semibold text-ink">
            {cleaner.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <StarRating rating={cleaner.rating} />
            <span className="font-jost text-[12px] font-light text-ink-2">
              {cleaner.rating} ({cleaner.reviewCount})
            </span>
          </div>
          <p className="mt-1 font-jost text-[12.5px] text-ink-3">
            {cleaner.location}
            {hasFixed ? (
              <>
                {' · '}
                <span className="font-newsreader text-[14px] font-medium text-ink">
                  £{fixedWithFee}
                </span>{' '}
                <span className="text-ink-3">incl. fee</span>
              </>
            ) : (
              <>
                {' · from '}
                <span className="font-newsreader text-[14px] font-medium text-ink">
                  £{(cleaner.hourlyRateRegular ?? 0).toFixed(2)}
                </span>
                <span className="text-ink-3">/hr</span>
              </>
            )}
          </p>
          {cleaner.availableNow && (
            <span className="mt-1.5 inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-trust" />
              </span>
              <span className="font-jost text-[11px] font-medium text-ink">Available today</span>
            </span>
          )}
        </div>
      </div>

      {hasFixed && fixedServiceLabel && (
        <p className="mt-3 rounded-[8px] bg-primary-soft px-3 py-2 font-jost text-[12px] font-medium text-ink">
          Total for your {fixedServiceLabel}: £{fixedWithFee}
          <span className="font-light text-ink-3"> · incl. 6% service fee</span>
        </p>
      )}

      {distance !== null && distance !== undefined && (
        <p className="mt-2 font-jost text-[11px] font-light text-ink-3">{distance} mi away</p>
      )}

      <p className="mt-3 line-clamp-2 font-jost text-[13px] font-light leading-relaxed text-ink-2">
        {cleaner.bio}
      </p>

      <Link
        href={
          postcode
            ? `/book/${cleaner.id}?postcode=${encodeURIComponent(postcode)}`
            : `/book/${cleaner.id}`
        }
        onClick={(e) => e.stopPropagation()}
        className="mt-4 block rounded-[10px] bg-primary px-4 py-3 text-center font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
      >
        Book now
      </Link>
    </div>
  );
}
