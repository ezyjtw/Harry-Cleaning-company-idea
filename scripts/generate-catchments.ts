/* eslint-disable no-console */
// B (James-ruled): throttled batch migration — generate travel-time isochrone
// catchments for every existing cleaner with a home postcode.
//
// ORS free tier: ~500 req/day, ~20 req/min. This script sleeps 3.5s between
// calls (~17/min) and hard-stops at 450 generations to leave daily headroom.
//
// Usage:
//   npx tsx scripts/generate-catchments.ts --dry-run   # print the plan only
//   npx tsx scripts/generate-catchments.ts             # run (needs ORS_API_KEY)
//   npx tsx scripts/generate-catchments.ts --force     # regenerate even if a
//                                                      # polygon already exists
//
// Lazy generation (profile-save / onboarding triggers) remains the safety net
// for anything this batch misses or fails on.

import { PrismaClient } from '@prisma/client';

import { generateCatchmentForCleaner } from '../src/lib/services/catchment-generation.service';
import { haversineDistance } from '../src/lib/utils/postcode';

const prisma = new PrismaClient();

// F9: reach = max crow-flies km from the home point to any polygon vertex.
// Printed before/after each regeneration so a calibration run reports its own
// sanity check (e.g. the E4 7AP 30-min polygon's reach pre/post ×0.7).
function polygonReachKm(
  polygon: unknown,
  homeLat: number | null,
  homeLng: number | null
): number | null {
  if (!polygon || homeLat === null || homeLng === null) return null;
  try {
    const fc = polygon as { features?: { geometry?: { coordinates?: unknown } }[] };
    let max = 0;
    for (const f of fc.features ?? []) {
      const rings = (f.geometry?.coordinates ?? []) as number[][][];
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          const d = haversineDistance(homeLat, homeLng, lat, lng);
          if (d > max) max = d;
        }
      }
    }
    return max > 0 ? Math.round(max * 10) / 10 : null;
  } catch {
    return null;
  }
}

const THROTTLE_MS = 3500;
const DAILY_CAP = 450;

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cleaners = await prisma.cleanerProfile.findMany({
    where: {
      user: { isDeleted: false, accountStatus: 'ACTIVE' },
      OR: [{ homePostcode: { not: null } }, { postcode: { not: null } }],
      // "No stored catchment" = generation never completed. Filtered on the
      // DateTime column, NOT the Json one: Prisma Json filters split SQL NULL
      // (DbNull) from JSON null (JsonNull), and `equals: null` silently meant
      // JsonNull — matching zero rows on freshly-added SQL-NULL columns. The
      // first dry-run's "0 cleaners" was THIS bug, not an empty roster.
      ...(force ? {} : { catchmentGeneratedAt: null }),
    },
    select: {
      id: true,
      userId: true,
      homePostcode: true,
      postcode: true,
      maxTravelMinutes: true,
      catchmentGeneratedAt: true,
      catchmentPolygon: true,
      homeLatitude: true,
      homeLongitude: true,
      latitude: true,
      longitude: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `${cleaners.length} cleaner(s) ${force ? '(force mode: regenerating all)' : 'without a stored catchment'}; ` +
      `cap ${DAILY_CAP}/run, throttle ${THROTTLE_MS}ms (~${Math.round(60000 / THROTTLE_MS)}/min)`
  );
  if (cleaners.length > DAILY_CAP) {
    console.log(
      `NOTE: ${cleaners.length - DAILY_CAP} cleaner(s) exceed today's cap — run again tomorrow for the remainder.`
    );
  }

  if (dryRun) {
    for (const c of cleaners.slice(0, DAILY_CAP)) {
      console.log(
        `  would generate: ${c.user.name ?? c.userId} · ${c.homePostcode || c.postcode} · ${c.maxTravelMinutes ?? 30} min`
      );
    }
    console.log('(dry run — nothing generated)');
    return;
  }

  if (!process.env.ORS_API_KEY) {
    console.error(
      'ORS_API_KEY is not set — aborting. (James: create the key and add it to Railway first.)'
    );
    process.exitCode = 1;
    return;
  }

  let generated = 0;
  let failed = 0;
  for (const c of cleaners.slice(0, DAILY_CAP)) {
    const homeLat = c.homeLatitude ?? c.latitude;
    const homeLng = c.homeLongitude ?? c.longitude;
    const beforeKm = polygonReachKm(c.catchmentPolygon, homeLat, homeLng);
    const result = await generateCatchmentForCleaner(c.userId);
    if (result.status === 'generated') {
      generated++;
      const fresh = await prisma.cleanerProfile.findUnique({
        where: { id: c.id },
        select: { catchmentPolygon: true, catchmentSource: true },
      });
      const afterKm = polygonReachKm(fresh?.catchmentPolygon, homeLat, homeLng);
      console.log(
        `  ✓ ${c.user.name ?? c.userId} · ${c.homePostcode || c.postcode} · ${c.maxTravelMinutes ?? 30} min ` +
          `· reach ${beforeKm ?? '—'} km → ${afterKm ?? '—'} km · ${fresh?.catchmentSource}`
      );
    } else {
      failed++;
      console.warn(
        `  ✗ ${c.user.name ?? c.userId}: ${'reason' in result ? result.reason : result.status}`
      );
    }
    await sleep(THROTTLE_MS);
  }
  console.log(
    `done: ${generated} generated, ${failed} failed/skipped (lazy triggers will retry failures).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
