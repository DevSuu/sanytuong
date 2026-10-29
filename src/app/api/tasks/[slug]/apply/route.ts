import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  normalizeEmail,
  hashToken,
  generateOtp,
  hashOtp,
} from "@/lib/crypto";
import {
  TaskStatus,
  TaskApplicationStatus,
  TaskApplicationHistoryAction,
  EmailJobType,
} from "@/generated/prisma/client";
import { taskApplicationSubmitSchema } from "@/lib/validation/task-schema";
import {
  validateTaskApplicationMembers,
  DomainValidationError,
} from "@/lib/domain/task-state-machine";
import { MemberInputDto } from "@/lib/domain/profile-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import { enqueueEmailJob, processPendingEmailJobs } from "@/lib/email/queue";
import { checkTargetRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/[slug]/apply
 * Submits an application to execute a task and places it into PENDING_VERIFICATION.
 * Generates a cryptographically secure 6-digit email OTP and enqueues VERIFY_TASK_APPLICATION.
 * Never transitions to SUBMITTED without OTP verification.
 * Never creates or returns raw lookup credentials or lookupToken.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();

    const parsed = taskApplicationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu đăng ký không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const {
      proposal,
      fullName,
      studentCode,
      className,
      email,
      phone,
      major,
      members,
      lookupToken,
    } = parsed.data;

    const db = getDb();

    // 1. Fetch task and verify existence
    const task = await db.task.findUnique({
      where: { slug },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Nhiệm vụ không tồn tại." },
        { status: 404 }
      );
    }

    // 2. Verify Task status is OPEN
    if (task.status !== TaskStatus.OPEN) {
      return NextResponse.json(
        {
          error: `Nhiệm vụ hiện không mở đăng ký (trạng thái: ${task.status}).`,
        },
        { status: 400 }
      );
    }

    // 3. Verify Server-side applicationDeadline
    if (task.applicationDeadline && new Date() > new Date(task.applicationDeadline)) {
      return NextResponse.json(
        { error: "Đã hết thời hạn đăng ký thực hiện nhiệm vụ này." },
        { status: 400 }
      );
    }

    const normEmail = normalizeEmail(email);

    // Per-email rate limit: max 5 task applications per 5 minutes for the same target email
    const emailRateLimit = checkTargetRateLimit("task_apply_email", normEmail, {
      windowMs: 5 * 60 * 1000,
      max: 5,
    });
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Địa chỉ email này vừa gửi quá nhiều yêu cầu liên tiếp. Vui lòng thử lại sau ít phút.",
        },
        { status: 429 }
      );
    }

    const rawLookupToken =
      (lookupToken && lookupToken.trim()) ||
      req.headers.get("x-lookup-token")?.trim() ||
      null;

    // 4. Resolve or create Submitter (WITHOUT exposing or generating lookupToken)
    const { submitterData, isAuthenticatedByLookupToken } = await db.$transaction(async (tx) => {
      let sub = null;
      let authenticated = false;

      if (rawLookupToken) {
        const tokenH = hashToken(rawLookupToken);
        const cred = await tx.lookupCredential.findUnique({
          where: { tokenHash: tokenH },
          include: { submitter: true },
        });

        if (cred && cred.submitter && !cred.revokedAt) {
          sub = cred.submitter;
          authenticated = true;
        }
      }

      if (!sub) {
        sub = await tx.submitter.findUnique({
          where: { emailNormalized: normEmail },
        });
      }

      if (!sub) {
        sub = await tx.submitter.create({
          data: {
            fullName,
            studentCode,
            className,
            major: major || null,
            phone: phone || null,
            email,
            emailNormalized: normEmail,
          },
        });
      } else if (!sub.emailVerifiedAt || authenticated) {
        // SECURITY FIX: Only overwrite existing Submitter PII if not yet verified
        // OR if caller proved ownership via lookupToken.
        sub = await tx.submitter.update({
          where: { id: sub.id },
          data: {
            fullName,
            studentCode,
            className,
            major: major || sub.major,
            phone: phone || sub.phone,
          },
        });
      }

      return { submitterData: sub, isAuthenticatedByLookupToken: authenticated };
    });

    // 5. Domain validation of group members (validate against the submitted form's leader info)
    try {
      validateTaskApplicationMembers(
        {
          fullName: fullName.trim(),
          studentCode: studentCode.trim().toUpperCase(),
          emailNormalized: normEmail,
        },
        members as MemberInputDto[]
      );
    } catch (err: unknown) {
      if (err instanceof DomainValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // 6. Transactional Application Submission -> PENDING_VERIFICATION + 6-digit OTP
    const result = await db.$transaction(async (tx) => {
      // Find existing application for this task by this submitter
      const existingApp = await tx.taskApplication.findFirst({
        where: {
          taskId: task.id,
          submitterId: submitterData.id,
        },
      });

      if (existingApp && existingApp.status === TaskApplicationStatus.SELECTED) {
        throw new DomainValidationError(
          "Đơn đăng ký của nhóm đã được Ban tổ chức lựa chọn. Không thể tự ý thay đổi."
        );
      }

      // SECURITY FIX: Prevent unauthenticated callers from overwriting or downgrading
      // an application that has already been verified and submitted (SUBMITTED / NOT_SELECTED).
      if (
        existingApp &&
        (existingApp.status === TaskApplicationStatus.SUBMITTED ||
          existingApp.status === TaskApplicationStatus.NOT_SELECTED) &&
        !isAuthenticatedByLookupToken
      ) {
        throw new DomainValidationError(
          "Email này đã có hồ sơ đăng ký chính thức cho nhiệm vụ này. Để cập nhật hồ sơ đã nộp, vui lòng truy cập qua đường dẫn tra cứu bí mật trong email của bạn."
        );
      }

      let application;

      if (existingApp) {
        // Update existing application to PENDING_VERIFICATION
        application = await tx.taskApplication.update({
          where: { id: existingApp.id },
          data: {
            proposal,
            status: TaskApplicationStatus.PENDING_VERIFICATION,
            submittedAt: null,
          },
        });

        // Delete old members
        await tx.taskApplicationMember.deleteMany({
          where: { applicationId: existingApp.id },
        });

        // Invalidate all previous unconsumed verifications for this application
        await tx.taskApplicationVerification.updateMany({
          where: {
            applicationId: existingApp.id,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
      } else {
        // Create new application in PENDING_VERIFICATION
        application = await tx.taskApplication.create({
          data: {
            taskId: task.id,
            submitterId: submitterData.id,
            proposal,
            status: TaskApplicationStatus.PENDING_VERIFICATION,
            submittedAt: null,
          },
        });
      }

      // Insert new members
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        await tx.taskApplicationMember.create({
          data: {
            applicationId: application.id,
            memberType: m.memberType,
            isLeader: m.isLeader,
            fullName: m.fullName.trim(),
            email: m.email.trim().toLowerCase(),
            studentCode: m.studentCode ? m.studentCode.trim().toUpperCase() : null,
            className: m.className ? m.className.trim() : null,
            phone: m.phone ? m.phone.trim() : null,
            department: m.department ? m.department.trim() : null,
            orderIndex: i,
          },
        });
      }

      // Generate 6-digit CSPRNG OTP
      const otp = generateOtp(6);
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create Verification record
      const verification = await tx.taskApplicationVerification.create({
        data: {
          applicationId: application.id,
          email: submitterData.emailNormalized,
          otpHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt,
        },
      });

      // Record audit history
      await tx.taskApplicationHistory.create({
        data: {
          applicationId: application.id,
          actorId: submitterData.id,
          actorRole: "LEADER",
          action: TaskApplicationHistoryAction.APPLICATION_UPDATED,
          reason: "Người dùng gửi hồ sơ đăng ký nhiệm vụ, chuyển sang trạng thái chờ xác thực email OTP.",
        },
      });

      // Enqueue VERIFY_TASK_APPLICATION to leader's email
      await enqueueEmailJob(tx, {
        type: EmailJobType.VERIFY_TASK_APPLICATION,
        recipient: submitterData.email,
        payload: {
          leaderName: submitterData.fullName,
          taskTitle: task.title,
          otp, // strictly for email payload rendering in queue, never logged
          applicationId: application.id,
          expiresMinutes: 10,
        },
        idempotencyKey: `verify-task-app-${verification.id}`,
      });

      return { application, verification };
    });

    triggerGoogleSheetsAutoSync("task:apply");

    // Trigger background email processor
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err)
    );

    return NextResponse.json({
      success: true,
      status: TaskApplicationStatus.PENDING_VERIFICATION,
      message: "Đã gửi mã xác thực 6 số tới email của bạn. Vui lòng kiểm tra hộp thư để hoàn tất đăng ký.",
      applicationId: result.application.id,
      email: submitterData.email,
    });
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[TaskApplyError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi nộp hồ sơ đăng ký nhiệm vụ." },
      { status: 500 }
    );
  }
}
