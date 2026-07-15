/* eslint-disable no-console */
// F11 (REPORT ONLY — writes nothing): fetch every cleaner's stored profile
// photo from R2 and report what's ACTUALLY there — real pixel dimensions +
// bytes — so pixelation is diagnosed from the object, not guessed.
//
// Verdicts (largest render consumer today: 72px profile hero → 216px @3×):
//   RE-UPLOAD    shortest side < 256px — will pixelate on retina renders
//   BELOW-MASTER 256–799px — renders fine today, below the new 800px master
//   FULL         ≥ 800px
//
//   railway run npx tsx scripts/inspect-profile-photos.ts
import { PrismaClient } from '@prisma/client';

import { getObject } from '../src/lib/storage/r2-client';

const prisma = new PrismaClient();

function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0–SOF15 minus DHT(C4)/DAC(CC): frame headers carrying dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function main() {
  const users = await prisma.user.findMany({
    where: { image: { not: null }, isDeleted: false, cleanerProfile: { isNot: null } },
    select: { email: true, name: true, image: true },
  });
  console.log(`[inspect-profile-photos] ${users.length} cleaner(s) with a stored photo`);

  for (const u of users) {
    const key = u.image as string;
    if (key.startsWith('data:') || key.startsWith('http')) {
      console.log(`  LEGACY-URL   ${u.email} — image is not an R2 key (${key.slice(0, 40)}…)`);
      continue;
    }
    try {
      const buf = await getObject(key);
      const dims = jpegDimensions(buf) || pngDimensions(buf);
      const kb = Math.round(buf.length / 1024);
      if (!dims) {
        console.log(`  UNKNOWN-FMT  ${u.email} — ${key} · ${kb} KB (couldn't parse dimensions)`);
        continue;
      }
      const shortest = Math.min(dims.width, dims.height);
      const verdict =
        shortest < 256 ? 'RE-UPLOAD   ' : shortest < 800 ? 'BELOW-MASTER' : 'FULL        ';
      console.log(
        `  ${verdict} ${u.email} (${u.name}) — ${dims.width}×${dims.height} · ${kb} KB · ${key}`
      );
    } catch (e) {
      console.log(`  FETCH-FAIL   ${u.email} — ${key}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // r2-client keeps a cache-cleanup setInterval alive — exit explicitly or
    // the script (and James's `railway run`) hangs after finishing.
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
