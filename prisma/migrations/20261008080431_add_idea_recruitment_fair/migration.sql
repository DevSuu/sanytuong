-- CreateEnum
CREATE TYPE "IdeaRecruitmentPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecruitmentApplicationStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailJobType" ADD VALUE 'RECRUITMENT_APPLICATION_OTP';
ALTER TYPE "EmailJobType" ADD VALUE 'RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE';
ALTER TYPE "EmailJobType" ADD VALUE 'RECRUITMENT_APPLICATION_ACCEPTED';
ALTER TYPE "EmailJobType" ADD VALUE 'RECRUITMENT_APPLICATION_REJECTED';

-- CreateTable
CREATE TABLE "idea_recruitment_post" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetMemberCount" INTEGER NOT NULL DEFAULT 1,
    "requiredSkills" TEXT NOT NULL,
    "status" "IdeaRecruitmentPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_recruitment_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_recruitment_application" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "className" TEXT,
    "phone" TEXT,
    "specialty" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "contribution" TEXT NOT NULL,
    "status" "RecruitmentApplicationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_recruitment_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_recruitment_verification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_recruitment_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idea_recruitment_post_ideaId_key" ON "idea_recruitment_post"("ideaId");

-- CreateIndex
CREATE INDEX "idea_recruitment_post_status_idx" ON "idea_recruitment_post"("status");

-- CreateIndex
CREATE INDEX "idea_recruitment_post_ideaId_idx" ON "idea_recruitment_post"("ideaId");

-- CreateIndex
CREATE INDEX "idea_recruitment_post_createdAt_idx" ON "idea_recruitment_post"("createdAt");

-- CreateIndex
CREATE INDEX "idea_recruitment_application_postId_idx" ON "idea_recruitment_application"("postId");

-- CreateIndex
CREATE INDEX "idea_recruitment_application_status_idx" ON "idea_recruitment_application"("status");

-- CreateIndex
CREATE INDEX "idea_recruitment_application_studentCode_idx" ON "idea_recruitment_application"("studentCode");

-- CreateIndex
CREATE INDEX "idea_recruitment_application_emailNormalized_idx" ON "idea_recruitment_application"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "idea_recruitment_application_postId_studentCode_key" ON "idea_recruitment_application"("postId", "studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "idea_recruitment_application_postId_emailNormalized_key" ON "idea_recruitment_application"("postId", "emailNormalized");

-- CreateIndex
CREATE INDEX "idea_recruitment_verification_applicationId_idx" ON "idea_recruitment_verification"("applicationId");

-- CreateIndex
CREATE INDEX "idea_recruitment_verification_expiresAt_idx" ON "idea_recruitment_verification"("expiresAt");

-- CreateIndex
CREATE INDEX "idea_recruitment_verification_createdAt_idx" ON "idea_recruitment_verification"("createdAt");

-- AddForeignKey
ALTER TABLE "idea_recruitment_post" ADD CONSTRAINT "idea_recruitment_post_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_recruitment_application" ADD CONSTRAINT "idea_recruitment_application_postId_fkey" FOREIGN KEY ("postId") REFERENCES "idea_recruitment_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_recruitment_verification" ADD CONSTRAINT "idea_recruitment_verification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "idea_recruitment_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
