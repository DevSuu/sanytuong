-- AlterTable
ALTER TABLE "submitter" ALTER COLUMN "className" DROP NOT NULL;
ALTER TABLE "submitter" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "submitter" ADD COLUMN "bankName" TEXT;
ALTER TABLE "submitter" ADD COLUMN "bankBranch" TEXT;

-- AlterTable
ALTER TABLE "idea" ADD COLUMN "field" TEXT;
ALTER TABLE "idea" ADD COLUMN "expectedProduct" TEXT;
ALTER TABLE "idea" ADD COLUMN "necessity" TEXT;
ALTER TABLE "idea" ADD COLUMN "innovation" TEXT;
ALTER TABLE "idea" ADD COLUMN "feasibility" TEXT;
ALTER TABLE "idea" ADD COLUMN "potential" TEXT;
ALTER TABLE "idea" ADD COLUMN "needsMemberSupport" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idea_field_idx" ON "idea"("field");
