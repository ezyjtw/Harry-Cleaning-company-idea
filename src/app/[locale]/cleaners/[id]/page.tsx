import Link from 'next/link';
import { notFound } from 'next/navigation';

import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import AvailableNowBadge from '@/components/AvailableNowBadge';
import CategoryRatingBar from '@/components/CategoryRatingBar';
import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import {
  serviceTypeLabel,
  eotSizeLabel,
  airbnbSizeLabel,
  isServiceTypeSlug,
  EOT_SIZE_SLUGS,
  AIRBNB_SIZE_SLUGS,
  type ServiceTypeSlug,
} from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { computeCleanerRating } from '@/lib/services/rating.service';

export default async function CleanerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { postcode?: string };
}) {
  // Carry the customer's search postcode through to /book so the address step
  // auto-looks-up without re-entry. Absent → the manual path is preserved.
  const bookPostcode = (searchParams?.postcode ?? '').trim().toUpperCase();
  const bookQuery = bookPostcode ? `?postcode=${encodeURIComponent(bookPostcode)}` : '';
  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId: params.id },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      availabilitySlots: true,
      availabilityOverrides: {
        where: { isBlocked: true, date: { gte: new Date() } },
        select: { date: true },
      },
    },
  });

  if (!profile) notFound();

  const reviews = await prisma.review.findMany({
    where: { cleanerId: params.id, visibility: 'VISIBLE' },
    include: {
      client: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const reviewCount = await prisma.review.count({
    where: { cleanerId: params.id, visibility: 'VISIBLE' },
  });

  // VERIFIED imported reviews ONLY — PENDING/REJECTED never surface publicly.
  const importedReviews = await prisma.importedReview.findMany({
    where: { cleanerId: params.id, verificationStatus: 'VERIFIED' },
    orderBy: { createdAt: 'desc' },
  });

  const testimonials = (Array.isArray(profile.testimonials) ? profile.testimonials : []) as {
    clientName: string;
    rating: number;
    text: string;
    categories?: { thoroughness: number; punctuality: number; communication: number };
  }[];

  // Build cleaner data for the page
  const cleaner = {
    id: profile.user.id,
    name: profile.user.name || 'Cleaner',
    photo: profile.user.image || '',
    rating: Number(profile.rating),
    reviewCount,
    hourlyRateRegular: profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null,
    hourlyRateDeep: profile.hourlyRateDeep ? Number(profile.hourlyRateDeep) : null,
    hourlyRateSameDay: profile.hourlyRateSameDay ? Number(profile.hourlyRateSameDay) : null,
    eotPrices: (profile.eotPrices as Record<string, number>) || null,
    airbnbPrices: (profile.airbnbPrices as Record<string, number>) || null,
    serviceTypes: (profile.serviceTypes || []).filter(isServiceTypeSlug) as ServiceTypeSlug[],
    bio: profile.bio || '',
    specialties: profile.specialties,
    location: profile.location || '',
    verified: profile.verified,
    identityVerified: profile.verificationStatus === 'VERIFIED',
    backgroundChecked: profile.backgroundCheckPassed,
    completedJobs: profile.completedJobs,
    availableNow: profile.availableNow,
    responseTime: profile.responseTime ? `~${profile.responseTime} min` : '~15 min',
    availability: profile.availabilitySlots.map((s) => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[s.dayOfWeek] || '';
    }),
    availabilitySlots: profile.availabilitySlots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    blockedDates: profile.availabilityOverrides.map((o) => o.date.toISOString().split('T')[0]),
    languages: [] as string[],
    yearsExperience: 0,
  };

  // Sub-category bars come from the single canonical helper — native VISIBLE
  // reviews only (imports never carry sub-ratings). This replaces a duplicate
  // inline aggregation, removing drift risk between the two paths. Note the helper
  // aggregates ALL native reviews, not just the latest 20 rendered below, so the
  // bars are now full-population (more accurate; differs from the old last-20 only
  // for cleaners with >20 sub-rated reviews).
  const { subRatings: sub } = await computeCleanerRating(params.id);
  const hasNativeSubRatings = sub.thoroughness !== null;

  // "Value for money" = native overall-star average among reviews that carry
  // sub-ratings (same population as the bars). The canonical helper exposes only
  // the three sub-categories, so this single derived metric stays local.
  const valueAgg = await prisma.review.aggregate({
    where: { cleanerId: params.id, visibility: 'VISIBLE', thoroughness: { not: null } },
    _avg: { rating: true },
  });
  const valueForMoney = valueAgg._avg.rating ? Number(valueAgg._avg.rating) : 0;

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
                <h1 className="font-cormorant text-[32px] font-light leading-tight text-ink sm:text-[40px] uppercase">
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
              {cleaner.hourlyRateRegular && (
                <div>
                  <span className="font-cormorant text-[32px] font-semibold text-ink">
                    &pound;{cleaner.hourlyRateRegular.toFixed(2)}
                  </span>
                  <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
                </div>
              )}
              {cleaner.hourlyRateDeep && (
                <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                  &pound;{cleaner.hourlyRateDeep.toFixed(2)}/hr deep clean
                </p>
              )}
              {cleaner.hourlyRateSameDay && (
                <p className="mt-1 font-jost text-[12px] font-light text-ink-3 opacity-50">
                  &pound;{cleaner.hourlyRateSameDay.toFixed(2)}/hr same-day (coming soon)
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/book/${cleaner.id}${bookQuery}`}
                  className="inline-block rounded-md bg-ink px-6 py-3 text-center font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
                >
                  Book now
                </Link>
                {cleaner.availableNow && (
                  <Link
                    href={`/book/${cleaner.id}?express=true${bookPostcode ? `&postcode=${encodeURIComponent(bookPostcode)}` : ''}`}
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

        {/* Services & Pricing */}
        {cleaner.serviceTypes.length > 0 && (
          <section className="mt-10">
            <h2 className="font-cormorant text-[22px] font-semibold text-ink">
              Services &amp; Pricing
            </h2>
            <div className="mt-4 space-y-3">
              {cleaner.serviceTypes.includes('regular') && cleaner.hourlyRateRegular && (
                <div className="flex items-center justify-between bg-cream px-4 py-3">
                  <span className="font-jost text-[14px] font-light text-ink">
                    {serviceTypeLabel('regular')}
                  </span>
                  <span className="font-jost text-[14px] font-medium text-ink">
                    &pound;{cleaner.hourlyRateRegular.toFixed(2)}/hr
                  </span>
                </div>
              )}
              {cleaner.serviceTypes.includes('deep') && cleaner.hourlyRateDeep && (
                <div className="flex items-center justify-between bg-cream px-4 py-3">
                  <span className="font-jost text-[14px] font-light text-ink">
                    {serviceTypeLabel('deep')}
                  </span>
                  <span className="font-jost text-[14px] font-medium text-ink">
                    &pound;{cleaner.hourlyRateDeep.toFixed(2)}/hr
                  </span>
                </div>
              )}
              {cleaner.serviceTypes.includes('same_day') && cleaner.hourlyRateSameDay && (
                <div className="flex items-center justify-between bg-cream px-4 py-3 opacity-50">
                  <div className="flex items-center gap-2">
                    <span className="font-jost text-[14px] font-light text-ink">
                      {serviceTypeLabel('same_day')}
                    </span>
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.08em] text-ink-3">
                      Coming Soon
                    </span>
                  </div>
                  <span className="font-jost text-[14px] font-medium text-ink">
                    &pound;{cleaner.hourlyRateSameDay.toFixed(2)}/hr
                  </span>
                </div>
              )}
              {cleaner.serviceTypes.includes('end_of_tenancy') && cleaner.eotPrices && (
                <div className="bg-cream px-4 py-3">
                  <span className="font-jost text-[14px] font-light text-ink">
                    {serviceTypeLabel('end_of_tenancy')}
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                    {EOT_SIZE_SLUGS.map((slug) => {
                      const price = cleaner.eotPrices?.[slug];
                      if (!price) return null;
                      return (
                        <div key={slug} className="flex justify-between">
                          <span className="font-jost text-[13px] font-light text-ink-3">
                            {eotSizeLabel(slug)}
                          </span>
                          <span className="font-jost text-[13px] font-medium text-ink">
                            &pound;{price.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {cleaner.serviceTypes.includes('airbnb') && cleaner.airbnbPrices && (
                <div className="bg-cream px-4 py-3">
                  <span className="font-jost text-[14px] font-light text-ink">
                    {serviceTypeLabel('airbnb')}
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                    {AIRBNB_SIZE_SLUGS.map((slug) => {
                      const price = cleaner.airbnbPrices?.[slug];
                      if (!price) return null;
                      return (
                        <div key={slug} className="flex justify-between">
                          <span className="font-jost text-[13px] font-light text-ink-3">
                            {airbnbSizeLabel(slug)}
                          </span>
                          <span className="font-jost text-[13px] font-medium text-ink">
                            &pound;{price.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: `${cleaner.yearsExperience || '-'}`, label: 'Years experience' },
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

        {/* Detailed ratings — native Rena reviews only (imports carry no sub-ratings) */}
        {hasNativeSubRatings ? (
          <section className="mt-10">
            <h2 className="font-cormorant text-[22px] font-semibold text-ink">Detailed ratings</h2>
            <div className="mt-4 max-w-md space-y-3">
              <CategoryRatingBar label="Thoroughness" value={sub.thoroughness ?? 0} />
              <CategoryRatingBar label="Punctuality" value={sub.punctuality ?? 0} />
              <CategoryRatingBar label="Communication" value={sub.communication ?? 0} />
              <CategoryRatingBar label="Value for money" value={valueForMoney} />
            </div>
          </section>
        ) : importedReviews.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-cormorant text-[22px] font-semibold text-ink">Detailed ratings</h2>
            <p className="mt-3 font-jost text-[13px] font-light text-ink-3">
              No Rena jobs yet — the category breakdown reflects completed Rena bookings only.
            </p>
          </section>
        ) : null}

        {/* Availability */}
        <section className="mt-10">
          <h2 className="font-cormorant text-[22px] font-semibold text-ink">Availability</h2>
          <AvailabilityCalendar
            slots={cleaner.availabilitySlots}
            blockedDates={cleaner.blockedDates}
          />
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
            Reviews ({reviews.length + testimonials.length})
          </h2>
          <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
            Only verified customers who completed a booking can leave reviews.
          </p>
          <div className="mt-6 space-y-0">
            {testimonials.map((t, i) => (
              <div key={`testimonial-${i}`} className="border-t border-ink/5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-jost text-[14px] font-medium text-ink">
                      {t.clientName}
                    </span>
                    <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-ink-3">
                      Testimonial
                    </span>
                  </div>
                </div>
                <div className="mt-1">
                  <StarRating rating={t.rating} />
                </div>
                {t.categories && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {[
                      { label: 'Thoroughness', v: t.categories.thoroughness },
                      { label: 'Punctuality', v: t.categories.punctuality },
                      { label: 'Communication', v: t.categories.communication },
                    ].map((cat) => (
                      <span key={cat.label} className="font-jost text-[11px] font-light text-ink-3">
                        {cat.label}: {cat.v}/5
                      </span>
                    ))}
                  </div>
                )}
                {t.text && (
                  <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    {t.text}
                  </p>
                )}
              </div>
            ))}
            {reviews.map((review) => (
              <div key={review.id} className="border-t border-ink/5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-jost text-[14px] font-medium text-ink">
                      {review.client.name || 'Customer'}
                    </span>
                    {review.isVerifiedBooking && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-teal">
                        Verified
                      </span>
                    )}
                  </div>
                  <span className="font-jost text-[12px] font-light text-ink-3">
                    {review.createdAt.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="mt-1">
                  <StarRating rating={Number(review.rating)} />
                </div>

                {review.thoroughness && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {[
                      { label: 'Thoroughness', v: Number(review.thoroughness) },
                      { label: 'Punctuality', v: Number(review.punctuality || 0) },
                      { label: 'Communication', v: Number(review.communication || 0) },
                    ].map((cat) => (
                      <span key={cat.label} className="font-jost text-[11px] font-light text-ink-3">
                        {cat.label}: {cat.v}/5
                      </span>
                    ))}
                  </div>
                )}

                {review.text && (
                  <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    {review.text}
                  </p>
                )}

                {review.reply && (
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
                      {review.reply}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {reviews.length === 0 && testimonials.length === 0 && importedReviews.length === 0 && (
              <p className="py-8 text-center font-jost text-[14px] font-light text-ink-3">
                No reviews yet.
              </p>
            )}
          </div>

          {/* Imported reviews — VERIFIED only, clearly distinct from native Rena
              reviews (DMCCA transparency: labelled "Imported from", separate block,
              tinted card, and an explicit explainer that they are not Rena bookings). */}
          {importedReviews.length > 0 && (
            <div className="mt-8">
              <h3 className="font-cormorant text-[18px] font-semibold text-ink">
                Imported from other platforms
              </h3>
              <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                These reviews were imported by the cleaner from external platforms and independently
                verified by our team. They are not Rena booking reviews.
              </p>
              <div className="mt-4 space-y-3">
                {importedReviews.map((imp) => (
                  <div
                    key={imp.id}
                    className="rounded-lg bg-cream/50 p-4"
                    style={{ border: '1px solid rgba(14,14,12,0.08)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-jost text-[14px] font-medium text-ink">
                        {imp.reviewerName || 'Reviewer'}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[10px] font-medium text-ink-2">
                        Imported from {imp.source}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRating rating={Number(imp.rating)} />
                    </div>
                    {imp.text && (
                      <p className="mt-2 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                        {imp.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
