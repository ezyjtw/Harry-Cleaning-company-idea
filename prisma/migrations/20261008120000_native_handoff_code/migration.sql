-- CreateEnum
CREATE TYPE "NativeHandoffApp" AS ENUM ('PRO', 'CUSTOMER');

-- CreateTable
CREATE TABLE "NativeHandoffCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "app" "NativeHandoffApp" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeHandoffCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeHandoffCode_codeHash_key" ON "NativeHandoffCode"("codeHash");

-- CreateIndex
CREATE INDEX "NativeHandoffCode_userId_idx" ON "NativeHandoffCode"("userId");

-- CreateIndex
CREATE INDEX "NativeHandoffCode_expiresAt_idx" ON "NativeHandoffCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "NativeHandoffCode" ADD CONSTRAINT "NativeHandoffCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

