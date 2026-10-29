import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { adminReviewProfileSchema } from "@/lib/validation/profile-schema";
import { decryptToken } from "@/lib/crypto";
import {
  ProjectProfileStatus,
  ProfileHistoryAction,
} from "@/lib/domain/profile-state-machine";
import { EmailJobType, IdeaRecruitmentPostStatus } from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { getAppUrl } from "@/lib/app-url";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    if (!body.reason && body.revisionReason) {
      body.reason = body.revisionReason;
    }
    const db = getDb();

    const profile = await db.projectProfile.findUnique({
      where: { id },
      include: {
        idea: {
          include: {
            submitter: {
              include: { lookupCredential: true },
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Hồ sơ đề tài không tồn tại." }, { status: 404 });
    }

    const parsed = adminReviewProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu xét duyệt không hợp lệ." },
        { status: 400 },
      );
    }

    const { action, reason } = parsed.data;
    const appUrl = getAppUrl();

    // Recover permanent lookup link
    let lookupUrl = "";
    if (profile.idea.submitter.lookupCredential) {
      try {
        const rawToken = decryptToken(profile.idea.submitter.lookupCredential.encryptedToken);
        lookupUrl = `${appUrl}/tra-cuu/${rawToken}`;
      } catch (err) {
        console.error("[LookupTokenDecryptionError]", err);
      }
    }

    const updated = await db.$transaction(async (tx) => {
      if (action === "APPROVE") {
        const p = await tx.projectProfile.update({
          where: { id },
          data: {
            status: ProjectProfileStatus.COMPLETED,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });

        // Automatically close any still-PUBLISHED recruitment posts on Idea Fair once Vòng 2 roster is COMPLETED
        await tx.ideaRecruitmentPost.updateMany({
          where: {
            ideaId: profile.ideaId,
            status: IdeaRecruitmentPostStatus.PUBLISHED,
          },
          data: {
            status: IdeaRecruitmentPostStatus.CLOSED,
            closedAt: new Date(),
          },
        });

        await tx.profileHistory.create({
          data: {
            profileId: id,
            ideaId: profile.ideaId,
            actorId: session.user.id,
            actorRole: "ADMIN",
            action: ProfileHistoryAction.PROFILE_COMPLETED,
            reason: reason || "Ban tổ chức duyệt hoàn tất hồ sơ đề tài.",
          },
        });

        await enqueueEmailJob(tx, {
          type: EmailJobType.PROFILE_COMPLETED,
          recipient: profile.idea.submitter.email,
          payload: {
            leaderName: profile.idea.submitter.fullName,
            title: profile.idea.title,
            referenceCode: profile.idea.referenceCode,
            lookupUrl,
          },
          idempotencyKey: `profile-completed-${profile.id}-v${p.version}`,
        });

        return p;
      } else {
        // REQUEST_REVISION
        const p = await tx.projectProfile.update({
          where: { id },
          data: {
            status: ProjectProfileStatus.NEEDS_REVISION,
            version: { increment: 1 },
          },
        });

        await tx.profileHistory.create({
          data: {
            profileId: id,
            ideaId: profile.ideaId,
            actorId: session.user.id,
            actorRole: "ADMIN",
            action: ProfileHistoryAction.PROFILE_NEEDS_REVISION,
            reason: reason!,
          },
        });

        await enqueueEmailJob(tx, {
          type: EmailJobType.PROFILE_REVISION_REQUESTED,
          recipient: profile.idea.submitter.email,
          payload: {
            leaderName: profile.idea.submitter.fullName,
            title: profile.idea.title,
            referenceCode: profile.idea.referenceCode,
            reason: reason!,
            lookupUrl,
          },
          idempotencyKey: `profile-needs-revision-${profile.id}-v${p.version}`,
        });

        return p;
      }
    });

    triggerGoogleSheetsAutoSync("admin:profile-review");

    // Trigger background email worker
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message:
        action === "APPROVE"
          ? "Đã phê duyệt hoàn tất hồ sơ đề tài."
          : "Đã yêu cầu bổ sung thông tin hồ sơ đề tài.",
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[AdminReviewProfileError]", error);
    const message = error instanceof Error ? error.message : "Lỗi khi xét duyệt hồ sơ.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
