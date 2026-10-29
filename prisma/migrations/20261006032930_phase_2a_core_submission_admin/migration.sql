-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('PENDING_VERIFICATION', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmailJobType" AS ENUM ('VERIFY_EMAIL', 'LOOKUP_LINK', 'IDEA_APPROVED', 'IDEA_REJECTED', 'IDEA_REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submitter" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "major" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_status_history" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'ADMIN',
    "oldStatus" "IdeaStatus" NOT NULL,
    "newStatus" "IdeaStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_token" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "ideaId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_credential" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "lookup_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_job" (
    "id" TEXT NOT NULL,
    "type" "EmailJobType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "email_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "submitter_emailNormalized_key" ON "submitter"("emailNormalized");

-- CreateIndex
CREATE INDEX "submitter_emailNormalized_idx" ON "submitter"("emailNormalized");

-- CreateIndex
CREATE INDEX "submitter_studentCode_idx" ON "submitter"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "idea_referenceCode_key" ON "idea"("referenceCode");

-- CreateIndex
CREATE INDEX "idea_status_idx" ON "idea"("status");

-- CreateIndex
CREATE INDEX "idea_createdAt_idx" ON "idea"("createdAt");

-- CreateIndex
CREATE INDEX "idea_submitterId_idx" ON "idea"("submitterId");

-- CreateIndex
CREATE INDEX "idea_status_history_ideaId_idx" ON "idea_status_history"("ideaId");

-- CreateIndex
CREATE INDEX "idea_status_history_createdAt_idx" ON "idea_status_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_token_tokenHash_key" ON "email_verification_token"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_token_tokenHash_idx" ON "email_verification_token"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_token_expiresAt_idx" ON "email_verification_token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_credential_submitterId_key" ON "lookup_credential"("submitterId");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_credential_tokenHash_key" ON "lookup_credential"("tokenHash");

-- CreateIndex
CREATE INDEX "lookup_credential_tokenHash_idx" ON "lookup_credential"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "email_job_idempotencyKey_key" ON "email_job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_job_status_availableAt_idx" ON "email_job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "email_job_createdAt_idx" ON "email_job"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea" ADD CONSTRAINT "idea_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_status_history" ADD CONSTRAINT "idea_status_history_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookup_credential" ADD CONSTRAINT "lookup_credential_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
