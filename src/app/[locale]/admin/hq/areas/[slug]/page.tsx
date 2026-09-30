import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getServiceArea } from '@/lib/areas';
import { prisma } from '@/lib/db/prisma';
import { placesConfigured } from '@/lib/hq/places.service';

import { HqCard, HqLabel, RoomShell, StatusDot } from '../../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — Area intel, per-area page: the competitor set with ratings and
// counts, sampled Places reviews (the ≤5 the API serves, cached ≤30 days),
// and the trend since the previous refresh.

export default async function AreaIntelPage({ params }: { params: { slug: string } }) {
  const area = getServiceArea(params.slug);
  if (!area) notFound();

  const places = await prisma.competitorPlace.findMany({
    where: { area: params.slug },
    include: {
      observations: { orderBy: { observedAt: 'desc' }, take: 2 },
      reviews: { orderBy: { publishedAt: 'desc' } },
    },
    orderBy: { name: 'asc' },
  });

  const dormant = !placesConfigured();

  return (
    <RoomShell
      title={`${area.name} (${area.outcode})`}
      backHref="/admin/hq/areas"
      backLabel="Area intel"
      subtitle="Competitor set for this area — ratings, counts, trend since last refresh, sampled reviews."
    >
      {places.length === 0 ? (
        <HqCard className="p-5">
          <p className="flex items-center gap-2 text-sm font-light text-[#3D5170]">
            <StatusDot tone="idle" />
            {dormant
              ? 'No competitor data yet — the Places refresh is dormant until GOOGLE_PLACES_API_KEY is set.'
              : 'No competitors recorded for this area yet — the weekly refresh will populate it.'}
          </p>
        </HqCard>
      ) : (
        <div className="space-y-4">
          {places.map((p) => {
            const [latest, previous] = p.observations;
            const ratingDelta =
              typeof latest?.rating === 'number' && typeof previous?.rating === 'number'
                ? latest.rating - previous.rating
                : null;
            const countDelta =
              typeof latest?.ratingCount === 'number' && typeof previous?.ratingCount === 'number'
                ? latest.ratingCount - previous.ratingCount
                : null;
            return (
              <HqCard key={p.id} className="p-5">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/admin/hq/competitors/${p.id}`}
                    className="text-sm font-semibold text-[#16296b] hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="text-sm font-light text-[#3D5170]">
                    {typeof latest?.rating === 'number'
                      ? `★ ${latest.rating.toFixed(1)}`
                      : 'unrated'}
                    {typeof latest?.ratingCount === 'number' && ` · ${latest.ratingCount} reviews`}
                  </p>
                </div>
                <p className="mt-1 text-xs font-light text-[#8A97AB]">
                  Trend since last refresh:{' '}
                  {ratingDelta === null && countDelta === null
                    ? 'first observation — trend starts next refresh'
                    : [
                        ratingDelta !== null
                          ? `rating ${ratingDelta >= 0 ? '+' : ''}${ratingDelta.toFixed(2)}`
                          : null,
                        countDelta !== null
                          ? `${countDelta >= 0 ? '+' : ''}${countDelta} reviews`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                {p.reviews.length > 0 && (
                  <div className="mt-3">
                    <HqLabel>Sampled reviews</HqLabel>
                    <ul className="mt-1.5 space-y-2">
                      {p.reviews.slice(0, 3).map((r) => (
                        <li key={r.id} className="rounded-xl bg-[#FAFBFC] p-2.5">
                          <p className="text-xs font-light text-[#3D5170]">
                            {typeof r.rating === 'number' && (
                              <span className="font-semibold">★ {r.rating} — </span>
                            )}
                            {r.text
                              ? `“${r.text.slice(0, 240)}${r.text.length > 240 ? '…' : ''}”`
                              : 'no text'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </HqCard>
            );
          })}
        </div>
      )}
    </RoomShell>
  );
}
