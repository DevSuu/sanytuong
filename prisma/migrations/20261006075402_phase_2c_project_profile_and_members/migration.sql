-- CreateEnum
CREATE TYPE "ProjectProfileStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('STUDENT', 'ADVISOR');

-- CreateEnum
CREATE TYPE "EditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProfileHistoryAction" AS ENUM ('PROFILE_CREATED', 'PROFILE_SAVED_DRAFT', 'PROFILE_SUBMITTED', 'PROFILE_NEEDS_REVISION', 'PROFILE_COMPLETED', 'ADMIN_EDITED_PROFILE', 'PROFILE_EDIT_REQUEST_CREATED', 'PROFILE_EDIT_REQUEST_APPROVED', 'PROFILE_EDIT_REQUEST_REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailJobType" ADD VALUE 'EDIT_REQUEST_REJECTED';
ALTER TYPE "EmailJobType" ADD VALUE 'EDIT_REQUEST_APPROVED';
ALTER TYPE "EmailJobType" ADD VALUE 'PROFILE_REVISION_REQUESTED';
ALTER TYPE "EmailJobType" ADD VALUE 'PROFILE_COMPLETED';

-- CreateTable
CREATE TABLE "project_profile" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "status" "ProjectProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "memberType" "MemberType" NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "studentCode" TEXT,
    "className" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_edit_request" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedFields" TEXT[],
    "allowedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_edit_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_history" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" "ProfileHistoryAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_profile_ideaId_key" ON "project_profile"("ideaId");

-- CreateIndex
CREATE INDEX "project_profile_status_idx" ON "project_profile"("status");

-- CreateIndex
CREATE INDEX "project_profile_ideaId_idx" ON "project_profile"("ideaId");

-- CreateIndex
CREATE INDEX "project_member_profileId_idx" ON "project_member"("profileId");

-- CreateIndex
CREATE INDEX "project_member_studentCode_idx" ON "project_member"("studentCode");

-- CreateIndex
CREATE INDEX "project_member_email_idx" ON "project_member"("email");

-- CreateIndex
CREATE INDEX "profile_edit_request_profileId_idx" ON "profile_edit_request"("profileId");

-- CreateIndex
CREATE INDEX "profile_edit_request_status_idx" ON "profile_edit_request"("status");

-- CreateIndex
CREATE INDEX "profile_history_profileId_idx" ON "profile_history"("profileId");

-- CreateIndex
CREATE INDEX "profile_history_ideaId_idx" ON "profile_history"("ideaId");

-- CreateIndex
CREATE INDEX "profile_history_createdAt_idx" ON "profile_history"("createdAt");

-- AddForeignKey
ALTER TABLE "project_profile" ADD CONSTRAINT "project_profile_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "project_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_edit_request" ADD CONSTRAINT "profile_edit_request_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "project_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_history" ADD CONSTRAINT "profile_history_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "project_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_history" ADD CONSTRAINT "profile_history_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
