import Link from 'next/link';
import { notFound } from 'next/navigation';

import AvailableNowBadge from '@/components/AvailableNowBadge';
import CategoryRatingBar from '@/components/CategoryRatingBar';
import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import { cleaners, getCleanerById, getReviewsForCleaner } from '@/lib/mock-data';
import { getListedRate } from '@/lib/pricing';

export function generateStaticParams() {
  return cleaners.map((c) => ({ id: c.id }));
}

export default function CleanerProfilePage({ params }: { params: { id: string } }) {
  const cleaner = getCleanerById(params.id);
  if (!cleaner) notFound();

  const reviews = getReviewsForCleaner(cleaner.id);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-cream px-5 py-10 md:px-14 md:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white font-cormorant text-[32px] font-semibold text-ink sm:h-24 sm:w-24 sm:text-[38px]">
              {cleaner.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="font-cormorant text-[32px] font-light leading-tight text-ink sm:text-[40px]">
                  {cleaner.name}
                </h1>
                <VerificationBadge
                  identityVerified={cleaner.identityVerified}
                  backgroundChecked={cleaner.backgroundChecked}
                  size="md"
                />
              </div>
              <p className="mt-1 font-jost text-[14px] font-light text-ink-3">{cleaner.location}</p>
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={cleaner.rating} />
                <span className="font-jost text-[13px] font-light text-ink-2">
                  {cleaner.rating} ({cleaner.reviewCount} reviews)
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {cleaner.availableNow && <AvailableNowBadge responseTime={cleaner.responseTime} />}
                {cleaner.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white px-3 py-1 font-jost text-[12px] font-medium text-ink-2"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div>
                <span className="font-cormorant text-[32px] font-semibold text-ink">
                  &pound;{getListedRate(cleaner.hourlyRate)}
                </span>
                <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
              </div>
              {cleaner.availableNow && (
                <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                  &pound;{cleaner.sameDayRate}/hr same-day
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/book/${cleaner.id}`}
                  className="inline-block rounded-md bg-ink px-6 py-3 text-center font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
                >
                  Book now
                </Link>
                {cleaner.availableNow && (
                  <Link
                    href={`/book/${cleaner.id}?express=true`}
                    className="inline-block rounded-md bg-teal px-6 py-3 text-center font-jost text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Book for today
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-14 md:py-14">
        {/* About */}
        <section>
          <h2 className="font-cormorant text-[22px] font-semibold text-ink">About</h2>
          <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
            {cleaner.bio}
          </p>
        </section>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: `${cleaner.yearsExperience}`, label: 'Years experience' },
            { value: `${cleaner.completedJobs}`, label: 'Jobs completed' },
            { value: `${cleaner.rating}`, label: 'Avg rating' },
            { value: cleaner.responseTime, label: 'Response time' },
          ].map((stat) => (
            <div key={stat.label} className="bg-cream px-4 py-5 text-center">
              <div className="font-cormorant text-[26px] font-semibold text-ink">{stat.value}</div>
              <div className="mt-1 font-jost text-[12px] font-light text-ink-3">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* Detailed ratings */}
        <section className="mt-10">
          <h2 className="font-cormorant text-[22px] font-semibold text-ink">Detailed ratings</h2>
          <div className="mt-4 max-w-md space-y-3">
            <CategoryRatingBar label="Thoroughness" value={cleaner.categoryRatings.thoroughness} />
            <CategoryRatingBar label="Punctuality" value={cleaner.categoryRatings.punctuality} />
            <CategoryRatingBar
              label="Communication"
              value={cleaner.categoryRatings.communication}
            />
            <CategoryRatingBar label="Value for money" value={cleaner.categoryRatings.value} />
          </div>
        </section>

        {/* Availability */}
        <section className="mt-10">
          <h2 className="font-cormorant text-[22px] font-semibold text-ink">Availability</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span
                key={day}
                className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium ${
                  cleaner.availability.includes(day) ? 'bg-ink text-cream' : 'bg-cream text-ink-3'
                }`}
              >
                {day}
              </span>
            ))}
          </div>
        </section>

        {/* Languages */}
        {cleaner.languages.length > 0 && (
          <section className="mt-10">
            <h2 className="font-cormorant text-[22px] font-semibold text-ink">Languages</h2>
            <p className="mt-2 font-jost text-[14px] font-light text-ink-2">
              {cleaner.languages.join(', ')}
            </p>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-10">
          <h2 className="font-cormorant text-[22px] font-semibold text-ink">
            Reviews ({reviews.length})
          </h2>
          <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
            Only verified customers who completed a booking can leave reviews.
          </p>
          <div className="mt-6 space-y-0">
            {reviews.map((review) => (
              <div key={review.id} className="border-t border-ink/5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-jost text-[14px] font-medium text-ink">
                      {review.customerName}
                    </span>
                    {review.verified && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-teal">
                        Verified
                      </span>
                    )}
                  </div>
                  <span className="font-jost text-[12px] font-light text-ink-3">{review.date}</span>
                </div>
                <div className="mt-1">
                  <StarRating rating={review.rating} />
                </div>

                <div className="mt-2 flex flex-wrap gap-3">
                  {[
                    { label: 'Thoroughness', v: review.categoryRatings.thoroughness },
                    { label: 'Punctuality', v: review.categoryRatings.punctuality },
                    { label: 'Communication', v: review.categoryRatings.communication },
                    { label: 'Value', v: review.categoryRatings.value },
                  ].map((cat) => (
                    <span key={cat.label} className="font-jost text-[11px] font-light text-ink-3">
                      {cat.label}: {cat.v}/5
                    </span>
                  ))}
                </div>

                <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                  {review.comment}
                </p>

                {review.cleanerReply && (
                  <div className="mt-3 rounded-md bg-cream px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-cormorant text-[12px] font-semibold text-ink">
                        {cleaner.name.charAt(0)}
                      </div>
                      <span className="font-jost text-[12px] font-medium text-ink">
                        {cleaner.name} replied
                      </span>
                    </div>
                    <p className="mt-1 pl-8 font-jost text-[13px] font-light text-ink-2">
                      {review.cleanerReply}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {reviews.length === 0 && (
              <p className="py-8 text-center font-jost text-[14px] font-light text-ink-3">
                No reviews yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
