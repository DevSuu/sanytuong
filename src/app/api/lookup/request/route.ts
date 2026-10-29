import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupRequestSchema } from "@/lib/validation/idea-schema";
import {
  normalizeEmail,
  decryptToken,
  generateRandomToken,
  hashToken,
  encryptToken,
} from "@/lib/crypto";
import { EmailJobType } from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { getAppUrl } from "@/lib/app-url";
import { checkTargetRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = lookupRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Vui lòng nhập địa chỉ email hợp lệ." },
        { status: 400 },
      );
    }

    const { email } = parsed.data;
    const norm = normalizeEmail(email);

    // Anti-enumeration: Response to client is always neutral and identical.
    const neutralMessage =
      "Nếu email đã được đăng ký trong hệ thống, chúng tôi đã gửi đường dẫn tra cứu tới email của bạn.";

    // Per-email rate limit (max 3 lookup emails per 5 minutes for the same recipient)
    // Protects against distributed IP-rotation email bombing while returning the same neutral response
    const targetLimit = checkTargetRateLimit("lookup_email", norm, {
      windowMs: 5 * 60 * 1000,
      max: 3,
    });
    if (!targetLimit.allowed) {
      return NextResponse.json({
        ok: true,
        message: neutralMessage,
      });
    }

    const db = getDb();
    const appUrl = getAppUrl();

    const submitter = await db.submitter.findUnique({
      where: { emailNormalized: norm },
      include: {
        lookupCredential: true,
        ideas: {
          where: { status: { not: "PENDING_VERIFICATION" } },
          take: 1,
          select: { id: true },
        },
        taskApplications: {
          where: { status: { not: "PENDING_VERIFICATION" } },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (submitter) {
      let rawToken: string | null = null;

      if (submitter.lookupCredential && !submitter.lookupCredential.revokedAt) {
        try {
          // Recover exact same permanent lookup token (NO token rotation on resend)
          rawToken = decryptToken(submitter.lookupCredential.encryptedToken);
        } catch (err) {
          console.error("[LookupTokenDecryptionError]", err);
        }
      } else if (
        !submitter.lookupCredential &&
        (submitter.emailVerifiedAt ||
          submitter.ideas.length > 0 ||
          submitter.taskApplications.length > 0)
      ) {
        // Self-healing: create LookupCredential for verified submitter if missing
        rawToken = generateRandomToken(32);
        await db.lookupCredential.create({
          data: {
            submitterId: submitter.id,
            tokenHash: hashToken(rawToken),
            encryptedToken: encryptToken(rawToken),
          },
        });
      }

      if (rawToken) {
        const lookupUrl = `${appUrl}/tra-cuu/${rawToken}`;

        await enqueueEmailJob(db, {
          type: EmailJobType.LOOKUP_LINK,
          recipient: submitter.email,
          payload: {
            submitterName: submitter.fullName,
            lookupUrl,
          },
          idempotencyKey: `resend-lookup-${submitter.id}-${Math.floor(Date.now() / 60000)}`,
        });

        // Background trigger email sink
        processPendingEmailJobs().catch((err) =>
          console.error("[EmailQueueBackgroundError]", err),
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: neutralMessage,
    });
  } catch (error: unknown) {
    console.error("[LookupRequestError]", error);
    return NextResponse.json(
      {
        ok: true,
        message:
          "Nếu email đã được đăng ký trong hệ thống, chúng tôi đã gửi đường dẫn tra cứu tới email của bạn.",
      },
      { status: 200 },
    );
  }
}
