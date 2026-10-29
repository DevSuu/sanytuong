import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminUpdateTaskStatusSchema } from "@/lib/validation/task-schema";
import {
  assertValidTaskTransition,
  InvalidTaskTransitionError,
  TASK_STATUS_LABELS,
} from "@/lib/domain/task-state-machine";
import {
  TaskHistoryAction,
  TaskStatus,
  EmailJobType,
} from "@/generated/prisma/client";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { decryptToken } from "@/lib/crypto";
import { getAppUrl } from "@/lib/app-url";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/tasks/[id]/status
 * Enforces task lifecycle state machine transitions (Sections 11 & 12).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = adminUpdateTaskStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu trạng thái không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { status: newStatus, reason } = parsed.data;
    const db = getDb();
    const appUrl = getAppUrl();

    const task = await db.task.findUnique({
      where: { id },
      include: {
        applications: {
          where: { status: "SELECTED" },
          take: 1,
          include: {
            submitter: {
              include: { lookupCredential: true },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
    }

    // Validate transition
    try {
      assertValidTaskTransition(task.status, newStatus, reason);
    } catch (err: unknown) {
      if (err instanceof InvalidTaskTransitionError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const updatedTask = await db.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.taskHistory.create({
        data: {
          taskId: id,
          actorId: session.user.id,
          actorRole: "ADMIN",
          action: TaskHistoryAction.TASK_STATUS_CHANGED,
          reason:
            reason ||
            `Chuyển trạng thái từ "${TASK_STATUS_LABELS[task.status]}" sang "${TASK_STATUS_LABELS[newStatus]}".`,
          metadata: {
            oldStatus: task.status,
            newStatus,
            adminName: session.user.name,
            adminEmail: session.user.email,
          },
        },
      });

      // If completed or cancelled, notify selected group leader if one exists
      const selectedApp = task.applications[0];
      if (selectedApp && newStatus === TaskStatus.COMPLETED) {
        let lookupUrl = `${appUrl}/tra-cuu`;
        if (selectedApp.submitter.lookupCredential) {
          try {
            const rawToken = decryptToken(
              selectedApp.submitter.lookupCredential.encryptedToken
            );
            lookupUrl = `${appUrl}/tra-cuu/${rawToken}`;
          } catch {
            // Fallback to base lookup URL if token cannot be decrypted
          }
        }

        await enqueueEmailJob(tx, {
          type: EmailJobType.TASK_COMPLETED,
          recipient: selectedApp.submitter.email,
          payload: {
            leaderName: selectedApp.submitter.fullName,
            taskTitle: task.title,
            orderingOrganization: task.orderingOrganization,
            lookupUrl,
          },
          idempotencyKey: `task-completed-${task.id}`,
        });
      }

      return updated;
    });

    triggerGoogleSheetsAutoSync("admin:task-status");

    // Trigger dev/test background worker
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      message: `Đã chuyển trạng thái nhiệm vụ sang "${TASK_STATUS_LABELS[newStatus]}".`,
      task: updatedTask,
    });
  } catch (error) {
    console.error("[AdminTaskStatusError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi chuyển trạng thái nhiệm vụ." },
      { status: 500 }
    );
  }
}
