/* eslint-disable no-console */
// F12 heal: profile saves since the F4 deploy echoed the GET's presigned URL
// back into User.image, replacing the stored R2 key with a URL that expires in
// 24h (the write path is fixed; this restores the damaged rows). The original
// key is recoverable from the URL path: .../profile-photos/<file>?X-Amz-...
//
// DATA-OVERWRITING SCRIPT (James's diff-review law applies). Dry-run default.
//
//   railway run npx tsx scripts/heal-image-keys.ts            # report only
//   railway run npx tsx scripts/heal-image-keys.ts -- --apply # write the keys
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractKey(url: string): string | null {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const m = path.match(/(profile-photos\/[^/?]+)$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const users = await prisma.user.findMany({
    where: { image: { startsWith: 'http' }, isDeleted: false },
    select: { id: true, email: true, image: true },
  });

  const fixable: { id: string; email: string; key: string }[] = [];
  const unfixable: string[] = [];
  for (const u of users) {
    const key = extractKey(u.image as string);
    if (key) fixable.push({ id: u.id, email: u.email, key });
    else unfixable.push(`${u.email} — ${String(u.image).slice(0, 80)}`);
  }

  console.log(
    `[heal-image-keys] ${users.length} user(s) with http image values: ${fixable.length} recoverable, ${unfixable.length} not ours (left alone)`
  );
  for (const f of fixable) console.log(`  RESTORE ${f.email} -> ${f.key}`);
  for (const u of unfixable) console.log(`  SKIP    ${u}`);

  if (!apply) {
    console.log('[heal-image-keys] dry run — pass --apply to write');
    return;
  }
  for (const f of fixable) {
    await prisma.user.update({ where: { id: f.id }, data: { image: f.key } });
  }
  console.log(`[heal-image-keys] restored ${fixable.length} row(s)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
