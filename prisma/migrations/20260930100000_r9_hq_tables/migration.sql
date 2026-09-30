-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "area" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'found',
    "userId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectNote" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPlace" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "brand" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorObservation" (
    "id" TEXT NOT NULL,
    "placeRefId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorReview" (
    "id" TEXT NOT NULL,
    "placeRefId" TEXT NOT NULL,
    "rating" INTEGER,
    "text" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCallLog_provider_createdAt_idx" ON "ApiCallLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_provider_endpoint_createdAt_idx" ON "ApiCallLog"("provider", "endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_createdAt_idx" ON "ApiCallLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_email_key" ON "Prospect"("email");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_nextActionAt_idx" ON "Prospect"("nextActionAt");

-- CreateIndex
CREATE INDEX "ProspectNote_prospectId_idx" ON "ProspectNote"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPlace_placeId_key" ON "CompetitorPlace"("placeId");

-- CreateIndex
CREATE INDEX "CompetitorPlace_area_idx" ON "CompetitorPlace"("area");

-- CreateIndex
CREATE INDEX "CompetitorPlace_brand_idx" ON "CompetitorPlace"("brand");

-- CreateIndex
CREATE INDEX "CompetitorObservation_placeRefId_observedAt_idx" ON "CompetitorObservation"("placeRefId", "observedAt");

-- CreateIndex
CREATE INDEX "CompetitorReview_placeRefId_idx" ON "CompetitorReview"("placeRefId");

-- CreateIndex
CREATE INDEX "CompetitorReview_expiresAt_idx" ON "CompetitorReview"("expiresAt");

-- AddForeignKey
ALTER TABLE "ProspectNote" ADD CONSTRAINT "ProspectNote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_placeRefId_fkey" FOREIGN KEY ("placeRefId") REFERENCES "CompetitorPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorReview" ADD CONSTRAINT "CompetitorReview_placeRefId_fkey" FOREIGN KEY ("placeRefId") REFERENCES "CompetitorPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

