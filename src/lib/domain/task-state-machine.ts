import {
  DomainValidationError,
  DuplicateMemberError,
  MemberInputDto,
  MemberType,
} from "./profile-state-machine";

export const TaskStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskApplicationStatus = {
  DRAFT: "DRAFT",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  SUBMITTED: "SUBMITTED",
  SELECTED: "SELECTED",
  NOT_SELECTED: "NOT_SELECTED",
  CANCELLED: "CANCELLED",
} as const;
export type TaskApplicationStatus =
  (typeof TaskApplicationStatus)[keyof typeof TaskApplicationStatus];

export const TaskHistoryAction = {
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_DELETED: "TASK_DELETED",
} as const;
export type TaskHistoryAction =
  (typeof TaskHistoryAction)[keyof typeof TaskHistoryAction];

export const TaskApplicationHistoryAction = {
  APPLICATION_CREATED: "APPLICATION_CREATED",
  APPLICATION_UPDATED: "APPLICATION_UPDATED",
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  APPLICATION_SELECTED: "APPLICATION_SELECTED",
  APPLICATION_NOT_SELECTED: "APPLICATION_NOT_SELECTED",
} as const;
export type TaskApplicationHistoryAction =
  (typeof TaskApplicationHistoryAction)[keyof typeof TaskApplicationHistoryAction];

export { MemberType, DomainValidationError, DuplicateMemberError };

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở đăng ký",
  ASSIGNED: "Đã giao nhóm",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CLOSED: "Đã đóng đăng ký",
  CANCELLED: "Đã hủy",
};

export const TASK_STATUS_BADGES: Record<
  TaskStatus,
  { bg: string; color: string; border: string }
> = {
  DRAFT: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748b",
    border: "rgba(100, 116, 139, 0.25)",
  },
  OPEN: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    border: "rgba(16, 185, 129, 0.25)",
  },
  ASSIGNED: {
    bg: "rgba(14, 165, 233, 0.12)",
    color: "#0ea5e9",
    border: "rgba(14, 165, 233, 0.25)",
  },
  IN_PROGRESS: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#f59e0b",
    border: "rgba(245, 158, 11, 0.25)",
  },
  COMPLETED: {
    bg: "rgba(34, 197, 94, 0.12)",
    color: "#22c55e",
    border: "rgba(34, 197, 94, 0.25)",
  },
  CLOSED: {
    bg: "rgba(107, 114, 128, 0.12)",
    color: "#6b7280",
    border: "rgba(107, 114, 128, 0.25)",
  },
  CANCELLED: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#ef4444",
    border: "rgba(239, 68, 68, 0.25)",
  },
};

export const APPLICATION_STATUS_LABELS: Record<TaskApplicationStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_VERIFICATION: "Chờ xác thực OTP",
  SUBMITTED: "Đã gửi đăng ký",
  SELECTED: "Được chọn thực hiện",
  NOT_SELECTED: "Không được chọn",
  CANCELLED: "Đã hủy",
};

export const APPLICATION_STATUS_BADGES: Record<
  TaskApplicationStatus,
  { bg: string; color: string; border: string }
> = {
  DRAFT: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748b",
    border: "rgba(100, 116, 139, 0.25)",
  },
  PENDING_VERIFICATION: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#f59e0b",
    border: "rgba(245, 158, 11, 0.25)",
  },
  SUBMITTED: {
    bg: "rgba(2, 132, 199, 0.12)",
    color: "#0284c7",
    border: "rgba(2, 132, 199, 0.25)",
  },
  SELECTED: {
    bg: "rgba(22, 163, 74, 0.15)",
    color: "#16a34a",
    border: "rgba(22, 163, 74, 0.3)",
  },
  NOT_SELECTED: {
    bg: "rgba(107, 114, 128, 0.12)",
    color: "#6b7280",
    border: "rgba(107, 114, 128, 0.25)",
  },
  CANCELLED: {
    bg: "rgba(220, 38, 38, 0.12)",
    color: "#dc2626",
    border: "rgba(220, 38, 38, 0.25)",
  },
};

export class InvalidTaskTransitionError extends DomainValidationError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTaskTransitionError";
  }
}

/**
 * Valid Task state transitions per Section 11 & 12
 */
