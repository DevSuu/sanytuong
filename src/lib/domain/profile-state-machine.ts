export const ProjectProfileStatus = {
  NOT_STARTED: "NOT_STARTED",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  NEEDS_REVISION: "NEEDS_REVISION",
  COMPLETED: "COMPLETED",
} as const;
export type ProjectProfileStatus = (typeof ProjectProfileStatus)[keyof typeof ProjectProfileStatus];

export const MemberType = {
  STUDENT: "STUDENT",
  ADVISOR: "ADVISOR",
} as const;
export type MemberType = (typeof MemberType)[keyof typeof MemberType];

export const EditRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type EditRequestStatus = (typeof EditRequestStatus)[keyof typeof EditRequestStatus];

export const ProfileHistoryAction = {
  PROFILE_CREATED: "PROFILE_CREATED",
  PROFILE_SAVED_DRAFT: "PROFILE_SAVED_DRAFT",
  PROFILE_SUBMITTED: "PROFILE_SUBMITTED",
  PROFILE_NEEDS_REVISION: "PROFILE_NEEDS_REVISION",
  PROFILE_COMPLETED: "PROFILE_COMPLETED",
  PROFILE_EDIT_REQUEST_CREATED: "PROFILE_EDIT_REQUEST_CREATED",
  PROFILE_EDIT_REQUEST_APPROVED: "PROFILE_EDIT_REQUEST_APPROVED",
  PROFILE_EDIT_REQUEST_REJECTED: "PROFILE_EDIT_REQUEST_REJECTED",
  ADMIN_EDITED_PROFILE: "ADMIN_EDITED_PROFILE",
} as const;
export type ProfileHistoryAction = (typeof ProfileHistoryAction)[keyof typeof ProfileHistoryAction];

export const PROFILE_STATUS_LABELS: Record<ProjectProfileStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã gửi",
  NEEDS_REVISION: "Cần bổ sung",
  COMPLETED: "Hoàn tất",
};

export const PROFILE_STATUS_BADGES: Record<
  ProjectProfileStatus,
  { bg: string; color: string; border: string }
> = {
  NOT_STARTED: {
    bg: "rgba(100, 116, 139, 0.1)",
    color: "#64748b",
    border: "rgba(100, 116, 139, 0.25)",
  },
  DRAFT: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "var(--muted)",
    border: "rgba(100, 116, 139, 0.25)",
  },
  SUBMITTED: {
    bg: "rgba(2, 132, 199, 0.12)",
    color: "#0284c7",
    border: "rgba(2, 132, 199, 0.25)",
  },
  NEEDS_REVISION: {
    bg: "rgba(217, 119, 6, 0.12)",
    color: "#d97706",
    border: "rgba(217, 119, 6, 0.25)",
  },
  COMPLETED: {
    bg: "rgba(22, 163, 74, 0.12)",
    color: "#16a34a",
    border: "rgba(22, 163, 74, 0.25)",
  },
};

export const EDIT_REQUEST_STATUS_LABELS: Record<EditRequestStatus, string> = {
  PENDING: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
};

export const EDIT_REQUEST_STATUS_BADGES: Record<
  EditRequestStatus,
  { bg: string; color: string; border: string }
> = {
  PENDING: {
    bg: "rgba(217, 119, 6, 0.12)",
    color: "#d97706",
    border: "rgba(217, 119, 6, 0.25)",
  },
  APPROVED: {
    bg: "rgba(22, 163, 74, 0.12)",
    color: "#16a34a",
    border: "rgba(22, 163, 74, 0.25)",
  },
  REJECTED: {
    bg: "rgba(220, 38, 38, 0.12)",
    color: "#dc2626",
    border: "rgba(220, 38, 38, 0.25)",
  },
};

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export class RepresentativeLimitExceededError extends DomainValidationError {
  constructor(
    studentCode: string,
    currentCount: number,
  ) {
    super(
      `Sinh viên có mã "${studentCode}" đã là Trưởng nhóm/Đại diện của ${currentCount} đề tài (tối đa cho phép: 3 đề tài).`,
    );
    this.name = "RepresentativeLimitExceededError";
  }
}

