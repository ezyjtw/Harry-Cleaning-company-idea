-- B7.6 (RENA-067, D-m): expand only. destroyDocument now nulls the key
-- reference in the same update that marks the row destroyed, so the derived
-- per-document key is no longer computable from the row. Every existing value
-- stays; no row is deleted.
ALTER TABLE "DocumentUpload" ALTER COLUMN "encryptionKeyId" DROP NOT NULL;
