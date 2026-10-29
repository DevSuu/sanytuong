import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeEmail, hashToken } from "@/lib/crypto";
import {
  TaskStatus,
  TaskApplicationStatus,
  TaskApplicationHistoryAction,
} from "@/generated/prisma/client";
import { taskApplicationDraftSchema } from "@/lib/validation/task-schema";
import { DomainValidationError } from "@/lib/domain/task-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/[slug]/draft
 * Saves a draft of the task application.
 * Never transitions to SUBMITTED.
 * Never creates or returns raw lookup credentials or lookupToken.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();

    const parsed = taskApplicationDraftSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu bản nháp không hợp lệ.";
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
        { error: `Nhiệm vụ không mở đăng ký (trạng thái: ${task.status}).` },
        { status: 400 }
      );
    }

    const normEmail = normalizeEmail(email);
    const rawLookupToken =
      (lookupToken && lookupToken.trim()) ||
      req.headers.get("x-lookup-token")?.trim() ||
      null;

    // 3. Resolve or create Submitter (WITHOUT exposing or generating lookupToken)
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

    // 4. Save Draft
    const result = await db.$transaction(async (tx) => {
      const existingApp = await tx.taskApplication.findFirst({
        where: {
          taskId: task.id,
          submitterId: submitterData.id,
        },
      });

      if (existingApp && existingApp.status === TaskApplicationStatus.SELECTED) {
        throw new DomainValidationError(
          "Đơn đăng ký của nhóm đã được Ban tổ chức lựa chọn. Không thể chỉnh sửa."
        );
      }

      // SECURITY FIX: Prevent unauthenticated callers from downgrading or wiping
      // an application that has already been verified and submitted (SUBMITTED / NOT_SELECTED).
      if (
        existingApp &&
        (existingApp.status === TaskApplicationStatus.SUBMITTED ||
          existingApp.status === TaskApplicationStatus.NOT_SELECTED) &&
        !isAuthenticatedByLookupToken
      ) {
        throw new DomainValidationError(
          "Hồ sơ đăng ký nhiệm vụ của email này đã được xác thực và nộp chính thức. Để chỉnh sửa, vui lòng truy cập từ đường dẫn tra cứu bí mật trong email của bạn."
        );
      }

      let application;
      if (existingApp) {
        application = await tx.taskApplication.update({
          where: { id: existingApp.id },
          data: {
            proposal: proposal || "",
            status: TaskApplicationStatus.DRAFT,
          },
        });

        await tx.taskApplicationMember.deleteMany({
          where: { applicationId: existingApp.id },
        });

        // Invalidate active OTP verifications if draft is re-saved
        await tx.taskApplicationVerification.updateMany({
          where: {
            applicationId: existingApp.id,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
      } else {
        application = await tx.taskApplication.create({
          data: {
            taskId: task.id,
            submitterId: submitterData.id,
            proposal: proposal || "",
            status: TaskApplicationStatus.DRAFT,
          },
        });
      }

      if (members && members.length > 0) {
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
      }

      await tx.taskApplicationHistory.create({
        data: {
          applicationId: application.id,
          actorId: submitterData.id,
          actorRole: "LEADER",
          action: TaskApplicationHistoryAction.APPLICATION_DRAFT_SAVED,
          reason: "Lưu bản nháp đơn đăng ký nhiệm vụ.",
        },
      });

      return application;
    });

    triggerGoogleSheetsAutoSync("task:draft");

    return NextResponse.json({
      success: true,
      status: TaskApplicationStatus.DRAFT,
      message: "Đã lưu bản nháp thành công.",
      applicationId: result.id,
    });
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[TaskDraftError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu bản nháp." },
      { status: 500 }
    );
  }
}
