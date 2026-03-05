import Link from "next/link";
import { notFound } from "next/navigation";
import { cleaners, getCleanerById, getReviewsForCleaner } from "@/lib/mock-data";
import StarRating from "@/components/StarRating";

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
            {cleaner.verified && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-gray-500">{cleaner.location}</p>
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={cleaner.rating} />
            <span className="text-sm text-gray-600">
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
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
          <Link
            href={`/book/${cleaner.id}`}
            className="mt-4 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Book Now
          </Link>
        </div>
      </div>

      {/* About */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">About</h2>
        <p className="mt-3 text-gray-600 leading-relaxed">{cleaner.bio}</p>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-3 gap-4">
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
        <div className="mt-4 space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {review.customerName}
                </span>
                <span className="text-sm text-gray-500">{review.date}</span>
              </div>
              <div className="mt-1">
                <StarRating rating={review.rating} />
              </div>
              <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
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