const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: [TaskStatus.OPEN, TaskStatus.CANCELLED],
  OPEN: [
    TaskStatus.ASSIGNED,
    TaskStatus.CLOSED,
    TaskStatus.CANCELLED,
  ],
  ASSIGNED: [
    TaskStatus.IN_PROGRESS,
    TaskStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    TaskStatus.COMPLETED,
    TaskStatus.CANCELLED,
  ],
  CLOSED: [
    TaskStatus.OPEN,
    TaskStatus.CANCELLED,
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTask(oldStatus: TaskStatus, newStatus: TaskStatus): boolean {
  if (oldStatus === newStatus) return false;
  const allowed = ALLOWED_TASK_TRANSITIONS[oldStatus];
  return Boolean(allowed && allowed.includes(newStatus));
}

export function assertValidTaskTransition(
  oldStatus: TaskStatus,
  newStatus: TaskStatus,
  reason?: string | null,
): void {
  if (!canTransitionTask(oldStatus, newStatus)) {
    throw new InvalidTaskTransitionError(
      `Không thể chuyển trạng thái nhiệm vụ từ "${TASK_STATUS_LABELS[oldStatus]}" sang "${TASK_STATUS_LABELS[newStatus]}".`,
    );
  }

  if (newStatus === TaskStatus.CANCELLED && (!reason || reason.trim().length === 0)) {
    throw new InvalidTaskTransitionError("Lý do là bắt buộc khi hủy nhiệm vụ (CANCELLED).");
  }
}

/**
 * Group member business rules validation for Task Application per Sections 5, 6, 7:
 * - 2 to 10 members
 * - At least 1 Student
 * - At least 1 Advisor (GVHD)
 * - Exactly 1 Leader (must be Student, cannot be Advisor)
 * - Leader identity must match the Submitter
 * - No duplicate member by normalized studentCode or email
 */
export function validateTaskApplicationMembers(
  submitter: { fullName: string; studentCode: string; emailNormalized: string },
  members: MemberInputDto[],
): void {
  if (!members || members.length < 2) {
    throw new DomainValidationError("Nhóm đăng ký nhiệm vụ phải có tối thiểu 2 thành viên (ít nhất 1 Sinh viên và 1 GVHD).");
  }

  if (members.length > 10) {
    throw new DomainValidationError("Nhóm đăng ký nhiệm vụ chỉ được phép có tối đa 10 thành viên.");
  }

  const students = members.filter((m) => m.memberType === MemberType.STUDENT);
  const advisors = members.filter((m) => m.memberType === MemberType.ADVISOR);
  const leaders = members.filter((m) => m.isLeader);

  if (students.length < 1) {
    throw new DomainValidationError("Nhóm đăng ký nhiệm vụ bắt buộc phải có ít nhất 1 Sinh viên.");
  }

  if (advisors.length < 1) {
    throw new DomainValidationError("Nhóm đăng ký nhiệm vụ bắt buộc phải có ít nhất 1 Giảng viên hướng dẫn (GVHD).");
  }

  if (leaders.length !== 1) {
    throw new DomainValidationError(
      leaders.length === 0
        ? "Nhóm đăng ký nhiệm vụ bắt buộc phải có đúng 1 Trưởng nhóm / Người đại diện."
        : "Nhóm đăng ký nhiệm vụ không được phép có nhiều hơn 1 Trưởng nhóm / Người đại diện.",
    );
  }

  const leader = leaders[0];
  if (leader.memberType !== MemberType.STUDENT) {
    throw new DomainValidationError("Trưởng nhóm / Người đại diện bắt buộc phải là Sinh viên. GVHD không được làm Trưởng nhóm.");
  }

  // Leader must match original submitter identity
  const normSubmitterCode = submitter.studentCode.trim().toUpperCase();
  const normLeaderCode = (leader.studentCode || "").trim().toUpperCase();
  const normSubmitterEmail = submitter.emailNormalized.trim().toLowerCase();
  const normLeaderEmail = leader.email.trim().toLowerCase();

  if (normLeaderCode !== normSubmitterCode || normLeaderEmail !== normSubmitterEmail) {
    throw new DomainValidationError(
      `Trưởng nhóm đăng ký phải chính là người đứng tên nộp hồ sơ (${submitter.fullName} - MSSV: ${submitter.studentCode}). Không được đổi người đại diện.`,
    );
  }

  // Validate student fields
  for (const sv of students) {
    if (!sv.studentCode || sv.studentCode.trim().length === 0) {
      throw new DomainValidationError(`Sinh viên "${sv.fullName}" chưa có Mã sinh viên.`);
    }
    if (!sv.className || sv.className.trim().length === 0) {
      throw new DomainValidationError(`Sinh viên "${sv.fullName}" chưa có thông tin Lớp.`);
    }
  }

  // Duplicate member validation
  const seenStudentCodes = new Set<string>();
  const seenEmails = new Set<string>();

  for (const m of members) {
    const normEmail = m.email.trim().toLowerCase();
    if (seenEmails.has(normEmail)) {
      throw new DuplicateMemberError(m.email);
    }
    seenEmails.add(normEmail);

    if (m.memberType === MemberType.STUDENT && m.studentCode) {
      const normCode = m.studentCode.trim().toUpperCase();
      if (seenStudentCodes.has(normCode)) {
        throw new DuplicateMemberError(m.studentCode);
      }
      seenStudentCodes.add(normCode);
    }
  }
}
