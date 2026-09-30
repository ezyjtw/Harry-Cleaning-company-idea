// R9d (James-spotted): served-area centroids are IMMUTABLE FACTS — resolve
// each outcode once, persist, and serve every later HQ view from the store
// with zero external calls.
//
// Shape: one PlatformConfig row (`hq_area_centroids`) holding a JSON map
// keyed by OUTCODE → {lat,lng}. Nine facts don't earn a table or a
// migration; keying by outcode means a hand-ruled outcode change simply
// misses the store and resolves fresh. The row is a cache, not reference
// data — the reference seed never touches it.
//
// The retry law: a FAILED lookup is never cached — the outcode stays absent
// from the map and retries on the next visit. Anything unresolved reads as
// the honest unknown ("excluded rather than guessed") exactly as before.

import { SERVICE_AREAS } from '@/lib/areas';
import prisma from '@/lib/db/prisma';
import { lookupOutcode } from '@/lib/utils/postcode';

const CENTROIDS_KEY = 'hq_area_centroids';

export interface AreaCentroid {
  lat: number;
  lng: number;
}

/**
 * Centroids for every served area, keyed by slug; null = unresolved (will
 * retry next visit). Reads the store first; only misses go out to
 * postcodes.io, and only successes are written back.
 */
export async function getAreaCentroids(): Promise<Map<string, AreaCentroid | null>> {
  let stored: Record<string, AreaCentroid> = {};
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: CENTROIDS_KEY } });
    if (row) {
      const parsed = JSON.parse(row.value) as Record<string, AreaCentroid>;
      if (parsed && typeof parsed === 'object') stored = parsed;
    }
  } catch {
    stored = {}; // unreadable store = resolve fresh, never crash the room
  }

  const result = new Map<string, AreaCentroid | null>();
  let wroteAnything = false;

  for (const area of SERVICE_AREAS) {
    const hit = stored[area.outcode];
    if (hit && typeof hit.lat === 'number' && typeof hit.lng === 'number') {
      result.set(area.slug, hit);
      continue;
    }
    // Store miss — one live lookup; success persists, failure stays absent.
    const geo = await lookupOutcode(area.outcode);
    if (geo) {
      const c = { lat: geo.latitude, lng: geo.longitude };
      stored[area.outcode] = c;
      result.set(area.slug, c);
      wroteAnything = true;
    } else {
      result.set(area.slug, null);
    }
  }

  if (wroteAnything) {
    try {
      await prisma.platformConfig.upsert({
        where: { key: CENTROIDS_KEY },
        update: { value: JSON.stringify(stored) },
        create: {
          key: CENTROIDS_KEY,
          value: JSON.stringify(stored),
          description:
            'R9d HQ cache: served-area outcode centroids (immutable facts, resolved once; failed lookups retry, never cached).',
        },
      });
    } catch {
      // A failed store write only costs a re-resolve next visit.
    }
  }

  return result;
}
