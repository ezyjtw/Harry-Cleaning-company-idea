import Link from 'next/link';
import type { ReactNode } from 'react';

import CleanerAvatar from './CleanerAvatar';
import { FoundingBadge } from './CleanerIdentity';
import StarRating from './StarRating';

export interface ProfileService {
  label: string;
  price: string;
  soon?: boolean;
}

export interface ProfileRatingBar {
  label: string;
  value: number;
}

export interface ProfileReviewItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  date?: string;
  verified?: boolean;
  reply?: string;
  /** Imported-review source (e.g. "Google") — renders the DMCCA "Imported from" pill. */
  source?: string;
}

export interface CleanerProfileData {
  id: string;
  name: string;
  photo?: string | null;
  location: string;
  rating: number;
  reviewCount: number;
  idVerified: boolean;
  insured: boolean;
  backgroundChecked: boolean;
  /** Headline £/hr (hourlyRateRegular or lowest offered). */
  fromPrice: number | null;
  bookHref: string;
  /** F-B: permanent founding-cohort badge. */
  founding?: boolean;
  /** In-flow context (e.g. the wizard browse step): when set, the book button
   *  calls this instead of navigating to bookHref. */
  onBook?: () => void;
  bookLabel?: string;
  about: string;
  /** Native sub-rating bars; null when there are no Rena sub-rated reviews yet. */
  ratings: ProfileRatingBar[] | null;
  ratingsNote?: string | null;
  /** H25: population behind the bars — how many Rena reviews carry sub-ratings. */
  subRatedCount?: number;
  /** H25: when verified imported reviews exist, the bars get the one-line
   *  "imported reviews don't include detailed categories" footnote. */
  hasImportedReviews?: boolean;
  // B7: no `response` field — response time was never measured anywhere, and
  // the stat it fed was a hard-coded invention.
  experience: { years: number | null; jobs: number };
  languages: string[];
  services: ProfileService[];
  reviews: ProfileReviewItem[];
  reviewsSubtitle?: string;
}

function Avatar({ name, photo, size }: { name: string; photo?: string | null; size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <CleanerAvatar photo={photo} name={name} size={size} />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white">
        <svg
          className="h-5 w-5 text-trust"
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
      </span>
    </div>
  );
}

function PriceBand({
  fromPrice,
  bookHref,
  onBook,
  bookLabel,
  className,
}: {
  fromPrice: number | null;
  bookHref: string;
  onBook?: () => void;
  bookLabel?: string;
  className?: string;
}) {
  const btnClass =
    'shrink-0 whitespace-nowrap rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover';
  return (
    <div
      className={`flex items-center justify-between gap-4 border-t border-ink bg-[#f7f8fb] px-6 py-4 sm:px-8 ${className ?? ''}`}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          From
        </span>{' '}
        <span className="font-newsreader text-[24px] font-medium text-ink">
          £{(fromPrice ?? 0).toFixed(2)}
        </span>
        <span className="font-jost text-[14px] font-normal text-ink-2">/hr</span>
      </div>
      {onBook ? (
        <button type="button" onClick={onBook} className={btnClass}>
          {bookLabel ?? 'Book now'}
        </button>
      ) : (
        <Link href={bookHref} className={btnClass}>
          {bookLabel ?? 'Book now'}
        </Link>
      )}
    </div>
  );
}

