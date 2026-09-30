import Link from 'next/link';

import { prisma } from '@/lib/db/prisma';
import { COMPETITOR_BRANDS, placesConfigured } from '@/lib/hq/places.service';

import { HqCard, HqLabel, RoomShell, StatusDot } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — Competitors room (the corridor): the named competitor set
// (Housekeep, WeCasa, TaskRabbit, Bark — extendable in COMPETITOR_BRANDS)
// plus every local find the area sweeps discovered. Each entry is a door to
// its per-competitor page.

export default async function CompetitorsRoom() {
  const places = await prisma.competitorPlace.findMany({
    include: { observations: { orderBy: { observedAt: 'desc' }, take: 1 } },
    orderBy: { name: 'asc' },
  });
  const dormant = !placesConfigured();

  const brandPlaces = new Map(places.filter((p) => p.brand).map((p) => [p.brand as string, p]));
  const localFinds = places.filter((p) => !p.brand);

  return (
    <RoomShell
      title="Competitors"
      subtitle="The named set plus every local find. Tap one for its trend, reviews and notes."
    >
      <div className="space-y-4">
        <div>
          <HqLabel>Named competitors</HqLabel>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMPETITOR_BRANDS.map((b) => {
              const p = brandPlaces.get(b.key);
              const latest = p?.observations[0];
              const card = (
                <HqCard
                  className={`p-4 ${p ? 'transition-colors hover:border-[#16296b]/40' : ''}`}
                  key={b.key}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#16296b]">{b.label}</p>
                    {p ? (
                      <p className="text-sm font-light text-[#3D5170]">
                        {typeof latest?.rating === 'number'
                          ? `★ ${latest.rating.toFixed(1)}`
                          : 'unrated'}
                        {typeof latest?.ratingCount === 'number' && ` · ${latest.ratingCount}`}
                      </p>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] font-light text-[#8A97AB]">
                        <StatusDot tone="idle" />
                        {dormant ? 'awaiting key' : 'awaiting first refresh'}
                      </span>
                    )}
                  </div>
                </HqCard>
              );
              return p ? (
                <Link key={b.key} href={`/admin/hq/competitors/${p.id}`} className="block">
                  {card}
                </Link>
              ) : (
                card
              );
            })}
          </div>
        </div>

        <div>
          <HqLabel>Local finds (from the area sweeps)</HqLabel>
          {localFinds.length === 0 ? (
            <HqCard className="mt-2 p-4">
              <p className="flex items-center gap-2 text-sm font-light text-[#3D5170]">
                <StatusDot tone="idle" />
                {dormant
                  ? 'Dormant — the weekly sweep starts finding local competitors once GOOGLE_PLACES_API_KEY lands.'
                  : 'Nothing found yet — populates on the weekly refresh.'}
              </p>
            </HqCard>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {localFinds.map((p) => {
                const latest = p.observations[0];
                return (
                  <Link key={p.id} href={`/admin/hq/competitors/${p.id}`} className="block">
                    <HqCard className="p-4 transition-colors hover:border-[#16296b]/40">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#16296b]">{p.name}</p>
                        <p className="text-sm font-light text-[#3D5170]">
                          {typeof latest?.rating === 'number'
                            ? `★ ${latest.rating.toFixed(1)}`
                            : 'unrated'}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] font-light text-[#8A97AB]">
                        found in {p.area ?? 'unknown area'}
                      </p>
                    </HqCard>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RoomShell>
  );
}
