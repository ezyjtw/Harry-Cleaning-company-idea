import type { ReactNode } from 'react';

import CleanerAvatar from './CleanerAvatar';
import StarRating from './StarRating';

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

/**
 * Shared cleaner identity block (J presentation): 80px headshot (real photo or serif
 * initial on primary-soft) with the green pinned verified check, Newsreader name, amber
 * stars + count, and a caller-supplied meta line (e.g. "E4 · from £16.00/hr"). Used by
 * CleanerCard and the time-first available-cleaner card so both read identically.
 */
export default function CleanerIdentity({
  photo,
  name,
  verified,
  rating,
  reviewCount,
  meta,
  children,
}: {
  photo?: string | null;
  name: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="relative shrink-0">
        <CleanerAvatar photo={photo} name={name} size={80} />
        {verified && <VerifiedCheck />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-newsreader text-[19px] font-semibold text-ink">{name}</h3>
        <div className="mt-1 flex items-center gap-1.5">
          {reviewCount > 0 ? (
            <>
              <StarRating rating={rating} />
              <span className="font-jost text-[12px] font-light text-ink-2">
                {rating} ({reviewCount})
              </span>
            </>
          ) : (
            <span className="font-jost text-[12px] font-light text-ink-3">New to Rena</span>
          )}
        </div>
        {meta && <p className="mt-1 font-jost text-[12.5px] text-ink-3">{meta}</p>}
        {children}
      </div>
    </div>
  );
}