export class DuplicateMemberError extends DomainValidationError {
  constructor(identifier: string) {
    super(
      `Thành viên có định danh "${identifier}" đã xuất hiện trong danh sách. Không cho phép một người xuất hiện nhiều lần trong cùng một hồ sơ đề tài.`,
    );
    this.name = "DuplicateMemberError";
  }
}

export class ForbiddenEditFieldError extends DomainValidationError {
  constructor(fieldName: string, allowedFields: string[]) {
    super(
      `Trường "${fieldName}" không nằm trong danh sách được phép chỉnh sửa sau khi hồ sơ đã hoàn tất. Các trường được phép: [${allowedFields.join(", ")}].`,
    );
    this.name = "ForbiddenEditFieldError";
  }
}

export interface MemberInputDto {
  id?: string;
  memberType: MemberType;
  isLeader: boolean;
  fullName: string;
  email: string;
  studentCode?: string | null;
  className?: string | null;
  phone?: string | null;
  department?: string | null;
  orderIndex?: number;
}

/**
 * Validates business rules for full Project Profile submission:
 * - 2 to 10 members
 * - At least 1 Student
 * - At least 1 Advisor (GVHD)
 * - Exactly 1 Leader
 * - Leader must be Student
 * - Leader's identity must match original Submitter
 * - No duplicate member within the same profile
 */
export function validateProfileBusinessRules(
  submitter: { fullName: string; studentCode: string; emailNormalized: string },
  members: MemberInputDto[],
): void {
  if (!members || members.length < 2) {
    throw new DomainValidationError("Hồ sơ đề tài phải có tối thiểu 2 thành viên (ít nhất 1 Sinh viên và 1 GVHD).");
  }

  if (members.length > 10) {
    throw new DomainValidationError("Hồ sơ đề tài chỉ được phép có tối đa 10 thành viên.");
  }

  const students = members.filter((m) => m.memberType === MemberType.STUDENT);
  const advisors = members.filter((m) => m.memberType === MemberType.ADVISOR);
  const leaders = members.filter((m) => m.isLeader);

  if (students.length < 1) {
    throw new DomainValidationError("Hồ sơ đề tài bắt buộc phải có ít nhất 1 Sinh viên.");
  }

  if (advisors.length < 1) {
    throw new DomainValidationError("Hồ sơ đề tài bắt buộc phải có ít nhất 1 Giảng viên hướng dẫn (GVHD).");
  }

  if (leaders.length !== 1) {
    throw new DomainValidationError(
      leaders.length === 0
        ? "Hồ sơ đề tài bắt buộc phải có đúng 1 Trưởng nhóm / Đại diện."
        : "Hồ sơ đề tài không được phép có nhiều hơn 1 Trưởng nhóm / Đại diện.",
    );
  }

  const leader = leaders[0];
  if (leader.memberType !== MemberType.STUDENT) {
    throw new DomainValidationError("Trưởng nhóm / Đại diện bắt buộc phải là Sinh viên. GVHD không được làm Trưởng nhóm.");
  }

  // Leader must match original submitter identity
  const normSubmitterCode = submitter.studentCode.trim().toUpperCase();
  const normLeaderCode = (leader.studentCode || "").trim().toUpperCase();
  const normSubmitterEmail = submitter.emailNormalized.trim().toLowerCase();
  const normLeaderEmail = leader.email.trim().toLowerCase();

  if (normLeaderCode !== normSubmitterCode || normLeaderEmail !== normSubmitterEmail) {
    throw new DomainValidationError(
      `Trưởng nhóm của đề tài phải chính là người đã nộp ý tưởng ban đầu (${submitter.fullName} - MSSV: ${submitter.studentCode}). Không được thay đổi người đại diện.`,
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
