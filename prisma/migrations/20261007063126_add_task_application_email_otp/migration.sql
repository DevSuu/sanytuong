-- AlterEnum
ALTER TYPE "EmailJobType" ADD VALUE 'VERIFY_TASK_APPLICATION';

-- AlterEnum
ALTER TYPE "TaskApplicationStatus" ADD VALUE 'PENDING_VERIFICATION';

-- CreateTable
CREATE TABLE "task_application_verification" (
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

    CONSTRAINT "task_application_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_application_verification_applicationId_idx" ON "task_application_verification"("applicationId");

-- CreateIndex
CREATE INDEX "task_application_verification_expiresAt_idx" ON "task_application_verification"("expiresAt");

-- CreateIndex
CREATE INDEX "task_application_verification_createdAt_idx" ON "task_application_verification"("createdAt");

-- AddForeignKey
ALTER TABLE "task_application_verification" ADD CONSTRAINT "task_application_verification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "task_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
