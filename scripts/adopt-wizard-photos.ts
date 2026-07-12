/* eslint-disable no-console */
// Wizard→profile photo adoption (James, from live testing): wizard profile
// photos were stored as ENCRYPTED photo_id documents (subType profile_photo)
// — a place no avatar surface reads. Future uploads now land on User.image
// directly (onboarding route fix); this one-off adopts EXISTING cleaners'
// wizard photos: decrypt from the document store → re-upload to the public
// profile-photos/ R2 path → set User.image. Idempotent: skips anyone who
// already has an image (a later manual re-upload wins over the wizard photo).
//
// Usage:
//   npx tsx scripts/adopt-wizard-photos.ts --dry-run
//   npx tsx scripts/adopt-wizard-photos.ts
// Run with Railway env (railway run) — needs DATABASE_URL + R2 credentials +
// DOCUMENT_ENCRYPTION_KEY.

import { PrismaClient } from '@prisma/client';

import { DocumentStorageService } from '../src/lib/services/document-storage.service';
import { putObject } from '../src/lib/storage/r2-client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const docs = await prisma.documentUpload.findMany({
    where: {
      documentType: 'photo_id',
      isDestroyed: false,
      metadata: { path: ['subType'], equals: 'profile_photo' },
    },
    select: { id: true, userId: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // newest wizard photo per user, and only for users without an image already
  const seen = new Set<string>();
  const candidates: typeof docs = [];
  for (const d of docs) {
    if (seen.has(d.userId)) continue;
    seen.add(d.userId);
    candidates.push(d);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: candidates.map((c) => c.userId) }, image: null, isDeleted: false },
    select: { id: true, name: true },
  });
  const eligible = candidates.filter((c) => users.some((u) => u.id === c.userId));

  console.log(
    `${docs.length} wizard photo doc(s) found · ${eligible.length} cleaner(s) without an avatar to adopt`
  );
  for (const c of eligible) {
    const u = users.find((x) => x.id === c.userId);
    console.log(`  ${dryRun ? 'would adopt' : 'adopting'}: ${u?.name ?? c.userId} (${c.mimeType})`);
    if (dryRun) continue;
    try {
      const doc = await DocumentStorageService.getDocument(c.id, 'system:wizard-photo-adoption');
      if (!doc) {
        console.warn('  ✗ could not decrypt — skipped');
        continue;
      }
      const ext = doc.mimeType === 'image/jpeg' ? 'jpg' : doc.mimeType.split('/')[1] || 'jpg';
      const key = `profile-photos/${c.userId}.${ext}`;
      await putObject(key, doc.buffer, doc.mimeType);
      await prisma.user.update({ where: { id: c.userId }, data: { image: key } });
      console.log(`  ✓ adopted → ${key}`);
    } catch (e) {
      console.warn(`  ✗ failed for ${c.userId}:`, e instanceof Error ? e.message : e);
    }
  }
  if (dryRun) console.log('(dry run — nothing written)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
