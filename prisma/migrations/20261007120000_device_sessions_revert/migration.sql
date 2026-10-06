-- B1a REVERT (executed only on James's word if a walk step fails): drops the
-- D-g objects. The forward migration 20261007090000_device_sessions stays in
-- the history so migrate deploy keeps a consistent ledger; this one undoes it.
ALTER TABLE "DeviceSession" DROP CONSTRAINT IF EXISTS "DeviceSession_userId_fkey";
DROP TABLE IF EXISTS "DeviceSession";
DROP TABLE IF EXISTS "BridgeCodeUse";
DROP TYPE IF EXISTS "DeviceSessionKind";
ALTER TABLE "User" DROP COLUMN IF EXISTS "sessionVersion";
