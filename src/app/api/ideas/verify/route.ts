import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  hashToken,
  decryptToken,
  generateRandomToken,
  encryptToken,
} from "@/lib/crypto";
import { IdeaStatus, EmailJobType } from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { getAppUrl } from "@/lib/app-url";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { ok: false, error: "Mã xác minh không hợp lệ." },
        { status: 400 },
      );
    }

    const tokenH = hashToken(token.trim());
    const db = getDb();
    const appUrl = getAppUrl();

    const verificationResult = await db.$transaction(async (tx) => {
      // Atomic conditional update to guard against concurrent verification requests
      const updateResult = await tx.emailVerificationToken.updateMany({
        where: {
          tokenHash: tokenH,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        // Detailed error diagnosis
        const existing = await tx.emailVerificationToken.findUnique({
          where: { tokenHash: tokenH },
        });

        if (!existing) {
          throw new Error("Mã xác minh không tồn tại hoặc đã bị thu hồi.");
        }
        if (existing.consumedAt) {
          throw new Error("Mã xác minh này đã được sử dụng trước đó.");
        }
        if (new Date() > existing.expiresAt) {
          throw new Error("Mã xác minh đã hết hạn. Vui lòng gửi lại yêu cầu.");
        }
        throw new Error("Mã xác minh không hợp lệ hoặc đang được xử lý.");
      }

      // Fetch the verified record with associated submitter and idea
      const verificationRecord = await tx.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash: tokenH },
        include: {
          submitter: {
            include: { lookupCredential: true },
          },
          idea: true,
        },
      });

      const now = new Date();

      // Mark submitter as verified
      await tx.submitter.update({
        where: { id: verificationRecord.submitterId },
        data: {
          emailVerifiedAt: verificationRecord.submitter.emailVerifiedAt ?? now,
        },
      });

      // Find ALL ideas of this submitter that are still waiting for email verification
      const pendingIdeas = await tx.idea.findMany({
        where: {
          submitterId: verificationRecord.submitterId,
          status: IdeaStatus.PENDING_VERIFICATION,
        },
        orderBy: { createdAt: "asc" },
      });

      // Ensure target idea from this token is included if it was PENDING_VERIFICATION
      const ideasToActivate =
        pendingIdeas.length > 0
          ? pendingIdeas
          : verificationRecord.idea &&
              verificationRecord.idea.status === IdeaStatus.PENDING_VERIFICATION
            ? [verificationRecord.idea]
            : [];

      let rawLookupToken: string | null = null;
      if (!verificationRecord.submitter.lookupCredential) {
        rawLookupToken = generateRandomToken(32);
        await tx.lookupCredential.create({
          data: {
            submitterId: verificationRecord.submitter.id,
            tokenHash: hashToken(rawLookupToken),
            encryptedToken: encryptToken(rawLookupToken),
          },
        });
      } else {
        try {
          rawLookupToken = decryptToken(
            verificationRecord.submitter.lookupCredential.encryptedToken,
          );
        } catch (e) {
          console.error("Failed to decrypt permanent lookup token", e);
        }
      }

      const activatedReferenceCodes: string[] = [];

      // Transition ALL pending ideas of this submitter to SUBMITTED
      for (const pendingIdea of ideasToActivate) {
        const updatedIdea = await tx.idea.update({
          where: { id: pendingIdea.id },
          data: {
            status: IdeaStatus.SUBMITTED,
            submittedAt: now,
            version: { increment: 1 },
          },
        });

        activatedReferenceCodes.push(updatedIdea.referenceCode);

        // Record history for each activated idea
        await tx.ideaStatusHistory.create({
          data: {
            ideaId: updatedIdea.id,
            actorType: "SYSTEM",
            oldStatus: IdeaStatus.PENDING_VERIFICATION,
            newStatus: IdeaStatus.SUBMITTED,
            reason:
              ideasToActivate.length > 1 &&
              verificationRecord.ideaId &&
              verificationRecord.ideaId !== updatedIdea.id
                ? "Tự động kích hoạt cùng lúc khi người gửi xác minh quyền sở hữu email thành công."
                : "Xác minh quyền sở hữu email thành công. Ý tưởng chính thức được chuyển tới Ban tổ chức.",
          },
        });

        // Enqueue permanent lookup notification email for each activated idea
        if (rawLookupToken) {
          const lookupUrl = `${appUrl}/tra-cuu/${rawLookupToken}`;
          await enqueueEmailJob(tx, {
            type: EmailJobType.LOOKUP_LINK,
            recipient: verificationRecord.submitter.email,
            payload: {
              submitterName: verificationRecord.submitter.fullName,
              referenceCode: updatedIdea.referenceCode,
              ideaTitle: updatedIdea.title,
              lookupUrl,
            },
            idempotencyKey: `verified-lookup-${updatedIdea.id}`,
          });
        }
      }

      const primaryReferenceCode =
        verificationRecord.idea?.referenceCode ||
        activatedReferenceCodes[0] ||
        null;

      return {
        submitterName: verificationRecord.submitter.fullName,
        referenceCode: primaryReferenceCode,
        referenceCodes: activatedReferenceCodes,
        lookupToken: rawLookupToken,
      };
    });

    triggerGoogleSheetsAutoSync("idea:verify");

    // Background process email queue
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message: "Xác minh email thành công! Hồ sơ ý tưởng đã chính thức vào danh sách xét duyệt.",
      data: verificationResult,
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Xác minh email thất bại.";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 400 });
  }
}
