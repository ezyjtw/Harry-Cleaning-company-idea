// F6 sweep (REPORT ONLY — writes nothing): every cleaner's stored home
// postcode, checked for the polygon-generation guarantees:
//   MALFORMED   — doesn't normalise to a complete "E4 7AP" form (no polygon anchor)
//   NOT_FOUND   — well-formed but postcodes.io says it doesn't exist
//   MISSING     — no postcode stored at all
//   UNNORMALISED — geocodes fine but stored in a non-canonical form
//   OK          — canonical and geocodes
// Also reports whether each affected cleaner currently has coordinates and a
// catchment polygon — cleaners in the first three buckets have no working
// polygon today and don't know it.
//
//   npx tsx scripts/audit-home-postcodes.ts
import prisma from '../src/lib/db/prisma';
import { lookupPostcodeOutcome } from '../src/lib/utils/postcode';
import { normalizeUkPostcode } from '../src/lib/validation/inputs';

async function main() {
  const profiles = await prisma.cleanerProfile.findMany({
    select: {
      id: true,
      homePostcode: true,
      postcode: true,
      homeLatitude: true,
      latitude: true,
      catchmentGeneratedAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  let ok = 0;
  const problems: string[] = [];

  for (const p of profiles) {
    const stored = p.homePostcode || p.postcode;
    const state = `coords=${(p.homeLatitude ?? p.latitude) ? 'yes' : 'NO'} polygon=${
      p.catchmentGeneratedAt ? 'yes' : 'NO'
    }`;
    if (!stored) {
      problems.push(`MISSING      ${p.user.email} (${p.user.name}) — no postcode stored; ${state}`);
      continue;
    }
    const norm = normalizeUkPostcode(stored);
    if (!norm) {
      problems.push(`MALFORMED    ${p.user.email} (${p.user.name}) — stored "${stored}"; ${state}`);
      continue;
    }
    const lookup = await lookupPostcodeOutcome(norm);
    if (lookup.status === 'unavailable') {
      console.error('[audit] postcodes.io unavailable — aborting sweep, rerun later');
      process.exit(2);
    }
    if (lookup.status === 'not_found') {
      problems.push(
        `NOT_FOUND    ${p.user.email} (${p.user.name}) — "${norm}" doesn't geocode; ${state}`
      );
      continue;
    }
    if (stored !== norm) {
      problems.push(
        `UNNORMALISED ${p.user.email} (${p.user.name}) — stored "${stored}", canonical "${norm}"; ${state}`
      );
      continue;
    }
    ok++;
  }

  console.log(
    `[audit-home-postcodes] ${profiles.length} cleaners: ${ok} OK, ${problems.length} flagged`
  );
  for (const line of problems) console.log('  ' + line);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
