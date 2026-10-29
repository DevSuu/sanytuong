import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { adminReviewEditRequestSchema } from "@/lib/validation/profile-schema";
import { decryptToken } from "@/lib/crypto";
import {
  EditRequestStatus,
  ProfileHistoryAction,
} from "@/lib/domain/profile-state-machine";
import { validateAllowedSubsetOfRequested } from "@/lib/domain/profile-service";
import { EmailJobType } from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { getAppUrl } from "@/lib/app-url";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id: profileId, requestId } = await params;
    const body = await req.json();
    const db = getDb();

    const profile = await db.projectProfile.findUnique({
      where: { id: profileId },
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

    const editRequest = await db.profileEditRequest.findUnique({
      where: { id: requestId },
    });

    if (!editRequest || editRequest.profileId !== profileId) {
      return NextResponse.json({ ok: false, error: "Yêu cầu chỉnh sửa không tồn tại." }, { status: 404 });
    }

    if (editRequest.status !== EditRequestStatus.PENDING) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu chỉnh sửa này đã được xử lý trước đó." },
        { status: 400 },
      );
    }

    const parsed = adminReviewEditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu xử lý yêu cầu không hợp lệ." },
        { status: 400 },
      );
    }

    const { action, allowedFields, rejectionReason, adminNote } = parsed.data;
    const appUrl = getAppUrl();

    // Enforce allowedFields ⊆ requestedFields on approval
    let resolvedAllowedFields: string[] = [];
    if (action === "APPROVE") {
      try {
        resolvedAllowedFields = validateAllowedSubsetOfRequested(
          allowedFields || [],
          editRequest.requestedFields,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "allowedFields không hợp lệ.";
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }
    }

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
        const er = await tx.profileEditRequest.update({
          where: { id: requestId },
          data: {
            status: EditRequestStatus.APPROVED,
            allowedFields: resolvedAllowedFields,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            adminNote: adminNote || null,
          },
        });

        await tx.profileHistory.create({
          data: {
            profileId,
            ideaId: profile.ideaId,
            actorId: session.user.id,
            actorRole: "ADMIN",
            action: ProfileHistoryAction.PROFILE_EDIT_REQUEST_APPROVED,
            reason: adminNote || "Ban tổ chức chấp thuận yêu cầu chỉnh sửa hồ sơ.",
            metadata: {
              requestId,
              allowedFields: resolvedAllowedFields,
            },
          },
        });

        await enqueueEmailJob(tx, {
          type: EmailJobType.EDIT_REQUEST_APPROVED,
          recipient: profile.idea.submitter.email,
          payload: {
            leaderName: profile.idea.submitter.fullName,
            title: profile.idea.title,
            referenceCode: profile.idea.referenceCode,
            allowedFields: resolvedAllowedFields,
            lookupUrl,
          },
          idempotencyKey: `edit-request-approved-${requestId}`,
        });

        return er;
      } else {
        // REJECT
        const er = await tx.profileEditRequest.update({
          where: { id: requestId },
          data: {
            status: EditRequestStatus.REJECTED,
            rejectionReason: rejectionReason!,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            adminNote: adminNote || null,
          },
        });

        await tx.profileHistory.create({
          data: {
            profileId,
            ideaId: profile.ideaId,
            actorId: session.user.id,
            actorRole: "ADMIN",
            action: ProfileHistoryAction.PROFILE_EDIT_REQUEST_REJECTED,
            reason: rejectionReason!,
            metadata: {
              requestId,
              rejectionReason,
            },
          },
        });

        await enqueueEmailJob(tx, {
          type: EmailJobType.EDIT_REQUEST_REJECTED,
          recipient: profile.idea.submitter.email,
          payload: {
            leaderName: profile.idea.submitter.fullName,
            title: profile.idea.title,
            referenceCode: profile.idea.referenceCode,
            reason: rejectionReason!,
            lookupUrl,
          },
          idempotencyKey: `edit-request-rejected-${requestId}`,
        });

        return er;
      }
    });

    triggerGoogleSheetsAutoSync("admin:edit-request-review");

    // Trigger background email worker
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message:
        action === "APPROVE"
          ? "Đã phê duyệt yêu cầu chỉnh sửa hồ sơ."
          : "Đã từ chối yêu cầu chỉnh sửa hồ sơ.",
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[AdminReviewEditRequestError]", error);
    const message = error instanceof Error ? error.message : "Lỗi khi xử lý yêu cầu chỉnh sửa.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
