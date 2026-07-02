/**
 * Backfills geocoded coordinates for cleaner profiles that have a postcode set
 * but no latitude (the coverage-less state that the new base /api/cleaners gate
 * now excludes everywhere). Re-geocodes each via postcodes.io and populates
 * latitude/longitude + homeLatitude/homeLongitude + homeGeocodedAt (and
 * homePostcode where missing) so existing cleaners aren't silently dropped.
 *
 * Usage:
 *   npx tsx scripts/backfill-cleaner-geo.ts          # apply
 *   npx tsx scripts/backfill-cleaner-geo.ts --dry    # report only, no writes
 *
 * Prerequisites:
 *   - DATABASE_URL must point to the target database.
 *
 * Safe to re-run: it only touches rows whose latitude is still null. Rows whose
 * postcode won't geocode are left untouched and reported as unresolved (a human
 * needs to fix the postcode, or the cleaner stays excluded until they do).
 */

import { PrismaClient } from '@prisma/client';

import { lookupPostcode } from '../src/lib/utils/postcode';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry');

  const stale = await prisma.cleanerProfile.findMany({
    where: {
      latitude: null,
      postcode: { not: null },
    },
    select: {
      id: true,
      postcode: true,
      homePostcode: true,
      maxTravelMinutes: true,
      user: { select: { email: true } },
    },
  });

  console.log(
    `Found ${stale.length} cleaner profile(s) with a postcode but no latitude${
      dryRun ? ' (dry run — no writes)' : ''
    }.`
  );

  let resolved = 0;
  const unresolved: { email: string; postcode: string | null }[] = [];
  const stillNoTravel: string[] = [];

  for (const p of stale) {
    const pc = (p.postcode || '').trim();
    const geo = pc ? await lookupPostcode(pc) : null;

    if (!geo) {
      unresolved.push({ email: p.user.email, postcode: p.postcode });
      continue;
    }

    if (!dryRun) {
      await prisma.cleanerProfile.update({
        where: { id: p.id },
        data: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          homePostcode: p.homePostcode || pc.toUpperCase(),
          homeLatitude: geo.latitude,
          homeLongitude: geo.longitude,
          homeGeocodedAt: new Date(),
        },
      });
    }

    resolved++;
    // Geo is now set, but the base gate ALSO requires maxTravelMinutes. Flag any
    // profile that will still be excluded until an admin/cleaner sets a travel time.
    if (p.maxTravelMinutes === null) stillNoTravel.push(p.user.email);
  }

  console.log('');
  console.log(`Resolved (geocoded):        ${resolved}`);
  console.log(`Unresolved (bad postcode):  ${unresolved.length}`);
  if (unresolved.length) {
    for (const u of unresolved) console.log(`  - ${u.email} (postcode: ${u.postcode ?? 'none'})`);
  }
  if (stillNoTravel.length) {
    console.log('');
    console.log(
      `Note: ${stillNoTravel.length} geocoded profile(s) still have no maxTravelMinutes and`
    );
    console.log('remain excluded by the coverage gate until a travel time is set:');
    for (const email of stillNoTravel) console.log(`  - ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
