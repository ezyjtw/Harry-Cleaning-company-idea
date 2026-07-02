/**
 * Makes the existing SEED/TEST cleaner rows matchable so time-first + cascade
 * matching can be tested against seed data.
 *
 * Two things block seed cleaners from MatchingService.findMatches today:
 *   1. acknowledgmentVersion is null  -> excluded at step 1 (A14 ack gate).
 *   2. latitude/longitude + maxTravelMinutes are null -> excluded by the real
 *      distance area filter (Bug 2 fix).
 * This backfills both on the known seed rows.
 *
 * SAFETY: scoped to the fixed @example.com seed emails ONLY. It never touches a
 * real cleaner — forcing an ack version onto a real cleaner who hasn't
 * re-acknowledged would corrupt the A14 legal record.
 *
 * Usage:
 *   npx tsx scripts/backfill-seed-cleaners-matchable.ts        # apply
 *   npx tsx scripts/backfill-seed-cleaners-matchable.ts --dry  # report only
 *
 * Prerequisites: DATABASE_URL points at the target (dev/staging) database.
 * Do NOT run against production — these are test accounts.
 */

import { PrismaClient } from '@prisma/client';

import { CURRENT_AGREEMENT_VERSION } from '../src/lib/legal/self-employment-acknowledgment';

const prisma = new PrismaClient();

const SEED_CLEANER_EMAILS = [
  'maria@example.com',
  'james@example.com',
  'aisha@example.com',
  'katarzyna@example.com',
  'elena@example.com',
  'agnieszka@example.com',
];

const DEFAULT_MAX_TRAVEL_MINUTES = 45;

/** Geocode a full postcode OR an outward code (e.g. "SW4") via postcodes.io. */
async function geocode(pc: string): Promise<{ latitude: number; longitude: number } | null> {
  const cleaned = pc.trim().replace(/\s+/g, '');
  const isOutcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(cleaned);
  const url = isOutcode
    ? `https://api.postcodes.io/outcodes/${encodeURIComponent(cleaned)}`
    : `https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 200 || !data.result) return null;
    return { latitude: data.result.latitude, longitude: data.result.longitude };
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry');

  const profiles = await prisma.cleanerProfile.findMany({
    where: { user: { email: { in: SEED_CLEANER_EMAILS } } },
    select: {
      id: true,
      postcode: true,
      latitude: true,
      longitude: true,
      maxTravelMinutes: true,
      acknowledgmentVersion: true,
      user: { select: { email: true } },
    },
  });

  console.log(
    `Found ${profiles.length} seed cleaner profile(s)${dryRun ? ' (dry run — no writes)' : ''}.`
  );

  let ackSet = 0;
  let geoSet = 0;
  let travelSet = 0;
  const unresolved: string[] = [];

  for (const p of profiles) {
    const data: Record<string, unknown> = {};

    if (p.acknowledgmentVersion !== CURRENT_AGREEMENT_VERSION) {
      data.acknowledgmentVersion = CURRENT_AGREEMENT_VERSION;
      ackSet++;
    }

    if ((p.latitude === null || p.longitude === null) && p.postcode) {
      const geo = await geocode(p.postcode);
      if (geo) {
        data.latitude = geo.latitude;
        data.longitude = geo.longitude;
        data.homePostcode = p.postcode.toUpperCase();
        data.homeLatitude = geo.latitude;
        data.homeLongitude = geo.longitude;
        data.homeGeocodedAt = new Date();
        geoSet++;
      } else {
        unresolved.push(`${p.user.email} (postcode: ${p.postcode})`);
      }
    }

    if (p.maxTravelMinutes === null) {
      data.maxTravelMinutes = DEFAULT_MAX_TRAVEL_MINUTES;
      travelSet++;
    }

    const willChange = Object.keys(data).length > 0;
    console.log(
      `  ${p.user.email}: ${willChange ? Object.keys(data).join(', ') : 'already matchable — no change'}`
    );

    if (willChange && !dryRun) {
      await prisma.cleanerProfile.update({ where: { id: p.id }, data });
    }
  }

  console.log('');
  console.log(`acknowledgmentVersion set: ${ackSet}`);
  console.log(`geo (lat/lng/home*) set:   ${geoSet}`);
  console.log(`maxTravelMinutes set:      ${travelSet}`);
  if (unresolved.length) {
    console.log('');
    console.log(`Could not geocode (still excluded by area filter):`);
    for (const u of unresolved) console.log(`  - ${u}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
