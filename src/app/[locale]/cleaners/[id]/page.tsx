import { notFound } from 'next/navigation';

import CleanerProfileView, {
  type ProfileService,
  type ProfileReviewItem,
} from '@/components/CleanerProfileView';
import {
  serviceTypeLabel,
  isServiceTypeSlug,
  type ServiceTypeSlug,
} from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { computeCleanerRating } from '@/lib/services/rating.service';

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
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  if (!profile) notFound();

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

  const { subRatings: sub } = await computeCleanerRating(params.id);
  const hasNativeSubRatings = sub.thoroughness !== null;
  const valueAgg = await prisma.review.aggregate({
    where: { cleanerId: params.id, visibility: 'VISIBLE', thoroughness: { not: null } },
    _avg: { rating: true },
  });
  const valueForMoney = valueAgg._avg.rating ? Number(valueAgg._avg.rating) : 0;

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
    ...importedReviews.map((imp) => ({
      id: imp.id,
      name: imp.reviewerName || 'Reviewer',
      rating: Number(imp.rating),
      text: imp.text || '',
      source: imp.source,
    })),
    ...testimonials.map((t, i) => ({
      id: `testimonial-${i}`,
      name: t.clientName,
      rating: t.rating,
      text: t.text || '',
    })),
  ];

  const now = new Date();
  const data = {
    id: profile.user.id,
    name: profile.user.name || 'Cleaner',
    photo: profile.user.image || null,
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
    about: profile.bio || '',
    ratings: hasNativeSubRatings
      ? [
          { label: 'Thoroughness', value: sub.thoroughness ?? 0 },
          { label: 'Punctuality', value: sub.punctuality ?? 0 },
          { label: 'Communication', value: sub.communication ?? 0 },
          { label: 'Value for money', value: valueForMoney },
        ]
      : null,
    ratingsNote:
      !hasNativeSubRatings && importedReviews.length > 0
        ? 'No Rena jobs yet — the category breakdown reflects completed Rena bookings only.'
        : null,
    experience: {
      years: profile.yearsExperience ?? null,
      jobs: profile.completedJobs,
      response: profile.responseTime ? `~${profile.responseTime} min` : '~15 min',
    },
    services,
    reviews: reviewItems,
    reviewsSubtitle: 'Only verified customers who completed a booking can leave reviews.',
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-3xl sm:px-6 sm:py-10">
        <div className="bg-surface sm:overflow-hidden sm:rounded-[16px] sm:border sm:border-line">
          <CleanerProfileView data={data} />
        </div>
      </div>
    </div>
  );
}
