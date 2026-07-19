// H49 rider (James-ruled): heal existing CleanerProfile rows that stored the
// old specialty label 'Elderly' → 'Elderly-Friendly' (the new house-style
// label). Specialties are stored as an array of label strings.
//
// DRY-RUN BY DEFAULT — prints what WOULD change and touches nothing. Pass
// `--apply` to write. Idempotent: rows already on 'Elderly-Friendly' are
// skipped; a row with both is de-duplicated.
//
//   Dry run:  npx tsx scripts/heal-elderly-specialty.ts
//   Apply:    npx tsx scripts/heal-elderly-specialty.ts --apply

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OLD = 'Elderly';
const NEW = 'Elderly-Friendly';

async function main() {
  const apply = process.argv.includes('--apply');

  const rows = await prisma.cleanerProfile.findMany({
    where: { specialties: { has: OLD } },
    select: { id: true, userId: true, specialties: true },
  });

  console.log(`[heal-elderly] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[heal-elderly] Rows carrying '${OLD}': ${rows.length}`);

  let changed = 0;
  for (const row of rows) {
    // Replace OLD with NEW, then de-dupe (a row might already have both).
    const next = Array.from(new Set(row.specialties.map((s) => (s === OLD ? NEW : s))));
    const isDifferent =
      next.length !== row.specialties.length || next.some((s, i) => s !== row.specialties[i]);
    if (!isDifferent) continue;
    changed++;
    console.log(
      `[heal-elderly] ${row.id} (user ${row.userId}): ${JSON.stringify(row.specialties)} → ${JSON.stringify(next)}`
    );
    if (apply) {
      await prisma.cleanerProfile.update({
        where: { id: row.id },
        data: { specialties: next },
      });
    }
  }

  console.log(
    `[heal-elderly] ${apply ? 'Updated' : 'Would update'} ${changed} row(s).${apply ? '' : ' Re-run with --apply to write.'}`
  );
}

main()
  .catch((e) => {
    console.error('[heal-elderly] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
