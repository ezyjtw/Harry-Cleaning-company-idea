import Link from 'next/link';

import type { Cleaner } from '@/lib/types';

import CleanerIdentity from './CleanerIdentity';

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
      <CleanerIdentity
        photo={cleaner.photo}
        name={cleaner.name}
        verified={isVerified}
        rating={cleaner.rating}
        reviewCount={cleaner.reviewCount}
        meta={
          <>
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
          </>
        }
      >
        {cleaner.availableNow && (
          <span className="mt-1.5 inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-trust" />
            </span>
            <span className="font-jost text-[11px] font-medium text-ink">Available today</span>
          </span>
        )}
      </CleanerIdentity>

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
