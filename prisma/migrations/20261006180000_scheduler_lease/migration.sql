-- RENA-014: scheduler lease and heartbeat (single row, id 'scheduler').
CREATE TABLE "SchedulerLease" (
    "id" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastCaller" TEXT,
    "lastSummary" JSONB,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SchedulerLease" ("id", "updatedAt") VALUES ('scheduler', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
