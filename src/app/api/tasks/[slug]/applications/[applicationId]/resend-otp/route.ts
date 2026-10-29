import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resendTaskApplicationOtp } from "@/lib/domain/task-service";
import { DomainValidationError } from "@/lib/domain/task-state-machine";
import { processPendingEmailJobs } from "@/lib/email/queue";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/[slug]/applications/[applicationId]/resend-otp
 * Resends a new 6-digit OTP to the leader email.
 * Enforces 60-second cooldown from the previous verification creation.
 * Invalidates previous active OTPs.
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

    // 2. Perform resend transaction
    const result = await db.$transaction(async (tx) => {
      return await resendTaskApplicationOtp(tx, task.id, applicationId);
    });

    // 3. Trigger dev/test email processing in background
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      const isCooldown = /Vui lòng đợi \d+ giây/.test(error.message);
      return NextResponse.json(
        { error: error.message },
        { status: isCooldown ? 429 : 400 }
      );
    }
    console.error("[TaskResendOtpError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi gửi lại mã xác thực." },
      { status: 500 }
    );
  }
}
