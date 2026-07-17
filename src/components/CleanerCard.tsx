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
  /** Bedrooms from the quote widget / directory — forwarded to /book so the
   *  property size is pre-selected (B3). */
  bedrooms?: number | null;
}

export function buildBookUrl(
  cleanerId: string,
  postcode?: string,
  bedrooms?: number | null
): string {
  const params = new URLSearchParams();
  if (postcode) params.set('postcode', postcode);
  if (bedrooms !== null && bedrooms !== undefined) params.set('bedrooms', String(bedrooms));
  const qs = params.toString();
  return qs ? `/book/${cleanerId}?${qs}` : `/book/${cleanerId}`;
}

export default function CleanerCard({
  cleaner,
  onViewProfile,
  fixedServicePrice,
  fixedServiceLabel,
  distance,
  postcode,
  bedrooms,
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
        {/* "Available today" badge removed with the same-day UI sweep; the
            availableNow data/system is untouched (relaunch later). */}
      </CleanerIdentity>

      {hasFixed && fixedServiceLabel && (
        <p className="mt-3 rounded-[8px] bg-primary-soft px-3 py-2 font-jost text-[12px] font-medium text-ink">
          Total for your {fixedServiceLabel}: £{fixedWithFee}
          <span className="font-light text-ink-3"> · all-inclusive</span>
        </p>
      )}

      {distance !== null && distance !== undefined && (
        <p className="mt-2 font-jost text-[11px] font-light text-ink-3">{distance} mi away</p>
      )}

      <p className="mt-3 line-clamp-2 font-jost text-[13px] font-light leading-relaxed text-ink-2">
        {cleaner.bio}
      </p>

      <Link
        href={buildBookUrl(cleaner.id, postcode, bedrooms)}
        onClick={(e) => e.stopPropagation()}
        className="mt-4 block rounded-[10px] bg-primary px-4 py-3 text-center font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
      >
        Book now
      </Link>
    </div>
  );
}
