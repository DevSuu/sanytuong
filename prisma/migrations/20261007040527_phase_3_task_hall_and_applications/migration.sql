-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskHistoryAction" AS ENUM ('TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_APPLICATION_SELECTED');

-- CreateEnum
CREATE TYPE "TaskApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SELECTED', 'NOT_SELECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskApplicationHistoryAction" AS ENUM ('APPLICATION_DRAFT_SAVED', 'APPLICATION_SUBMITTED', 'APPLICATION_UPDATED', 'APPLICATION_SELECTED', 'APPLICATION_NOT_SELECTED', 'APPLICATION_CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailJobType" ADD VALUE 'TASK_APPLICATION_SUBMITTED';
ALTER TYPE "EmailJobType" ADD VALUE 'TASK_APPLICATION_SELECTED';
ALTER TYPE "EmailJobType" ADD VALUE 'TASK_APPLICATION_NOT_SELECTED';
ALTER TYPE "EmailJobType" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "EmailJobType" ADD VALUE 'TASK_COMPLETED';

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "orderingOrganization" TEXT NOT NULL,
    "reward" TEXT,
    "category" TEXT,
    "applicationDeadline" TIMESTAMP(3),
    "executionDeadline" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" "TaskHistoryAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_application" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "status" "TaskApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "selectedAt" TIMESTAMP(3),
    "adminFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_application_member" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
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

    CONSTRAINT "task_application_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_application_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" "TaskApplicationHistoryAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_application_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_slug_key" ON "task"("slug");

-- CreateIndex
CREATE INDEX "task_status_idx" ON "task"("status");

-- CreateIndex
CREATE INDEX "task_slug_idx" ON "task"("slug");

-- CreateIndex
CREATE INDEX "task_createdAt_idx" ON "task"("createdAt");

-- CreateIndex
CREATE INDEX "task_history_taskId_idx" ON "task_history"("taskId");

-- CreateIndex
CREATE INDEX "task_history_createdAt_idx" ON "task_history"("createdAt");

-- CreateIndex
CREATE INDEX "task_application_taskId_idx" ON "task_application"("taskId");

-- CreateIndex
CREATE INDEX "task_application_submitterId_idx" ON "task_application"("submitterId");

-- CreateIndex
CREATE INDEX "task_application_status_idx" ON "task_application"("status");

-- CreateIndex
CREATE INDEX "task_application_createdAt_idx" ON "task_application"("createdAt");

-- CreateIndex
CREATE INDEX "task_application_member_applicationId_idx" ON "task_application_member"("applicationId");

-- CreateIndex
CREATE INDEX "task_application_member_studentCode_idx" ON "task_application_member"("studentCode");

-- CreateIndex
CREATE INDEX "task_application_member_email_idx" ON "task_application_member"("email");

-- CreateIndex
CREATE INDEX "task_application_history_applicationId_idx" ON "task_application_history"("applicationId");

-- CreateIndex
CREATE INDEX "task_application_history_createdAt_idx" ON "task_application_history"("createdAt");

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_application" ADD CONSTRAINT "task_application_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_application" ADD CONSTRAINT "task_application_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_application_member" ADD CONSTRAINT "task_application_member_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "task_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_application_history" ADD CONSTRAINT "task_application_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "task_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
