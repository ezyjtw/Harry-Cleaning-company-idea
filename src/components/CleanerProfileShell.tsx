'use client';

// Cleaner profile skin (James-ruled: option A structure, circular photo
// header — the approved final mockup is the spec). In-shell only: the gate
// renders the browser's CleanerProfileView untouched everywhere else, and the
// skin swaps the RENDER only — same server data, same bookHref, no mechanics.
// Truth rules: badges render only what verification actually confirms; ratings
// and counts are the stored figures; no reviews → an honest quiet line.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useCustomerShell } from '@/components/app/customer';
import CleanerAvatar from '@/components/CleanerAvatar';
import CleanerProfileView, { type CleanerProfileData } from '@/components/CleanerProfileView';
import StarRating from '@/components/StarRating';

const REVIEWS_FIRST_PAGE = 3;

/** "5 Sept 2026" → "Sept 2026" (the mockup's first-name · month grammar). */
function monthOf(date?: string): string | null {
  if (!date) return null;
  return date.replace(/^\d+\s+/, '');
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </p>
  );
}

function ProfileSkin({ data }: { data: CleanerProfileData }) {
  const [showAll, setShowAll] = useState(false);
  const first = data.name.split(' ')[0];
  const verified = data.idVerified || data.backgroundChecked;
  // Badge pills — only what verification actually confirms (ruled labels).
  const badges = [
    data.idVerified && 'ID Checked',
    data.insured && 'Insured',
    data.backgroundChecked && 'DBS',
  ].filter(Boolean) as string[];
  const metaLine = [data.location, data.fromPrice ? `from £${data.fromPrice.toFixed(2)}/hr` : null]
    .filter(Boolean)
    .join(' · ');
  const shown = showAll ? data.reviews : data.reviews.slice(0, REVIEWS_FIRST_PAGE);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4" data-testid="cp-skin">
      <Link
        href="/cleaners"
        className="font-jost text-[13px] font-medium text-ink-3 active:opacity-70"
      >
        ‹ Cleaners
      </Link>

      {/* Header row — circular photo, no hero strip, no text over photos. */}
      <div className="mt-3 flex items-center gap-4" data-testid="cp-header">
        <CleanerAvatar photo={data.photo} name={data.name} size={68} />
        <div className="min-w-0">
          {/* h1 (James-sanctioned): the name is the page's proper heading. */}
          <h1 className="font-jost text-[22px] font-semibold leading-tight text-ink">
            {data.name}
            {verified && (
              <span className="ml-2 align-middle font-jost text-[12px] font-semibold text-trust">
                ✓ Verified
              </span>
            )}
          </h1>
          {data.reviewCount > 0 && (
            <p className="mt-0.5 font-jost text-[13px] text-ink-2">
              <span className="text-rating">★</span> {data.rating}{' '}
              <span className="text-ink-3">
                ({data.reviewCount} {data.reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </p>
          )}
          {metaLine && <p className="mt-0.5 font-jost text-[13px] text-ink-3">{metaLine}</p>}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2" data-testid="cp-badges">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-line bg-surface px-2.5 py-1 font-jost text-[11px] font-medium text-trust"
            >
              ✓ {b}
            </span>
          ))}
        </div>
      )}

      {data.about && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4" data-testid="cp-about">
          <Eyebrow>About</Eyebrow>
          <p className="mt-1.5 font-jost text-[14px] font-light leading-[1.7] text-ink-2">
            {data.about}
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line bg-surface p-4" data-testid="cp-reviews">
        <Eyebrow>Reviews{data.reviewCount > 0 ? ` (${data.reviewCount})` : ''}</Eyebrow>
        {data.reviews.length === 0 ? (
          <p
            className="mt-2 font-jost text-[14px] font-light text-ink-3"
            data-testid="cp-no-reviews"
          >
            No reviews yet — be the first.
          </p>
        ) : (
          <>
            {shown.map((rev) => (
              <div key={rev.id} className="border-b border-line py-3 last:border-b-0 last:pb-0">
                <StarRating rating={rev.rating} />
                {rev.text && (
                  <p className="mt-1.5 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    “{rev.text}”
                  </p>
                )}
                <p className="mt-1.5 font-jost text-[12px] text-ink-3">
                  {rev.name.split(' ')[0]}
                  {monthOf(rev.date) ? ` · ${monthOf(rev.date)}` : ''}
                </p>
              </div>
            ))}
            {!showAll && data.reviews.length > REVIEWS_FIRST_PAGE && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                data-testid="cp-see-all"
                className="mt-3 w-full rounded-[10px] border border-line bg-surface py-2.5 font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-2 active:bg-page"
              >
                See all {data.reviews.length} reviews
              </button>
            )}
          </>
        )}

        {/* DMCCA honesty carried through: imported reviews count toward the
            headline rating, so they stay visible under their own honest label
            (same provenance chip, compact form). */}
        {data.importedReviews && data.importedReviews.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <Eyebrow>From before Rena ({data.importedReviews.length})</Eyebrow>
            {data.importedReviews.map((rev) => (
              <div key={rev.id} className="border-b border-line py-3 last:border-b-0 last:pb-0">
                <StarRating rating={rev.rating} />
                {rev.text && (
                  <p className="mt-1.5 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    “{rev.text}”
                  </p>
                )}
                <p className="mt-1.5 font-jost text-[12px] text-ink-3">
                  {rev.name.split(' ')[0]} · via {rev.source}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOOK door — sticky bottom, navy, the one action (feeds the existing
          cleaner-first flow via the server-built bookHref). */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <Link
          href={data.bookHref}
          data-testid="cp-book-door"
          className="mx-auto block max-w-lg rounded-[10px] bg-primary py-3.5 text-center font-jost text-[13px] font-semibold uppercase tracking-[0.12em] text-white active:opacity-90"
        >
          Book {first}
        </Link>
      </div>
    </div>
  );
}

/** Mount-gated door: browsers (and Rena Pro) get the original view untouched;
 *  the customer shell gets the skin. Scoped to the standalone profile page —
 *  the in-flow modal keeps the shared view everywhere. */
export default function CleanerProfileShellGate({
  data,
  availability,
}: {
  data: CleanerProfileData;
  availability?: ReactNode;
}) {
  const inShell = useCustomerShell();
  if (inShell) return <ProfileSkin data={data} />;
  return (
    <CleanerProfileView data={data} availability={availability} mobileBar="fixed" nameAs="h1" />
  );
}
