-- CreateEnum
CREATE TYPE "AwardSeasonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AwardStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AwardHistoryAction" AS ENUM ('AWARD_CREATED', 'AWARD_UPDATED', 'AWARD_STATUS_CHANGED', 'AWARD_PUBLISHED', 'AWARD_UNPUBLISHED', 'AWARD_ARCHIVED');

-- CreateTable
CREATE TABLE "award_season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "AwardSeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "year" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "awardName" TEXT NOT NULL,
    "category" TEXT,
    "organization" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AwardStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award_member" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentCode" TEXT,
    "className" TEXT,
    "role" TEXT,
    "department" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award_history" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" "AwardHistoryAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "award_season_slug_key" ON "award_season"("slug");

-- CreateIndex
CREATE INDEX "award_season_status_idx" ON "award_season"("status");

-- CreateIndex
CREATE INDEX "award_season_displayOrder_idx" ON "award_season"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "award_slug_key" ON "award"("slug");

-- CreateIndex
CREATE INDEX "award_seasonId_idx" ON "award"("seasonId");

-- CreateIndex
CREATE INDEX "award_status_idx" ON "award"("status");

-- CreateIndex
CREATE INDEX "award_category_idx" ON "award"("category");

-- CreateIndex
CREATE INDEX "award_awardName_idx" ON "award"("awardName");

-- CreateIndex
CREATE INDEX "award_displayOrder_idx" ON "award"("displayOrder");

-- CreateIndex
CREATE INDEX "award_createdAt_idx" ON "award"("createdAt");

-- CreateIndex
CREATE INDEX "award_member_awardId_idx" ON "award_member"("awardId");

-- CreateIndex
CREATE INDEX "award_history_awardId_idx" ON "award_history"("awardId");

-- CreateIndex
CREATE INDEX "award_history_createdAt_idx" ON "award_history"("createdAt");

-- AddForeignKey
ALTER TABLE "award" ADD CONSTRAINT "award_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "award_season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_member" ADD CONSTRAINT "award_member_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_history" ADD CONSTRAINT "award_history_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "award"("id") ON DELETE CASCADE ON UPDATE CASCADE;
