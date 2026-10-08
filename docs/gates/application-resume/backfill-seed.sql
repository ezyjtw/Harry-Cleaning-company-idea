-- 40 synthetic rows across every pre-existing state (no FK on DocumentUpload).
INSERT INTO "DocumentUpload" (id,"userId","profileId","documentType","originalName","storagePath","mimeType","fileSize","encryptionKeyId",checksum,"isVerified","verifiedAt","rejectedAt","rejectionReason","isDestroyed","destroyedAt","destroyedReason","createdAt","updatedAt")
SELECT 'bf-' || g, 'bf-user-' || (g % 7), CASE WHEN g % 3 = 0 THEN NULL ELSE 'bf-profile-' || (g % 7) END,
  (ARRAY['photo_id','right_to_work','dbs_certificate','selfie','insurance'])[1 + g % 5], 'f' || g || '.png', 'documents/x/bf-' || g || '.enc',
  'image/png', 100 + g, 'k' || g, 'c' || g,
  (g % 4 = 0), CASE WHEN g % 4 = 0 THEN now() END,
  CASE WHEN g % 4 = 1 THEN now() END, CASE WHEN g % 4 = 1 THEN 'blurred' END,
  (g % 5 = 2), CASE WHEN g % 5 = 2 THEN now() END, CASE WHEN g % 5 = 2 THEN 'retention_policy' END,
  now() - (g || ' days')::interval, now()
FROM generate_series(1, 40) g;
