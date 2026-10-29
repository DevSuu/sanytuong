import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  verifyTaskApplicationEmailOtp,
} from "@/lib/domain/task-service";
import { DomainValidationError } from "@/lib/domain/task-state-machine";
import { processPendingEmailJobs } from "@/lib/email/queue";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/[slug]/applications/[applicationId]/verify
 * Verifies email ownership via 6-digit OTP.
 * On success, transactionally moves TaskApplication from PENDING_VERIFICATION to SUBMITTED
 * and enqueues TASK_APPLICATION_SUBMITTED transactional email.
 * Concurrency protected via PostgreSQL advisory locks.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string; applicationId: string }>;
  }
) {
  try {
    const { slug, applicationId } = await params;
    const body = await req.json().catch(() => ({}));
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

    if (!otp || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Vui lòng nhập đúng mã xác thực OTP 6 chữ số." },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Fetch Task
    const task = await db.task.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Nhiệm vụ không tồn tại." },
        { status: 404 }
      );
    }

    // 2. Perform verification transaction
    const result = await db.$transaction(async (tx) => {
      return await verifyTaskApplicationEmailOtp(tx, task.id, applicationId, otp);
    });

    triggerGoogleSheetsAutoSync("task:verify-otp");

    // 3. Trigger dev/test email processing in background
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      status: result.application.status,
      message: result.message,
      applicationId: result.application.id,
      lookupToken: result.lookupToken,
      lookupUrl: result.lookupUrl,
      application: {
        id: result.application.id,
        taskId: result.application.taskId,
        proposal: result.application.proposal,
        status: result.application.status,
        submittedAt: result.application.submittedAt?.toISOString() || null,
        createdAt: result.application.createdAt.toISOString(),
        updatedAt: result.application.updatedAt.toISOString(),
        members:
          (
            result.application as {
              members?: Array<{
                id: string;
                fullName: string;
                role?: string | null;
                studentCode?: string | null;
                className?: string | null;
                email: string;
                phone?: string | null;
                department?: string | null;
              }>;
            }
          ).members?.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            role: m.role,
            studentCode: m.studentCode,
            className: m.className,
            email: m.email,
            phone: m.phone,
            department: m.department,
          })) || [],
      },
    });
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[TaskVerifyOtpError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xác thực mã OTP." },
      { status: 500 }
    );
  }
}
