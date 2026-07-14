// One-off heal: re-case User.name via displayName() for rows written before the
// wizard write-path fix (F5) — e.g. "harrison wright" → "Harrison Wright".
//
// DATA-OVERWRITING SCRIPT (James's diff-review law applies). Never runs
// automatically. Dry-run by default; pass --apply to write.
//
//   npx tsx scripts/heal-name-casing.ts           # report only
//   npx tsx scripts/heal-name-casing.ts --apply   # write the healed names
import prisma from '../src/lib/db/prisma';
import { displayName } from '../src/lib/utils/name';

async function main() {
  const apply = process.argv.includes('--apply');
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const stale = users.filter((u) => u.name && displayName(u.name) !== u.name);

  console.log(`[heal-name-casing] ${stale.length} of ${users.length} users need re-casing`);
  for (const u of stale) {
    console.log(`  ${u.email}: "${u.name}" -> "${displayName(u.name)}"`);
  }

  if (!apply) {
    console.log('[heal-name-casing] dry run — pass --apply to write');
    return;
  }
  for (const u of stale) {
    await prisma.user.update({ where: { id: u.id }, data: { name: displayName(u.name) } });
  }
  console.log(`[heal-name-casing] healed ${stale.length} rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
