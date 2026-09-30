import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { COMPETITOR_BRANDS } from '@/lib/hq/places.service';

import { HqCard, HqLabel, MiniBars, RoomShell } from '../../HqKit';

import CompetitorNotes from './CompetitorNotes';

export const dynamic = 'force-dynamic';

// R9 HQ — Competitors room, per-competitor page: rating/count trend from our
// dated observations, sampled positive and negative reviews separated,
// per-area presence, and the manual paste-in notes slot.

export default async function CompetitorPage({ params }: { params: { id: string } }) {
  const place = await prisma.competitorPlace.findUnique({
    where: { id: params.id },
    include: {
      observations: { orderBy: { observedAt: 'asc' } },
      reviews: { orderBy: { publishedAt: 'desc' } },
    },
  });
  if (!place) notFound();

  const brand = COMPETITOR_BRANDS.find((b) => b.key === place.brand);
  const latest = place.observations[place.observations.length - 1];
  const positive = place.reviews.filter((r) => (r.rating ?? 0) >= 4);
  const negative = place.reviews.filter((r) => typeof r.rating === 'number' && r.rating <= 3);

  // Per-area presence: same brand across areas, or this local find's area.
  const presence = place.brand
    ? await prisma.competitorPlace.findMany({
        where: { brand: place.brand, area: { not: null } },
        select: { area: true },
      })
    : null;

  return (
    <RoomShell
      title={brand ? brand.label : place.name}
      backHref="/admin/hq/competitors"
      backLabel="Competitors"
      subtitle={
        latest
          ? `Currently ★ ${latest.rating?.toFixed(1) ?? '—'} across ${latest.ratingCount ?? '—'} reviews.`
          : 'No observations yet — the weekly refresh writes the first data point.'
      }
    >
      <div className="space-y-4">
        <HqCard className="p-5">
          <HqLabel>Review-count trend — one point per refresh</HqLabel>
          {place.observations.length === 0 ? (
            <p className="mt-2 text-sm font-light text-[#8A97AB]">Nothing observed yet.</p>
          ) : (
            <>
              <div className="mt-2">
                <MiniBars
                  values={place.observations.map((o) => o.ratingCount ?? 0)}
                  labels={{
                    first: place.observations[0].observedAt.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    }),
                    last: 'latest',
                  }}
                />
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                      <th className="py-1.5 pr-4">Refresh</th>
                      <th className="py-1.5 pr-4">Rating</th>
                      <th className="py-1.5">Reviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {place.observations
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((o) => (
                        <tr
                          key={o.id}
                          className="border-b border-[#F1F4F8] font-light text-[#3D5170]"
                        >
                          <td className="py-1.5 pr-4">
                            {o.observedAt.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-1.5 pr-4">{o.rating?.toFixed(2) ?? '—'}</td>
                          <td className="py-1.5">{o.ratingCount ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </HqCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HqCard className="p-5">
            <HqLabel>Sampled positive (★4–5)</HqLabel>
            <ReviewList reviews={positive} empty="No positive samples in the current window." />
          </HqCard>
          <HqCard className="p-5">
            <HqLabel>Sampled negative (★1–3)</HqLabel>
            <ReviewList reviews={negative} empty="No negative samples in the current window." />
          </HqCard>
        </div>

        <HqCard className="p-5">
          <HqLabel>Per-area presence</HqLabel>
          <p className="mt-2 text-sm font-light text-[#3D5170]">
            {place.brand
              ? presence && presence.length > 0
                ? `Seen in area sweeps: ${Array.from(new Set(presence.map((p) => p.area))).join(', ')}`
                : 'Platform competitor — not surfaced in any area sweep yet (tracked London-wide).'
              : `Local competitor, found in ${place.area ?? 'an unknown area'}.`}
          </p>
        </HqCard>

        <HqCard className="p-5">
          <HqLabel>Notes — paste-in slot</HqLabel>
          <CompetitorNotes id={place.id} initial={place.notes ?? ''} />
        </HqCard>
      </div>
    </RoomShell>
  );
}

function ReviewList({
  reviews,
  empty,
}: {
  reviews: Array<{
    id: string;
    rating: number | null;
    text: string | null;
    publishedAt: Date | null;
  }>;
  empty: string;
}) {
  if (reviews.length === 0) {
    return <p className="mt-2 text-sm font-light text-[#8A97AB]">{empty}</p>;
  }
  return (
    <ul className="mt-2 space-y-2">
      {reviews.slice(0, 5).map((r) => (
        <li key={r.id} className="rounded-xl bg-[#FAFBFC] p-2.5">
          <p className="text-xs font-light text-[#3D5170]">
            {typeof r.rating === 'number' && <span className="font-semibold">★ {r.rating} — </span>}
            {r.text ? `“${r.text.slice(0, 300)}${r.text.length > 300 ? '…' : ''}”` : 'no text'}
          </p>
          {r.publishedAt && (
            <p className="mt-1 text-[10px] font-light text-[#8A97AB]">
              {r.publishedAt.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
