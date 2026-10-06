-- RENA-003, 007, 074 (D-g): DeviceSession per issued session, BridgeCodeUse
-- insert-as-claim, User.sessionVersion. Additive; rollback is DROP TABLE on
-- both tables and DROP COLUMN "sessionVersion" (old code ignores the claims).
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "DeviceSessionKind" AS ENUM ('BEARER', 'WEB');

CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DeviceSessionKind" NOT NULL,
    "label" TEXT,
    "parentJti" TEXT,
    "sv" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceSession_jti_key" ON "DeviceSession"("jti");
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");
CREATE INDEX "DeviceSession_parentJti_idx" ON "DeviceSession"("parentJti");
CREATE INDEX "DeviceSession_expiresAt_idx" ON "DeviceSession"("expiresAt");

ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BridgeCodeUse" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgeCodeUse_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "BridgeCodeUse_expiresAt_idx" ON "BridgeCodeUse"("expiresAt");
