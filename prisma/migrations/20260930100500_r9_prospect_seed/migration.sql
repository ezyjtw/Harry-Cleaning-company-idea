-- R9 Decision 2 (James-ruled): one-time Reachout pipeline seed.
--
-- (1) The two §7 campaign leads (docs/campaign-handover.md) become Prospects
--     with status 'contacted', dossier-linked to their live accounts. Their
--     accounts and wizard progress are untouched — this only adds pipeline rows.
-- (2) Every OTHER incomplete signup — the LB-3 structural definition: role
--     CLEANER, no CleanerProfile, no bookings, not deleted — imports as 'found'.
--
-- Idempotent by construction (unique Prospect.email + NOT EXISTS guards) and
-- read-then-insert only: nothing here updates or deletes any existing row.
-- Runs exactly once in production via `prisma migrate deploy`.

-- (1) §7 campaign pair → contacted
INSERT INTO "Prospect" ("id", "name", "email", "phone", "source", "status", "userId", "createdAt", "updatedAt")
SELECT
  'prsp_' || substr(md5(u."id" || u."email"), 1, 24),
  COALESCE(NULLIF(u."name", ''), split_part(u."email", '@', 1)),
  u."email",
  u."phone",
  'campaign',
  'contacted',
  u."id",
  NOW(),
  NOW()
FROM "User" u
WHERE u."email" IN ('macoveanu_cory@yahoo.com', 'cleanandrefine@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM "Prospect" p WHERE p."email" = u."email");

-- (2) other incomplete signups → found
INSERT INTO "Prospect" ("id", "name", "email", "phone", "source", "status", "userId", "createdAt", "updatedAt")
SELECT
  'prsp_' || substr(md5(u."id" || u."email"), 1, 24),
  COALESCE(NULLIF(u."name", ''), split_part(u."email", '@', 1)),
  u."email",
  u."phone",
  'signup-import',
  'found',
  u."id",
  NOW(),
  NOW()
FROM "User" u
WHERE u."role" = 'CLEANER'
  AND u."isDeleted" = false
  AND u."email" NOT IN ('macoveanu_cory@yahoo.com', 'cleanandrefine@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM "CleanerProfile" cp WHERE cp."userId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."cleanerId" = u."id" OR b."clientId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Prospect" p WHERE p."email" = u."email");
