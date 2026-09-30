import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import Link from 'next/link';

import { SERVICE_AREAS } from '@/lib/areas';
import { prisma } from '@/lib/db/prisma';
import { getAreaCentroids } from '@/lib/hq/area-centroids';
import { placesConfigured } from '@/lib/hq/places.service';
import { extractPolygon } from '@/lib/services/coverage.service';

import { HqCard, HqLabel, RoomShell, StatusDot } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — Area intel room (the corridor): one card per served area, each a
// door to its per-area page. The ad-priority ranking is computed from VISIBLE
// factors, each shown with its contribution — reasoning on the card, never a
// black-box score.

export default async function AreasRoom() {
  const dormant = !placesConfigured();

  const [places, waitlist, profiles] = await Promise.all([
    prisma.competitorPlace.findMany({
      where: { area: { not: null } },
      include: { observations: { orderBy: { observedAt: 'desc' }, take: 1 } },
    }),
    prisma.waitlistEntry.findMany({ select: { postcode: true } }),
    prisma.cleanerProfile.findMany({
      where: {
        catchmentPolygon: { not: { equals: null } },
        user: { isDeleted: false, accountStatus: 'ACTIVE' },
      },
      select: { catchmentPolygon: true },
    }),
  ]);

  const features = profiles
    .map((p) => extractPolygon(p.catchmentPolygon))
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // R9d: centroids from the persistent store — zero external calls per view
  // once settled; unresolved areas stay the honest unknown.
  const centroids = await getAreaCentroids();
  const areas = SERVICE_AREAS.map((a) => {
    const areaPlaces = places.filter((p) => p.area === a.slug);
    const rated = areaPlaces
      .map((p) => p.observations[0]?.rating)
      .filter((r): r is number => typeof r === 'number');
    const avgRating = rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : null;

    const centroid = centroids.get(a.slug) ?? null;
    let covered: boolean | null = null;
    if (centroid) {
      covered = features.some((f) => {
        try {
          return booleanPointInPolygon(point([centroid.lng, centroid.lat]), f);
        } catch {
          return false;
        }
      });
    }

    const demand = waitlist.filter((w) =>
      w.postcode.toUpperCase().replace(/\s+/g, '').startsWith(a.outcode.toUpperCase())
    ).length;

    // Visible ranking factors — each line is shown on the card.
    const factors: Array<{ label: string; pts: number }> = [];
    if (covered === false) factors.push({ label: 'coverage gap (no live catchment)', pts: 3 });
    if (demand > 0)
      factors.push({
        label: `${demand} waitlist signup${demand === 1 ? '' : 's'}`,
        pts: Math.min(demand, 3),
      });
    if (!dormant && areaPlaces.length === 0)
      factors.push({ label: 'no tracked competitors (open field)', pts: 1 });
    if (avgRating !== null && avgRating < 4.5)
      factors.push({ label: `competitors average ★ ${avgRating.toFixed(1)} (beatable)`, pts: 1 });
    const score = factors.reduce((s, f) => s + f.pts, 0);

    return {
      slug: a.slug,
      name: a.name,
      outcode: a.outcode,
      competitorCount: areaPlaces.length,
      avgRating,
      covered,
      demand,
      factors,
      score,
    };
  });

  const ranked = areas.slice().sort((x, y) => y.score - x.score);

  return (
    <RoomShell
      title="Area intel"
      subtitle="Every served area, ranked for ad priority. Each ranking shows its reasoning — the factors ARE the score."
    >
      {dormant && (
        <HqCard className="mb-4 p-4">
          <p className="flex items-center gap-2 text-sm font-light text-[#3D5170]">
            <StatusDot tone="idle" />
            Competitor data is dormant — set{' '}
            <span className="font-mono text-xs">GOOGLE_PLACES_API_KEY</span> in Railway and the
            weekly refresh wakes on the next scheduler tick. Coverage and demand factors below are
            live from our own data.
          </p>
        </HqCard>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ranked.map((a, i) => (
          <Link key={a.slug} href={`/admin/hq/areas/${a.slug}`} className="group block">
            <HqCard className="p-5 transition-colors group-hover:border-[#16296b]/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#16296b]">
                  {a.name} <span className="font-light text-[#8A97AB]">({a.outcode})</span>
                </p>
                <span className="rounded-full bg-[#16296b] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  ad priority #{i + 1}
                </span>
              </div>
              <p className="mt-2 text-sm font-light text-[#3D5170]">
                {a.competitorCount} tracked competitor{a.competitorCount === 1 ? '' : 's'}
                {a.avgRating !== null && ` · avg ★ ${a.avgRating.toFixed(2)}`}
                {' · '}
                {a.covered === false ? (
                  <span className="font-semibold text-red-600">coverage gap</span>
                ) : a.covered === true ? (
                  'covered'
                ) : (
                  'coverage unknown'
                )}
              </p>
              <div className="mt-3">
                <HqLabel>Why this rank</HqLabel>
                {a.factors.length === 0 ? (
                  <p className="mt-1 text-xs font-light text-[#8A97AB]">
                    No pressure factors — covered, no queued demand.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {a.factors.map((f) => (
                      <li key={f.label} className="text-xs font-light text-[#3D5170]">
                        +{f.pts} — {f.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </HqCard>
          </Link>
        ))}
      </div>
    </RoomShell>
  );
}
