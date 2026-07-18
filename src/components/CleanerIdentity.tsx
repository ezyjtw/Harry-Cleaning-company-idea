import type { ReactNode } from 'react';

import { FOUNDING_BADGE_LABEL } from '@/lib/constants/badges';

import CleanerAvatar from './CleanerAvatar';
import StarRating from './StarRating';

/** F-B founding chip (James-ruled restyle): the card's standard chip language —
 *  light grey ground, 0.5px border, 6px radius, Jost 500 ~11px, ★ prefix.
 *  whitespace-nowrap so it never breaks internally; on narrow viewports it
 *  wraps WHOLE to its own line under the name (accepted behaviour — do not
 *  shorten; a phone-only "★ Founding" variant is pre-approved in the ledger if
 *  real cohort names prove long). `size="md"` is the proportional profile-
 *  header variant. "New to Rena" stays muted text, visually subordinate. */
export function FoundingBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[6px] bg-[#F2F4F8] font-jost font-medium text-ink-2 ${
        size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]'
      }`}
      style={{ border: '0.5px solid rgb(var(--color-border))' }}
    >
      ★ {FOUNDING_BADGE_LABEL}
    </span>
  );
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
  founding,
  isNew,
  meta,
  children,
}: {
  photo?: string | null;
  name: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  /** F-B: permanent founding-cohort badge (renders a pill next to the name). */
  founding?: boolean;
  /** F-B: whether "New to Rena" may show. When the caller has the data it
   *  passes the computed expiry (5 completed jobs or 60 days post-go-live);
   *  when omitted, the legacy no-reviews behaviour stands. */
  isNew?: boolean;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const showNew = reviewCount === 0 && (isNew ?? true);
  return (
    <div className="flex items-start gap-4">
      <div className="relative shrink-0">
        <CleanerAvatar photo={photo} name={name} size={80} />
        {verified && <VerifiedCheck />}
      </div>

      <div className="min-w-0 flex-1">
        {/* flex-wrap + nowrap chip: when the name leaves no room, the chip
            wraps WHOLE to its own line beneath (James-accepted behaviour). */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="max-w-full truncate font-newsreader text-[19px] font-semibold text-ink">
            {name}
          </h3>
          {founding && <FoundingBadge />}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {reviewCount > 0 ? (
            <>
              <StarRating rating={rating} />
              <span className="font-jost text-[12px] font-light text-ink-2">
                {rating} ({reviewCount})
              </span>
            </>
          ) : showNew ? (
            <span className="font-jost text-[12px] font-light text-ink-3">New to Rena</span>
          ) : (
            <span className="font-jost text-[12px] font-light text-ink-3">No reviews yet</span>
          )}
        </div>
        {meta && <p className="mt-1 font-jost text-[12.5px] text-ink-3">{meta}</p>}
        {children}
      </div>
    </div>
  );
}
