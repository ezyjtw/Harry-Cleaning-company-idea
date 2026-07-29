import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import CleanerProfileView, {
  type ProfileService,
  type ProfileReviewItem,
} from '@/components/CleanerProfileView';
import JsonLd from '@/components/JsonLd';
import ProfileWeekAvailability from '@/components/ProfileWeekAvailability';
import {
  serviceTypeLabel,
  isServiceTypeSlug,
  type ServiceTypeSlug,
} from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { computeCleanerRating } from '@/lib/services/rating.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// A1-P1: per-cleaner metadata — every profile page previously shared the
// directory layout's generic title. Canonical + OG per cleaner.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId: params.id },
    select: {
      location: true,
      bio: true,
      visibleInDirectory: true,
      user: { select: { name: true } },
    },
  });
  // F26: hidden profiles publish no metadata either — nothing to index.
  if (!profile || !profile.visibleInDirectory) return {};
  const name = displayName(profile.user?.name) || 'Cleaner';
  const area = profile.location || 'north-east London';
  const title = `${name} — Cleaner in ${area}`;
  const description = profile.bio
    ? profile.bio.slice(0, 155)
    : `Book ${name}, a vetted independent cleaner serving ${area}. Real profile, real reviews, transparent rates.`;
  const url = `${BASE_URL}/cleaners/${params.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile' },
  };
}

function minPrice(map: Record<string, number> | null | undefined): number | null {
  if (!map) return null;
  const vals = Object.values(map).filter((n) => typeof n === 'number' && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

export default async function CleanerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { postcode?: string };
}) {
  const bookPostcode = (searchParams?.postcode ?? '').trim().toUpperCase();
  const bookQuery = bookPostcode ? `?postcode=${encodeURIComponent(bookPostcode)}` : '';

  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId: params.id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      availabilitySlots: true,
      availabilityOverrides: {
        where: { isBlocked: true, date: { gte: new Date() } },
        select: { date: true },
      },
    },
  });
  if (!profile) notFound();

  // F26: a hidden profile's direct URL stays honest — no details, no booking
  // door, just the truth and a way back to cleaners who ARE taking work.
  if (!profile.visibleInDirectory) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">
          This cleaner isn&rsquo;t taking new customers right now
        </h1>
        <p className="mt-3 font-jost text-sm font-light text-ink-2">
          They may have paused their profile. You can browse other vetted cleaners in your area.
        </p>
        <a
          href="/cleaners"
          className="mt-6 inline-block rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          Browse cleaners
        </a>
      </div>
    );
  }

  const reviews = await prisma.review.findMany({
    where: { cleanerId: params.id, visibility: 'VISIBLE' },
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const reviewCount = await prisma.review.count({
    where: { cleanerId: params.id, visibility: 'VISIBLE' },
  });
  const importedReviews = await prisma.importedReview.findMany({
    where: { cleanerId: params.id, verificationStatus: 'VERIFIED' },
    orderBy: { createdAt: 'desc' },
  });
  const testimonials = (Array.isArray(profile.testimonials) ? profile.testimonials : []) as {
    clientName: string;
    rating: number;
    text: string;
  }[];

  const { subRatings: sub, subRatedCount } = await computeCleanerRating(params.id);
  const hasNativeSubRatings = sub.thoroughness !== null;
  // B7 (James-ruled): NO value-for-money row — the review form doesn't collect
  // it; the old row re-displayed the overall average under an invented label.

  const serviceTypes = (profile.serviceTypes || []).filter(isServiceTypeSlug) as ServiceTypeSlug[];
  const hrReg = profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null;
  const hrDeep = profile.hourlyRateDeep ? Number(profile.hourlyRateDeep) : null;
  const hrSame = profile.hourlyRateSameDay ? Number(profile.hourlyRateSameDay) : null;
  const eot = (profile.eotPrices as Record<string, number>) || null;
  const air = (profile.airbnbPrices as Record<string, number>) || null;

  const services: ProfileService[] = [];
  if (serviceTypes.includes('regular') && hrReg)
    services.push({ label: serviceTypeLabel('regular'), price: `£${hrReg.toFixed(2)}/hr` });
  if (serviceTypes.includes('deep') && hrDeep)
    services.push({ label: serviceTypeLabel('deep'), price: `£${hrDeep.toFixed(2)}/hr` });
  if (serviceTypes.includes('same_day') && hrSame)
    services.push({
      label: serviceTypeLabel('same_day'),
      price: `£${hrSame.toFixed(2)}/hr`,
      soon: true,
    });
  {
    const m = serviceTypes.includes('end_of_tenancy') ? minPrice(eot) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('end_of_tenancy'), price: `from £${m.toFixed(2)}` });
  }
  {
    const m = serviceTypes.includes('airbnb') ? minPrice(air) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('airbnb'), price: `from £${m.toFixed(2)}` });
  }

  // H28: Rena reviews lead; verified imports render as their OWN labelled
  // section (importedItems below), no longer mixed into this list.
  const reviewItems: ProfileReviewItem[] = [
    ...reviews.map((r) => ({
      id: r.id,
      name: r.client.name || 'Customer',
      rating: Number(r.rating),
      text: r.text || '',
      date: r.createdAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      verified: r.isVerifiedBooking,
      reply: r.reply || undefined,
    })),
  ];

  // James-ruled (ledger): self-entered testimonials leave the Reviews list and
  // become their own labelled "In their own words" section — they were visually
  // indistinguishable from Rena reviews despite counting toward nothing.
  const testimonialItems: ProfileReviewItem[] = testimonials.map((t, i) => ({
    id: `testimonial-${i}`,
    name: t.clientName,
    rating: t.rating,
    text: t.text || '',
  }));

  const now = new Date();
  // Photo carry-through fix (James, 2nd report): resolve the R2 key to a
  // presigned URL — this server component was passing the raw key to <img src>,
  // which 404s. Every other surface resolves; these two didn't.
  const resolvedPhoto = await resolveProfileImageUrl(profile.user.image);
  const data = {
    id: profile.user.id,
    name: displayName(profile.user.name) || 'Cleaner',
    photo: resolvedPhoto,
    location: profile.location || '',
    rating: Number(profile.rating),
    reviewCount,
    idVerified: profile.verificationStatus === 'VERIFIED',
    insured:
      profile.insuranceVerified &&
      (!profile.insuranceExpiresAt || profile.insuranceExpiresAt > now),
    backgroundChecked: profile.backgroundCheckPassed,
    fromPrice: hrReg ?? hrDeep ?? null,
    bookHref: `/book/${profile.user.id}${bookQuery}`,
    founding: profile.foundingCleaner,
    about: profile.bio || '',
    ratings: hasNativeSubRatings
      ? [
          { label: 'Thoroughness', value: sub.thoroughness ?? 0 },
          { label: 'Punctuality', value: sub.punctuality ?? 0 },
          { label: 'Communication', value: sub.communication ?? 0 },
        ]
      : null,
    // H25: honest population labelling — the bars say how many Rena reviews
    // they average, and the imported footnote appears when imports exist.
    // Imported-only cleaners render NO detailed-ratings section at all.
    subRatedCount,
    hasImportedReviews: importedReviews.length > 0,
    // B7 (James-ruled): no response-time stat — CleanerProfile.responseTime is
    // never computed by any code path (NULL in production), and the old
    // '~15 min' fallback was pure invention.
    experience: {
      years: profile.yearsExperience ?? null,
      jobs: profile.completedJobs,
    },
    languages: profile.languages || [],
    services,
    reviews: reviewItems,
    testimonials: testimonialItems,
    importedReviews: importedReviews.map((imp) => ({
      id: imp.id,
      name: imp.reviewerName || 'Reviewer',
      rating: Number(imp.rating),
      text: imp.text || '',
      source: imp.source,
    })),
    reviewsSubtitle: 'Only verified customers who completed a booking can leave reviews.',
  };

  const availabilitySlots = profile.availabilitySlots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  // A1-P1: honest structured data. Person markup always; the Service node with
  // AggregateRating renders ONLY from real review data (native VISIBLE +
  // imported VERIFIED). Self-entered testimonials are deliberately excluded.
  const realReviewCount = reviewCount + importedReviews.length;
  const ratingValue = Number(profile.rating);
  const personNode = {
    '@type': 'Person',
    name: data.name,
    jobTitle: 'Professional cleaner',
    ...(data.location
      ? { address: { '@type': 'PostalAddress', addressLocality: data.location } }
      : {}),
    worksFor: { '@type': 'Organization', name: 'Rena Cleaning Network' },
  };
  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${BASE_URL}/cleaners/${profile.user.id}`,
    mainEntity:
      realReviewCount > 0 && ratingValue > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `Home cleaning by ${data.name}`,
            provider: personNode,
            areaServed: data.location || 'North-east London and surrounding areas of Essex',
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: ratingValue.toFixed(2),
              reviewCount: realReviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : personNode,
  };

  return (
    <div className="min-h-screen bg-page">
      <JsonLd data={profileJsonLd} />
      <div className="mx-auto max-w-3xl sm:px-6 sm:py-10">
        <div className="bg-surface sm:overflow-hidden sm:rounded-[16px] sm:border sm:border-line">
          <CleanerProfileView
            data={data}
            availability={<ProfileWeekAvailability slots={availabilitySlots} />}
            mobileBar="fixed"
          />
        </div>
      </div>
    </div>
  );
}
