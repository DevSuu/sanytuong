import {
  PrismaClient,
  Task,
  TaskApplication,
  TaskApplicationMember,
  TaskStatus,
  TaskApplicationStatus,
  TaskHistoryAction,
  TaskApplicationHistoryAction,
  EmailJobType,
} from "@/generated/prisma/client";
import {
  hashToken,
  decryptToken,
  generateRandomToken,
  encryptToken,
  generateOtp,
  hashOtp,
  verifyOtpConstantTime,
} from "@/lib/crypto";
import {
  DomainValidationError,
} from "./profile-state-machine";
import { enqueueEmailJob } from "@/lib/email/queue";
import { getDb } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";

export interface TaskLeaderAuthContext {
  task: Task;
  submitter: {
    id: string;
    fullName: string;
    studentCode: string;
    className: string | null;
    email: string;
    emailNormalized: string;
  };
  application: (TaskApplication & {
    members: TaskApplicationMember[];
  }) | null;
}

/**
 * Authenticates that the bearer possesses a valid permanent lookup token
 * matching the Submitter of a Task Application.
 */
export async function authenticateTaskLeaderByLookupToken(
  taskId: string,
  token: string,
  db: PrismaClient,
): Promise<TaskLeaderAuthContext> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new DomainValidationError("Thiếu mã xác thực tra cứu (lookup token).");
  }

  const tokenHash = hashToken(token.trim());

  // Find lookup credential
  const credential = await db.lookupCredential.findUnique({
    where: { tokenHash },
    include: {
      submitter: {
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          className: true,
          email: true,
          emailNormalized: true,
        },
      },
    },
  });

  if (!credential || !credential.submitter || credential.revokedAt) {
    throw new DomainValidationError("Mã tra cứu không hợp lệ, không tồn tại hoặc đã bị thu hồi.");
  }

  // Find Task
  const task = await db.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new DomainValidationError("Nhiệm vụ không tồn tại.");
  }

  // Find Application of this submitter for this task (if any)
  const application = await db.taskApplication.findFirst({
    where: {
      taskId,
      submitterId: credential.submitter.id,
    },
    include: {
      members: { orderBy: { orderIndex: "asc" } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });

  return {
    task,
    submitter: credential.submitter,
    application,
  };
}

export class TaskConcurrencyConflictError extends DomainValidationError {
  constructor(message = "Nhiệm vụ đã được chọn bởi quản trị viên khác hoặc trạng thái đã thay đổi. Vui lòng tải lại trang.") {
    super(message);
    this.name = "TaskConcurrencyConflictError";
  }
}

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface SelectionResult {
  task: Task;
  selectedApplication: TaskApplication;
  unselectedCount: number;
}

/**
 * Selects an application to execute the task with strict database-level concurrency protection.
 * Uses PostgreSQL transaction advisory lock: pg_advisory_xact_lock(hashtext('task-selection:' || taskId))
 * guarantees that two concurrent admin selection requests are serialized.
 */
export async function selectWinningTaskApplication(
  tx: TxClient,
  taskId: string,
  applicationId: string,
  adminUserId: string,
  adminUserEmail?: string,
  adminNote?: string,
): Promise<SelectionResult> {
  // 1. Acquire PostgreSQL transaction-level advisory lock on this specific task
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('task-selection:' || ${taskId}))`;

  // 2. Fetch fresh Task state inside the lock
  const task = await tx.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new DomainValidationError("Nhiệm vụ không tồn tại.");
  }

  if (task.status !== TaskStatus.OPEN) {
    throw new TaskConcurrencyConflictError(
      `Nhiệm vụ hiện không ở trạng thái mở đăng ký (OPEN) mà đang ở trạng thái "${task.status}". Không thể chọn nhóm.`,
    );
  }

  // 3. Find the target application
  const targetApp = await tx.taskApplication.findUnique({
    where: { id: applicationId },
    include: {
      submitter: {
        include: { lookupCredential: true },
      },
    },
  });

  if (!targetApp || targetApp.taskId !== taskId) {
    throw new DomainValidationError("Đơn đăng ký không thuộc nhiệm vụ này.");
  }

  if (targetApp.status !== TaskApplicationStatus.SUBMITTED) {
    throw new DomainValidationError(
      `Đơn đăng ký hiện ở trạng thái "${targetApp.status}". Chỉ đơn ở trạng thái "SUBMITTED" mới có thể được chọn.`,
    );
  }

  const appUrl = getAppUrl();

  // 4. Update the selected application
  const selectedApp = await tx.taskApplication.update({
    where: { id: applicationId },
    data: {
      status: TaskApplicationStatus.SELECTED,
      selectedAt: new Date(),
      adminFeedback: adminNote || null,
    },
  });

  // 5. Update task from OPEN to ASSIGNED
  const updatedTask = await tx.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.ASSIGNED,
    },
  });

  // 6. Record task history
  await tx.taskHistory.create({
    data: {
      taskId,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: TaskHistoryAction.TASK_APPLICATION_SELECTED,
      reason: adminNote || `Ban tổ chức đã chọn nhóm của ${targetApp.submitter.fullName} để thực hiện nhiệm vụ.`,
      metadata: {
        applicationId,
        selectedSubmitterId: targetApp.submitterId,
        adminUserEmail,
      },
    },
  });

  // 7. Record history for the selected application
  await tx.taskApplicationHistory.create({
    data: {
      applicationId: targetApp.id,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: TaskApplicationHistoryAction.APPLICATION_SELECTED,
      reason: adminNote || "Nhóm được chọn thực hiện nhiệm vụ.",
    },
  });

  // 8. Enqueue notification email for the selected group leader
  let selectedLookupUrl = `${appUrl}/tra-cuu`;
  if (targetApp.submitter.lookupCredential) {
    try {
      const rawToken = decryptToken(targetApp.submitter.lookupCredential.encryptedToken);
      selectedLookupUrl = `${appUrl}/tra-cuu/${rawToken}`;
    } catch {
      // Fallback url
    }
  }

  await enqueueEmailJob(tx, {
    type: EmailJobType.TASK_APPLICATION_SELECTED,
    recipient: targetApp.submitter.email,
    payload: {
      leaderName: targetApp.submitter.fullName,
      taskTitle: task.title,
      orderingOrganization: task.orderingOrganization,
      lookupUrl: selectedLookupUrl,
      adminNote: adminNote || "",
    },
    idempotencyKey: `task-selected-${targetApp.id}`,
  });

  // 9. Update all other SUBMITTED applications to NOT_SELECTED
  const otherApps = await tx.taskApplication.findMany({
    where: {
      taskId,
      id: { not: applicationId },
      status: TaskApplicationStatus.SUBMITTED,
    },
    include: {
      submitter: {
        include: { lookupCredential: true },
      },
    },
  });

  if (otherApps.length > 0) {
    await tx.taskApplication.updateMany({
      where: {
        taskId,
        id: { not: applicationId },
        status: TaskApplicationStatus.SUBMITTED,
      },
      data: {
        status: TaskApplicationStatus.NOT_SELECTED,
        adminFeedback: "Nhiệm vụ đã được giao cho nhóm giải pháp phù hợp nhất.",
      },
    });

    for (const other of otherApps) {
      await tx.taskApplicationHistory.create({
        data: {
          applicationId: other.id,
          actorId: adminUserId,
          actorRole: "ADMIN",
          action: TaskApplicationHistoryAction.APPLICATION_NOT_SELECTED,
          reason: "Nhiệm vụ đã được giao cho nhóm khác.",
        },
      });

      let otherLookupUrl = `${appUrl}/tra-cuu`;
      if (other.submitter.lookupCredential) {
        try {
          const rawToken = decryptToken(other.submitter.lookupCredential.encryptedToken);
          otherLookupUrl = `${appUrl}/tra-cuu/${rawToken}`;
        } catch {
          // Fallback url
        }
      }

      await enqueueEmailJob(tx, {
        type: EmailJobType.TASK_APPLICATION_NOT_SELECTED,
        recipient: other.submitter.email,
        payload: {
          leaderName: other.submitter.fullName,
          taskTitle: task.title,
          orderingOrganization: task.orderingOrganization,
          lookupUrl: otherLookupUrl,
        },
        idempotencyKey: `task-not-selected-${other.id}`,
      });
    }
  }

  return {
    task: updatedTask,
    selectedApplication: selectedApp,
    unselectedCount: otherApps.length,
  };
}

/**
 * Generates a clean URL slug from title
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface VerifyOtpResult {
  application: TaskApplication;
  message: string;
  lookupToken: string | null;
  lookupUrl: string;
}

/**
 * Verifies email ownership for a TaskApplication using a 6-digit OTP.
 * Enforces PostgreSQL advisory locking to serialize concurrent requests.
 * Transitions TaskApplication from PENDING_VERIFICATION to SUBMITTED and enqueues TASK_APPLICATION_SUBMITTED.
 */
export async function verifyTaskApplicationEmailOtp(
  tx: TxClient,
  taskId: string,
  applicationId: string,
  inputOtp: string,
): Promise<VerifyOtpResult> {
  if (!inputOtp || typeof inputOtp !== "string" || !/^\d{6}$/.test(inputOtp.trim())) {
    throw new DomainValidationError("Mã xác thực OTP phải gồm đúng 6 chữ số.");
  }

  // 1. Transaction-level advisory lock serializes concurrent verifications for this application
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('task-app-verify:' || ${applicationId}))`;

  // 2. Fetch fresh TaskApplication state inside lock
  const app = await tx.taskApplication.findUnique({
    where: { id: applicationId },
    include: {
      task: true,
      submitter: {
        include: { lookupCredential: true },
      },
    },
  });

  if (!app || app.taskId !== taskId) {
    throw new DomainValidationError("Đơn đăng ký không tồn tại hoặc không thuộc nhiệm vụ này.");
  }

  if (app.status === TaskApplicationStatus.SUBMITTED) {
    throw new DomainValidationError("Đơn đăng ký này đã được xác thực thành công trước đó.");
  }

  if (app.status !== TaskApplicationStatus.PENDING_VERIFICATION) {
    throw new DomainValidationError(
      `Đơn đăng ký không ở trạng thái chờ xác thực (trạng thái: "${app.status}").`,
    );
  }

  // 3. Find latest unconsumed verification record
  const verification = await tx.taskApplicationVerification.findFirst({
    where: {
      applicationId,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw new DomainValidationError("Không tìm thấy mã xác thực hợp lệ. Vui lòng yêu cầu gửi mã mới.");
  }

  // 4. Check attempts
  if (verification.attempts >= verification.maxAttempts) {
    throw new DomainValidationError(
      "Mã xác thực đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.",
    );
  }

  // 5. Check expiration (10 minutes)
  if (new Date() > new Date(verification.expiresAt)) {
    throw new DomainValidationError(
      "Mã xác thực đã hết hạn (thời hạn 10 phút). Vui lòng yêu cầu gửi lại mã mới.",
    );
  }

  // 6. Verify OTP with constant-time comparison
  const isValid = verifyOtpConstantTime(inputOtp.trim(), verification.otpHash);
  if (!isValid) {
    const nextAttempts = verification.attempts + 1;
    await getDb().taskApplicationVerification.update({
      where: { id: verification.id },
      data: { attempts: nextAttempts },
    });

    const remaining = Math.max(0, verification.maxAttempts - nextAttempts);
    if (remaining === 0) {
      throw new DomainValidationError(
        "Mã xác thực không chính xác. Mã đã bị vô hiệu hóa do vượt quá 5 lần thử. Vui lòng yêu cầu gửi lại mã mới.",
      );
    }
    throw new DomainValidationError(`Mã xác thực không chính xác. Bạn còn ${remaining} lần thử.`);
  }

  const now = new Date();

  // 7. Mark verification consumed
  await tx.taskApplicationVerification.update({
    where: { id: verification.id },
    data: { consumedAt: now },
  });

  // Invalidate any other unconsumed verifications for this application
  await tx.taskApplicationVerification.updateMany({
    where: {
      applicationId,
      consumedAt: null,
    },
    data: { consumedAt: now },
  });

  // 7b. Mark Submitter emailVerifiedAt and ensure permanent LookupCredential exists
  await tx.submitter.update({
    where: { id: app.submitter.id },
    data: {
      emailVerifiedAt: app.submitter.emailVerifiedAt ?? now,
    },
  });

  let rawLookupToken: string | null = null;
  if (!app.submitter.lookupCredential) {
    rawLookupToken = generateRandomToken(32);
    await tx.lookupCredential.create({
      data: {
        submitterId: app.submitter.id,
        tokenHash: hashToken(rawLookupToken),
        encryptedToken: encryptToken(rawLookupToken),
      },
    });
  } else if (!app.submitter.lookupCredential.revokedAt) {
    try {
      rawLookupToken = decryptToken(app.submitter.lookupCredential.encryptedToken);
    } catch (e) {
      console.error("[TaskVerifyDecryptTokenError]", e);
    }
  }

  // 8. Transactionally transition TaskApplication to SUBMITTED
  const updatedApp = await tx.taskApplication.update({
    where: { id: applicationId },
    data: {
      status: TaskApplicationStatus.SUBMITTED,
      submittedAt: now,
    },
    include: {
      submitter: true,
      task: true,
      members: true,
    },
  });

  // 9. Record TaskApplicationHistory
  await tx.taskApplicationHistory.create({
    data: {
      applicationId,
      actorId: updatedApp.submitterId,
      actorRole: "LEADER",
      action: TaskApplicationHistoryAction.APPLICATION_SUBMITTED,
      reason: "Xác thực email thành công qua mã OTP 6 số. Đơn đăng ký đã chính thức nộp tới Ban tổ chức.",
    },
  });

  // 10. Enqueue Outbox EmailJob to leader email with direct permanent lookup URL
  const appUrl = getAppUrl();
  const lookupUrl = rawLookupToken
    ? `${appUrl}/tra-cuu/${rawLookupToken}`
    : `${appUrl}/tra-cuu`;

  await enqueueEmailJob(tx, {
    type: EmailJobType.TASK_APPLICATION_SUBMITTED,
    recipient: updatedApp.submitter.email,
    payload: {
      leaderName: updatedApp.submitter.fullName,
      taskTitle: updatedApp.task.title,
      orderingOrganization: updatedApp.task.orderingOrganization,
      applicationId: updatedApp.id,
      lookupUrl,
    },
    idempotencyKey: `task-app-submit-${updatedApp.id}`,
  });

  return {
    application: updatedApp,
    message: "Xác thực email thành công! Hồ sơ đăng ký nhiệm vụ đã được gửi tới Ban tổ chức.",
    lookupToken: rawLookupToken,
    lookupUrl,
  };
}

export interface ResendOtpResult {
  verificationId: string;
  message: string;
}

/**
 * Resends a new 6-digit OTP for a TaskApplication in PENDING_VERIFICATION.
 * Enforces 60-second cooldown from the most recent verification attempt.
 * Invalidates all previous OTPs for this application.
 */
export async function resendTaskApplicationOtp(
  tx: TxClient,
  taskId: string,
  applicationId: string,
): Promise<ResendOtpResult> {
  // 1. Transaction-level advisory lock serializes concurrent resend requests
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('task-app-verify:' || ${applicationId}))`;

  // 2. Fetch fresh TaskApplication state
  const app = await tx.taskApplication.findUnique({
    where: { id: applicationId },
    include: {
      task: true,
      submitter: true,
    },
  });

  if (!app || app.taskId !== taskId) {
    throw new DomainValidationError("Đơn đăng ký không tồn tại hoặc không thuộc nhiệm vụ này.");
  }

  if (app.status === TaskApplicationStatus.SUBMITTED) {
    throw new DomainValidationError("Đơn đăng ký này đã được nộp chính thức. Không thể gửi lại mã xác thực.");
  }

  if (app.status !== TaskApplicationStatus.PENDING_VERIFICATION) {
    throw new DomainValidationError(
      `Đơn đăng ký không ở trạng thái chờ xác thực (trạng thái: "${app.status}").`,
    );
  }

  // 3. Rate-limiting: Check cooldown 60 seconds from latest verification
  const latestVerification = await tx.taskApplicationVerification.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });

  if (latestVerification) {
    const elapsedMs = Date.now() - new Date(latestVerification.createdAt).getTime();
    const cooldownMs = 60_000;
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new DomainValidationError(
        `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại mã xác thực mới.`,
      );
    }
  }

  // 4. Invalidate all previous unconsumed verifications for this application
  await tx.taskApplicationVerification.updateMany({
    where: {
      applicationId,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  // 5. Generate new CSPRNG OTP (6 digits)
  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // 6. Create new verification record
  const newVerification = await tx.taskApplicationVerification.create({
    data: {
      applicationId,
      email: app.submitter.emailNormalized,
      otpHash,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
    },
  });

  // 7. Enqueue VERIFY_TASK_APPLICATION email to leader email
  await enqueueEmailJob(tx, {
    type: EmailJobType.VERIFY_TASK_APPLICATION,
    recipient: app.submitter.email,
    payload: {
      leaderName: app.submitter.fullName,
      taskTitle: app.task.title,
      otp, // strictly for email rendering in queue, never logged
      applicationId: app.id,
      expiresMinutes: 10,
    },
    idempotencyKey: `verify-task-app-${newVerification.id}`,
  });

  return {
    verificationId: newVerification.id,
    message: "Đã gửi lại mã xác thực 6 số mới tới email của bạn.",
  };
}

