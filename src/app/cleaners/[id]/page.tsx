import Link from "next/link";
import { notFound } from "next/navigation";
import { cleaners, getCleanerById, getReviewsForCleaner } from "@/lib/mock-data";
import { PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import StarRating from "@/components/StarRating";
import CategoryRatingBar from "@/components/CategoryRatingBar";
import AvailableNowBadge from "@/components/AvailableNowBadge";
import VerificationBadge from "@/components/VerificationBadge";

export function generateStaticParams() {
  return cleaners.map((c) => ({ id: c.id }));
}

export default function CleanerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const cleaner = getCleanerById(params.id);
  if (!cleaner) notFound();

  const reviews = getReviewsForCleaner(cleaner.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-brand-100 text-4xl font-bold text-brand-700">
          {cleaner.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{cleaner.name}</h1>
            <VerificationBadge
              identityVerified={cleaner.identityVerified}
              backgroundChecked={cleaner.backgroundChecked}
              size="md"
            />
          </div>
          <p className="mt-1 text-gray-500">{cleaner.location}</p>
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={cleaner.rating} />
            <span className="text-sm text-gray-600">
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cleaner.availableNow && (
              <AvailableNowBadge responseTime={cleaner.responseTime} />
            )}
            {cleaner.specialties.map((s) => (
              <span
                key={s}
                className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">
            ${cleaner.hourlyRate}
            <span className="text-base font-normal text-gray-500">/hr</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            + {PLATFORM_FEE_PERCENT}% platform fee
          </div>
          {cleaner.availableNow && (
            <div className="mt-1 text-sm text-gray-500">
              ${cleaner.sameDayRate}/hr same-day
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={`/book/${cleaner.id}`}
              className="inline-block rounded-lg bg-brand-600 px-6 py-3 text-center font-semibold text-white hover:bg-brand-700"
            >
              Book Now
            </Link>
            {cleaner.availableNow && (
              <Link
                href={`/book/${cleaner.id}?express=true`}
                className="inline-block rounded-lg bg-green-600 px-6 py-3 text-center font-semibold text-white hover:bg-green-700"
              >
                Book for Today
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">About</h2>
        <p className="mt-3 text-gray-600 leading-relaxed">{cleaner.bio}</p>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cleaner.yearsExperience}
          </div>
          <div className="text-sm text-gray-500">Years Experience</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cleaner.completedJobs}
          </div>
          <div className="text-sm text-gray-500">Jobs Completed</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cleaner.rating}
          </div>
          <div className="text-sm text-gray-500">Average Rating</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {cleaner.responseTime}
          </div>
          <div className="text-sm text-gray-500">Response Time</div>
        </div>
      </section>

      {/* Category Ratings */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Detailed Ratings</h2>
        <div className="mt-4 space-y-3 max-w-md">
          <CategoryRatingBar label="Thoroughness" value={cleaner.categoryRatings.thoroughness} />
          <CategoryRatingBar label="Punctuality" value={cleaner.categoryRatings.punctuality} />
          <CategoryRatingBar label="Communication" value={cleaner.categoryRatings.communication} />
          <CategoryRatingBar label="Value for Money" value={cleaner.categoryRatings.value} />
        </div>
      </section>

      {/* Availability */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Availability</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span
              key={day}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                cleaner.availability.includes(day)
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {day}
            </span>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          Reviews ({reviews.length})
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Only verified customers who completed a booking can leave reviews.
        </p>
        <div className="mt-4 space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {review.customerName}
                  </span>
                  {review.verified && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Verified Booking
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{review.date}</span>
              </div>
              <div className="mt-1">
                <StarRating rating={review.rating} />
              </div>

              {/* Category breakdown */}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                <span>Thoroughness: {review.categoryRatings.thoroughness}/5</span>
                <span>Punctuality: {review.categoryRatings.punctuality}/5</span>
                <span>Communication: {review.categoryRatings.communication}/5</span>
                <span>Value: {review.categoryRatings.value}/5</span>
              </div>

              <p className="mt-2 text-sm text-gray-600">{review.comment}</p>

              {/* Cleaner reply */}
              {review.cleanerReply && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {cleaner.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {cleaner.name} replied
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 pl-8">
                    {review.cleanerReply}
                  </p>
                </div>
              )}
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-gray-500">No reviews yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
