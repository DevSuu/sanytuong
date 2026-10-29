import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminSelectApplicationSchema } from "@/lib/validation/task-schema";
import {
  selectWinningTaskApplication,
  TaskConcurrencyConflictError,
} from "@/lib/domain/task-service";
import { DomainValidationError } from "@/lib/domain/task-state-machine";
import { processPendingEmailJobs } from "@/lib/email/queue";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/tasks/[id]/applications/[applicationId]/select
 * Admin action to select the winning application for a task.
 * Enforces strict transactional concurrency protection with PostgreSQL advisory locking.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id: taskId, applicationId } = await params;
    const body = await req.json().catch(() => ({}));

    const parsed = adminSelectApplicationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { adminNote } = parsed.data;
    const db = getDb();

    // Execute atomic selection inside transaction with advisory lock
    const selection = await db.$transaction(async (tx) => {
      return selectWinningTaskApplication(
        tx,
        taskId,
        applicationId,
        session.user.id,
        session.user.email,
        adminNote || undefined
      );
    });

    triggerGoogleSheetsAutoSync("admin:task-select-winner");

    // Trigger dev/test email processor in background
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      message: "Đã chọn nhóm thực hiện nhiệm vụ thành công!",
      task: selection.task,
      selectedApplication: selection.selectedApplication,
      unselectedCount: selection.unselectedCount,
    });
  } catch (error: unknown) {
    if (error instanceof TaskConcurrencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[AdminSelectTaskApplicationError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi lựa chọn nhóm thực hiện nhiệm vụ." },
      { status: 500 }
    );
  }
}