export default function CleanerProfileView({
  data,
  availability,
  mobileBar = 'sticky',
}: {
  data: CleanerProfileData;
  availability?: ReactNode;
  /** U3: how the mobile price band pins. 'sticky' works inside a bounded
   *  scroll container (the modal); the standalone page has none, so it passes
   *  'fixed' to pin the bar to the viewport. */
  mobileBar?: 'sticky' | 'fixed';
}) {
  const verifications = [
    data.idVerified && 'ID Verified',
    data.insured && 'Insured',
    data.backgroundChecked && 'Background-checked',
  ].filter(Boolean) as string[];

  const expBits = [
    data.experience.years && data.experience.years > 0 ? `${data.experience.years} yrs` : null,
    `${data.experience.jobs} jobs`,
  ].filter(Boolean);

  return (
    <div>
      {/* Header */}
      <div className="border-b border-ink bg-surface px-6 pb-6 pt-7 sm:px-8">
        <div className="flex items-start gap-5">
          <Avatar name={data.name} photo={data.photo} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-newsreader text-[24px] font-semibold leading-tight text-ink">
                {data.name}
              </h2>
              {data.founding && <FoundingBadge size="md" />}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={data.rating} />
              <span className="font-jost text-[13px] font-light text-ink-2">
                {data.rating} ({data.reviewCount} reviews)
              </span>
            </div>
            <p className="mt-1 font-jost text-[13px] text-ink-3">{data.location}</p>
            {verifications.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {verifications.map((v) => (
                  <span key={v} className="font-jost text-[12px] font-medium text-trust">
                    ✓ {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price band — desktop (in-flow, after header) */}
      <PriceBand
        fromPrice={data.fromPrice}
        bookHref={data.bookHref}
        onBook={data.onBook}
        bookLabel={data.bookLabel}
        className="hidden md:flex"
      />

      {/* Ledger — locked order: ABOUT → DETAILED RATINGS → REVIEWS → EXPERIENCE → SERVICES & RATES */}
      <div className="px-6 pb-6 sm:px-8">
        <SectionLabel>About</SectionLabel>
        <p className="pt-1 font-jost text-[14px] font-light leading-[1.7] text-ink-2">
          {data.about}
        </p>

        {data.languages.length > 0 && (
          <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line py-3">
            <span className="shrink-0 font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
              Languages
            </span>
            <span className="min-w-0 flex-1 text-right font-jost text-[14px] text-ink-2">
              {data.languages.join(', ')}
            </span>
          </div>
        )}

        {/* H25 (mixed-population honesty): the bars average NATIVE sub-rated
            reviews only — imported reviews feed the headline but carry no
            categories — so the section SAYS which population it reflects, and
            renders nothing at all when that population is empty (imported-only
            or unreviewed cleaners: no bars, no note, no section). */}
        {data.ratings && data.ratings.length > 0 && (
          <>
            <SectionLabel>
              Detailed ratings
              {typeof data.subRatedCount === 'number' && data.subRatedCount > 0 && (
                <span className="normal-case tracking-normal text-ink-3">
                  {' '}
                  · from {data.subRatedCount} Rena {data.subRatedCount === 1 ? 'review' : 'reviews'}
                </span>
              )}
            </SectionLabel>
            <div className="max-w-md space-y-2 pt-1">
              {data.ratings.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-32 font-jost text-[13px] font-light text-ink-2">
                    {r.label}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-soft">
                    <span
                      className="block h-full rounded-full bg-rating"
                      style={{ width: `${(r.value / 5) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-jost text-[13px] font-medium text-ink">
                    {r.value.toFixed(1)}
                  </span>
                </div>
              ))}
              {data.hasImportedReviews && (
                <p className="pt-1 font-jost text-[12px] font-light text-ink-3">
                  Imported reviews count toward the overall rating but don&apos;t include detailed
                  categories.
                </p>
              )}
            </div>
          </>
        )}

        <SectionLabel>Reviews ({data.reviews.length})</SectionLabel>
        {data.reviewsSubtitle && (
          <p className="font-jost text-[12px] font-light text-ink-3">{data.reviewsSubtitle}</p>
        )}
        {data.reviews.length > 0 ? (
          <div>
            {data.reviews.map((rev) => (
              <div key={rev.id} className="border-t border-line py-4 first:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-jost text-[14px] font-medium text-ink">
                    {rev.name}
                    {rev.source ? (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[10px] font-medium text-ink-2">
                        Imported from {rev.source}
                      </span>
                    ) : rev.verified ? (
                      <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 font-jost text-[10px] font-medium text-trust">
                        Verified
                      </span>
                    ) : null}
                  </span>
                  {rev.date && (
                    <span className="shrink-0 font-jost text-[12px] font-light text-ink-3">
                      {rev.date}
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <StarRating rating={rev.rating} />
                </div>
                {rev.text && (
                  <p className="mt-2 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    {rev.text}
                  </p>
                )}
                {rev.reply && (
                  <div className="mt-3 rounded-md bg-[#f7f8fb] px-4 py-3">
                    <span className="font-jost text-[12px] font-medium text-ink">
                      {data.name} replied
                    </span>
                    <p className="mt-1 font-jost text-[13px] font-light text-ink-2">{rev.reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center font-jost text-[14px] font-light text-ink-3">
            No reviews yet.
          </p>
        )}

        <SectionLabel>Experience</SectionLabel>
        <div className="border-t border-line py-3 font-jost text-[14px] text-ink-2">
          {expBits.join(' · ')}
        </div>

        {data.services.length > 0 && (
          <>
            <SectionLabel>Services &amp; rates</SectionLabel>
            <div>
              {data.services.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-3 border-t border-line py-3"
                >
                  <span className="flex items-center gap-2 font-jost text-[14px] text-ink-2">
                    {s.label}
                    {s.soon && (
                      <span className="rounded-full bg-primary-soft px-1.5 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-normal text-primary">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="font-newsreader text-[15px] font-medium text-ink">
                    {s.price}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {availability && (
          <>
            <SectionLabel>Availability</SectionLabel>
            <div className="border-t border-line pt-4">{availability}</div>
          </>
        )}
      </div>

      {/* Price band — mobile. In the modal it sticks to the bottom of the
          scroll container; on the standalone page (U3) it pins to the viewport
          so Book Now is always reachable mid-scroll. */}
      <PriceBand
        fromPrice={data.fromPrice}
        bookHref={data.bookHref}
        onBook={data.onBook}
        bookLabel={data.bookLabel}
        className={
          mobileBar === 'fixed'
            ? 'fixed inset-x-0 bottom-0 z-40 flex pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden'
            : 'sticky bottom-0 z-10 flex md:hidden'
        }
      />
      {/* Spacer so a fixed bar never covers the last content (reviews tail). */}
      {mobileBar === 'fixed' && <div aria-hidden className="h-24 md:hidden" />}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-7 font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
      {children}
    </p>
  );
}
