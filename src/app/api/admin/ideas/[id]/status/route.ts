import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { adminStatusUpdateSchema } from "@/lib/validation/idea-schema";
import {
  assertValidTransition,
  ConcurrencyConflictError,
  InvalidStateTransitionError,
  STATUS_LABELS,
} from "@/lib/domain/idea-state-machine";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { EmailJobType, IdeaStatus, ProjectProfileStatus } from "@/generated/prisma/client";
import { getAppUrl } from "@/lib/app-url";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict Server-side Admin Authorization (401 for anonymous, 403 for non-admin)
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục." },
        { status: 401 }
      );
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền quản trị để thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const { id: routeIdeaId } = await params;
    const body = await req.json();

    // 2. Validate request payload with Zod
    const validation = adminStatusUpdateSchema.safeParse({
      ...body,
      ideaId: routeIdeaId,
    });

    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { ideaId, expectedOldStatus, newStatus, reason } = validation.data;

    const db = getDb();
    const appUrl = getAppUrl();

    // 3. Find target idea with submitter and permanent lookup credential
    const idea = await db.idea.findUnique({
      where: { id: ideaId },
      include: {
        submitter: {
          include: { lookupCredential: true },
        },
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Không tìm thấy hồ sơ ý tưởng trong hệ thống." },
        { status: 404 }
      );
    }

    // 4. Validate domain state machine transition
    try {
      assertValidTransition(idea.status, newStatus, reason);
    } catch (err) {
      if (err instanceof InvalidStateTransitionError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Resolve permanent lookup URL if credential exists
    let lookupUrl: string | null = null;
    if (idea.submitter.lookupCredential && !idea.submitter.lookupCredential.revokedAt) {
      try {
        const rawToken = decryptToken(idea.submitter.lookupCredential.encryptedToken);
        lookupUrl = `${appUrl}/tra-cuu/${rawToken}`;
      } catch {
        lookupUrl = `${appUrl}/tra-cuu`;
      }
    }

    // 5. Execute transactional update with Concurrency Guard (optimistic lock)
    await db.$transaction(async (tx) => {
      // Optimistic concurrency check: update only if status is still expectedOldStatus
      const updateResult = await tx.idea.updateMany({
        where: {
          id: ideaId,
          status: expectedOldStatus,
        },
        data: {
          status: newStatus,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConcurrencyConflictError();
      }

      // Create audit history log
      await tx.ideaStatusHistory.create({
        data: {
          ideaId,
          actorId: session.user.id,
          actorType: "ADMIN",
          oldStatus: expectedOldStatus,
          newStatus,
          reason: reason?.trim() || null,
        },
      });

      // Enqueue notification email jobs based on status change with deterministic idempotency key
      const idempotencyKey = `idea-status-${idea.id}-${newStatus}-v${idea.version}`;

      if (newStatus === IdeaStatus.APPROVED) {
        // Auto-initialize Round 2 ProjectProfile in NOT_STARTED if not yet created
        const existingProfile = await tx.projectProfile.findUnique({
          where: { ideaId },
          select: { id: true },
        });
        if (!existingProfile) {
          await tx.projectProfile.create({
            data: {
              ideaId,
              status: ProjectProfileStatus.NOT_STARTED,
              version: 1,
              members: {
                create: {
                  isLeader: true,
                  memberType: "STUDENT",
                  fullName: idea.submitter.fullName,
                  studentCode: idea.submitter.studentCode,
                  className: idea.submitter.className,
                  email: idea.submitter.email.trim().toLowerCase(),
                  phone: idea.submitter.phone || null,
                  orderIndex: 0,
                },
              },
            },
          });
        }

        await enqueueEmailJob(tx, {
          type: EmailJobType.IDEA_APPROVED,
          recipient: idea.submitter.email,
          payload: {
            ideaId,
            referenceCode: idea.referenceCode,
            title: idea.title,
            submitterName: idea.submitter.fullName,
            lookupUrl,
          },
          idempotencyKey,
        });
      } else if (newStatus === IdeaStatus.REJECTED) {
        await enqueueEmailJob(tx, {
          type: EmailJobType.IDEA_REJECTED,
          recipient: idea.submitter.email,
          payload: {
            ideaId,
            referenceCode: idea.referenceCode,
            title: idea.title,
            submitterName: idea.submitter.fullName,
            reason: reason?.trim(),
            lookupUrl,
          },
          idempotencyKey,
        });
      } else if (newStatus === IdeaStatus.NEEDS_REVISION) {
        await enqueueEmailJob(tx, {
          type: EmailJobType.IDEA_REVISION_REQUESTED,
          recipient: idea.submitter.email,
          payload: {
            ideaId,
            referenceCode: idea.referenceCode,
            title: idea.title,
            submitterName: idea.submitter.fullName,
            reason: reason?.trim(),
            lookupUrl,
          },
          idempotencyKey,
        });
      }
    });

    triggerGoogleSheetsAutoSync("admin:idea-status");

    // Trigger dev/test email processor in background
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật trạng thái ý tưởng thành "${STATUS_LABELS[newStatus]}".`,
      newStatus,
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        {
          error:
            "Dữ liệu ý tưởng đã bị thay đổi bởi một phiên làm việc khác. Vui lòng tải lại trang.",
        },
        { status: 409 }
      );
    }

    console.error("Lỗi cập nhật trạng thái ý tưởng:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi cập nhật trạng thái. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 401 }
      );
    }

    const { id: ideaId } = await params;
    const db = getDb();

    const idea = await db.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, referenceCode: true },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Không tìm thấy hồ sơ ý tưởng." },
        { status: 404 }
      );
    }

    await db.idea.delete({
      where: { id: ideaId },
    });

    triggerGoogleSheetsAutoSync("admin:idea-delete");

    return NextResponse.json({
      success: true,
      message: `Đã xóa ý tưởng "${idea.referenceCode || idea.title}" thành công.`,
    });
  } catch (error) {
    console.error("Lỗi xóa ý tưởng:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa hồ sơ ý tưởng." },
      { status: 500 }
    );
  }
}
