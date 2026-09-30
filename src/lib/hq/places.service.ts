// R9 (HQ Area-intel + Competitors rooms): Google Places API (New) — the
// terms-compliant shape ratified in Phase 1. NO scraping anywhere: Text Search
// (places:searchText) for discovery, Place Details for rating/count and the
// up-to-5 most-relevant reviews the API legitimately serves.
//
// ToS handling, as ratified: place IDs are storable indefinitely
// (CompetitorPlace); the TREND is our own dated numeric observations
// (CompetitorObservation — rating, count, refresh date — kept forever);
// served CONTENT (review text) is cached at most 30 days (CompetitorReview
// with a hard expiresAt) and re-fetched each weekly refresh — expired rows
// are deleted at the top of every refresh.
//
// DORMANT until James sets GOOGLE_PLACES_API_KEY in Railway (like Xero/Groq):
// placesConfigured() === false ⇒ the refresh lane skips and the rooms show
// the honest "dormant" state. Every call is counted via countedCall.

import { countedCall } from '@/lib/api-metering';
import { SERVICE_AREAS } from '@/lib/areas';
import prisma from '@/lib/db/prisma';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const REVIEW_TTL_DAYS = 30;
const MAX_DETAILS_PER_AREA = 6;

// The ruled competitor set — extendable by adding a row here.
export const COMPETITOR_BRANDS: Array<{ key: string; label: string; query: string }> = [
  { key: 'housekeep', label: 'Housekeep', query: 'Housekeep home cleaning London' },
  { key: 'wecasa', label: 'WeCasa', query: 'Wecasa cleaning London' },
  { key: 'taskrabbit', label: 'TaskRabbit', query: 'TaskRabbit cleaning London' },
  { key: 'bark', label: 'Bark', query: 'Bark.com cleaning services London' },
];

export function placesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

interface TextSearchPlace {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
}

interface PlaceDetails {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    authorAttribution?: { displayName?: string };
    publishTime?: string;
  }>;
}

async function searchText(query: string): Promise<TextSearchPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY as string;
  const res = await countedCall('google_places', 'POST /v1/places:searchText', async () => {
    const r = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: MAX_DETAILS_PER_AREA }),
    });
    if (!r.ok) throw new Error(`Places searchText ${r.status}`);
    return (await r.json()) as { places?: TextSearchPlace[] };
  });
  return res.places ?? [];
}

async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY as string;
  try {
    return await countedCall('google_places', 'GET /v1/places/{id}', async () => {
      const r = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
        },
      });
      if (!r.ok) throw new Error(`Places details ${r.status}`);
      return (await r.json()) as PlaceDetails;
    });
  } catch {
    return null; // one place failing never sinks the refresh
  }
}

/** Upsert the place row, append today's observation, replace its sampled reviews. */
async function recordPlace(
  d: PlaceDetails,
  discovery: { area?: string; brand?: string }
): Promise<void> {
  const place = await prisma.competitorPlace.upsert({
    where: { placeId: d.id },
    update: {
      name: d.displayName?.text || 'Unknown',
      // keep first-seen area/brand; a later discovery never reassigns
    },
    create: {
      placeId: d.id,
      name: d.displayName?.text || 'Unknown',
      area: discovery.area ?? null,
      brand: discovery.brand ?? null,
    },
  });

  await prisma.competitorObservation.create({
    data: {
      placeRefId: place.id,
      rating: d.rating ?? null,
      ratingCount: d.userRatingCount ?? null,
    },
  });

  // Replace sampled content wholesale — the ≤30-day cache window restarts.
  await prisma.competitorReview.deleteMany({ where: { placeRefId: place.id } });
  const expiresAt = new Date(Date.now() + REVIEW_TTL_DAYS * 24 * 60 * 60 * 1000);
  const reviews = (d.reviews ?? []).slice(0, 5);
  if (reviews.length > 0) {
    await prisma.competitorReview.createMany({
      data: reviews.map((rv) => ({
        placeRefId: place.id,
        rating: rv.rating ?? null,
        text: rv.text?.text?.slice(0, 4000) ?? null,
        author: rv.authorAttribution?.displayName?.slice(0, 120) ?? null,
        publishedAt: rv.publishTime ? new Date(rv.publishTime) : null,
        expiresAt,
      })),
    });
  }
}

export interface PlacesRefreshResult {
  status: 'refreshed' | 'skipped';
  reason?: string;
  placesTouched?: number;
}

/**
 * The weekly refresh: expired-content sweep, then per-area discovery
 * ("cleaning service in <area>") + the named brands once each, then details
 * per discovered place. ~9×(1 search + ≤6 details) + 4 brand legs weekly —
 * inside the free allowance, per the ratified census.
 */
export async function refreshCompetitorIntel(): Promise<PlacesRefreshResult> {
  if (!placesConfigured()) {
    return { status: 'skipped', reason: 'GOOGLE_PLACES_API_KEY not set (feature dormant)' };
  }

  // ToS sweep first: served content never outlives its window, even if a
  // refresh later fails halfway.
  await prisma.competitorReview.deleteMany({ where: { expiresAt: { lte: new Date() } } });

  let touched = 0;

  for (const area of SERVICE_AREAS) {
    try {
      const found = await searchText(`cleaning service in ${area.name} London`);
      for (const p of found.slice(0, MAX_DETAILS_PER_AREA)) {
        const d = await placeDetails(p.id);
        if (d) {
          await recordPlace(d, { area: area.slug });
          touched++;
        }
      }
    } catch {
      // one area failing never sinks the rest
    }
  }

  for (const brand of COMPETITOR_BRANDS) {
    try {
      const found = await searchText(brand.query);
      const top = found[0];
      if (top) {
        const d = await placeDetails(top.id);
        if (d) {
          await recordPlace(d, { brand: brand.key });
          touched++;
        }
      }
    } catch {
      // same: fail-soft per brand
    }
  }

  return { status: 'refreshed', placesTouched: touched };
}
