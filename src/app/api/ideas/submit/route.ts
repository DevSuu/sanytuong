import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ideaSubmissionSchema } from "@/lib/validation/idea-schema";
import {
  normalizeEmail,
  generateRandomToken,
  hashToken,
  encryptToken,
  decryptToken,
  formatSequentialReferenceCode,
} from "@/lib/crypto";
import { IdeaStatus, EmailJobType } from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { getAppUrl } from "@/lib/app-url";
import { checkTargetRateLimit } from "@/lib/security/rate-limiter";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ideaSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      fullName,
      studentCode,
      className,
      major,
      phone,
      email,
      bankAccountNumber,
      bankName,
      bankBranch,
      field,
      title,
      description,
      expectedProduct,
      necessity,
      innovation,
      feasibility,
      potential,
      needsMemberSupport,
    } = parsed.data;

    const normEmail = normalizeEmail(email);

    // Per-email rate limit: max 5 idea submissions per 5 minutes for the same email address
    const emailRateLimit = checkTargetRateLimit("idea_submit_email", normEmail, {
      windowMs: 5 * 60 * 1000,
      max: 5,
    });
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Địa chỉ email này vừa gửi quá nhiều yêu cầu liên tiếp. Vui lòng kiểm tra hộp thư hoặc thử lại sau ít phút.",
        },
        { status: 429 },
      );
    }

    const normStudentCode = studentCode.trim().toUpperCase();
    const normFullName = fullName.trim();
    const normPhone = phone.trim();
    const normBankAccount = bankAccountNumber.trim();
    const normBankName = bankName.trim();
    const normBankBranch = bankBranch ? bankBranch.trim() : null;
    const db = getDb();
    const appUrl = getAppUrl();

    // Check if caller proved ownership via x-lookup-token header
    const callerLookupToken = req.headers.get("x-lookup-token")?.trim() || null;

    // Transactional submission
    const result = await db.$transaction(async (tx) => {
      // 1. Find or create Submitter
      let submitter = await tx.submitter.findUnique({
        where: { emailNormalized: normEmail },
        include: { lookupCredential: true },
      });

      let isCallerAuthenticatedOwner = false;
      if (
        submitter &&
        submitter.lookupCredential &&
        !submitter.lookupCredential.revokedAt &&
        callerLookupToken
      ) {
        const callerTokenHash = hashToken(callerLookupToken);
        if (callerTokenHash === submitter.lookupCredential.tokenHash) {
          isCallerAuthenticatedOwner = true;
        }
      }

      if (!submitter) {
        submitter = await tx.submitter.create({
          data: {
            fullName: normFullName,
            studentCode: normStudentCode,
            className: className ? className.trim() : null,
            major: major ? major.trim() : null,
            phone: normPhone,
            bankAccountNumber: normBankAccount,
            bankName: normBankName,
            bankBranch: normBankBranch,
            email,
            emailNormalized: normEmail,
          },
          include: { lookupCredential: true },
        });
      } else if (!submitter.emailVerifiedAt || isCallerAuthenticatedOwner) {
        // SECURITY FIX: Only allow updating Submitter PII & Bank Account details
        // if the account has NOT yet been verified, OR if the caller proved ownership via lookupToken.
        // Prevents unauthenticated attackers from overwriting a verified student's bank account or PII.
        submitter = await tx.submitter.update({
          where: { id: submitter.id },
          data: {
            fullName: normFullName,
            studentCode: normStudentCode,
            className: className ? className.trim() : submitter.className,
            major: major ? major.trim() : submitter.major,
            phone: normPhone,
            bankAccountNumber: normBankAccount,
            bankName: normBankName,
            bankBranch: normBankBranch,
          },
          include: { lookupCredential: true },
        });
      }

      // 2. Ensure Permanent Lookup Credential exists (1 email = 1 permanent lookup identity)
      const lookupCredential = submitter.lookupCredential;

      let rawLookupToken: string;
      if (!lookupCredential) {
        rawLookupToken = generateRandomToken(32);
        await tx.lookupCredential.create({
          data: {
            submitterId: submitter.id,
            tokenHash: hashToken(rawLookupToken),
            encryptedToken: encryptToken(rawLookupToken),
          },
        });
      } else {
        try {
          rawLookupToken = decryptToken(lookupCredential.encryptedToken);
        } catch {
          rawLookupToken = "";
        }
      }

      // 3. Generate sequential reference code: TTST-02-XXXX
      const existingCodes = await tx.idea.findMany({
        where: {
          referenceCode: {
            startsWith: "TTST-02-",
          },
        },
        select: {
          referenceCode: true,
        },
      });

      let maxSeq = 0;
      for (const row of existingCodes) {
        if (!row.referenceCode) continue;
        const numPart = parseInt(row.referenceCode.replace(/^TTST-02-/i, ""), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }

      let nextSeq = maxSeq + 1;
      let referenceCode = formatSequentialReferenceCode(nextSeq);
      while (await tx.idea.findUnique({ where: { referenceCode } })) {
        nextSeq++;
        referenceCode = formatSequentialReferenceCode(nextSeq);
      }

      // SECURITY FIX: Every public form submission without an authenticated lookupToken
      // MUST start in PENDING_VERIFICATION and require email link confirmation.
      // This prevents unauthenticated idea injection and eliminates Email Enumeration.
      const initialStatus = isCallerAuthenticatedOwner
        ? IdeaStatus.SUBMITTED
        : IdeaStatus.PENDING_VERIFICATION;

      // 4. Create Idea
      const idea = await tx.idea.create({
        data: {
          referenceCode,
          submitterId: submitter.id,
          title: title.trim(),
          description: description.trim(),
          field: field.trim(),
          expectedProduct: expectedProduct.trim(),
          necessity: necessity.trim(),
          innovation: innovation.trim(),
          feasibility: feasibility.trim(),
          potential: potential.trim(),
          needsMemberSupport: Boolean(needsMemberSupport),
          status: initialStatus,
          submittedAt: isCallerAuthenticatedOwner ? new Date() : null,
          version: 1,
        },
      });

      // 5. Create Initial Status History
      await tx.ideaStatusHistory.create({
        data: {
          ideaId: idea.id,
          actorType: "SYSTEM",
          oldStatus: initialStatus,
          newStatus: initialStatus,
          reason: isCallerAuthenticatedOwner
            ? "Ý tưởng được gửi thành công bởi phiên tra cứu đã xác thực."
            : "Hồ sơ ý tưởng mới được gửi. Đang chờ xác minh quyền sở hữu email.",
        },
      });

      // 6. Handle verification flow & Transactional Outbox email jobs
      if (!isCallerAuthenticatedOwner) {
        // Create short-lived single-use verification token (24-hour expiration)
        const rawVerificationToken = generateRandomToken(32);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await tx.emailVerificationToken.create({
          data: {
            submitterId: submitter.id,
            ideaId: idea.id,
            tokenHash: hashToken(rawVerificationToken),
            expiresAt,
          },
        });

        // Enqueue Verification Email Job
        const verificationUrl = `${appUrl}/xac-minh-email?token=${rawVerificationToken}`;
        await enqueueEmailJob(tx, {
          type: EmailJobType.VERIFY_EMAIL,
          recipient: submitter.email,
          payload: {
            submitterName: submitter.fullName,
            referenceCode: idea.referenceCode,
            ideaTitle: idea.title,
            verificationUrl,
            expiresAt: expiresAt.toISOString(),
          },
          idempotencyKey: `verify-${idea.id}`,
        });
      } else {
        // Enqueue submission confirmation email with permanent lookup link
        const lookupUrl = rawLookupToken
          ? `${appUrl}/tra-cuu/${rawLookupToken}`
          : `${appUrl}/tra-cuu`;
        await enqueueEmailJob(tx, {
          type: EmailJobType.LOOKUP_LINK,
          recipient: submitter.email,
          payload: {
            submitterName: submitter.fullName,
            referenceCode: idea.referenceCode,
            ideaTitle: idea.title,
            lookupUrl,
          },
          idempotencyKey: `submit-confirm-${idea.id}`,
        });
      }

      return {
        ideaId: idea.id,
        referenceCode: idea.referenceCode,
        status: idea.status,
        emailVerified: isCallerAuthenticatedOwner,
        email: normEmail,
      };
    });

    triggerGoogleSheetsAutoSync("idea:submit");

    // Trigger dev email sink processor in background
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message: result.emailVerified
        ? "Gửi ý tưởng thành công! Hồ sơ đã được chuyển tới Ban tổ chức."
        : "Đã gửi ý tưởng thành công. Vui lòng kiểm tra email để xác minh quyền sở hữu và kích hoạt hồ sơ.",
      data: result,
    });
  } catch (error: unknown) {
    console.error("[SubmitIdeaError]", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Không thể lưu ý tưởng vào hệ thống. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}
