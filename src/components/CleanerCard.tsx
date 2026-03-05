import Link from "next/link";
import { Cleaner } from "@/lib/types";
import StarRating from "./StarRating";

export default function CleanerCard({ cleaner }: { cleaner: Cleaner }) {
  return (
    <Link
      href={`/cleaners/${cleaner.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-lg"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
          {cleaner.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-gray-900 group-hover:text-brand-700">
              {cleaner.name}
            </h3>
            {cleaner.verified && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                Verified
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{cleaner.location}</p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating rating={cleaner.rating} />
            <span className="text-sm text-gray-600">
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900">
            ${cleaner.hourlyRate}
          </span>
          <span className="text-sm text-gray-500">/hr</span>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">{cleaner.bio}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {cleaner.specialties.map((s) => (
          <span
            key={s}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
          >
            {s}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>{cleaner.yearsExperience} years experience</span>
        <span>{cleaner.completedJobs} jobs completed</span>
      </div>
    </Link>
  );
}
