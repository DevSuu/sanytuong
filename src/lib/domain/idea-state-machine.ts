export const IdeaStatus = {
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  NEEDS_REVISION: "NEEDS_REVISION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type IdeaStatus = (typeof IdeaStatus)[keyof typeof IdeaStatus];

/**
 * Valid state transitions for the Idea domain.
 */
const ALLOWED_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  PENDING_VERIFICATION: [IdeaStatus.SUBMITTED],
  SUBMITTED: [IdeaStatus.UNDER_REVIEW],
  UNDER_REVIEW: [
    IdeaStatus.APPROVED,
    IdeaStatus.REJECTED,
    IdeaStatus.NEEDS_REVISION,
  ],
  NEEDS_REVISION: [IdeaStatus.SUBMITTED, IdeaStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

/**
 * Checks if a transition from oldStatus to newStatus is allowed.
 */
export function canTransition(oldStatus: IdeaStatus, newStatus: IdeaStatus): boolean {
  if (oldStatus === newStatus) return false;
  const allowed = ALLOWED_TRANSITIONS[oldStatus];
  return Boolean(allowed && allowed.includes(newStatus));
}

/**
 * Determines whether a transition requires a non-empty reason.
 * Rejection and revision requests strictly require explanation.
 */
export function requiresReason(newStatus: IdeaStatus): boolean {
  return (
    newStatus === IdeaStatus.REJECTED || newStatus === IdeaStatus.NEEDS_REVISION
  );
}

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateTransitionError";
  }
}

export class ConcurrencyConflictError extends Error {
  constructor(
    message = "Dữ liệu ý tưởng đã bị thay đổi bởi một phiên khác. Vui lòng tải lại trang.",
  ) {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

/**
 * Validates transition rules and throws an explicit domain error if invalid.
 */
export function assertValidTransition(
  oldStatus: IdeaStatus,
  newStatus: IdeaStatus,
  reason?: string | null,
): void {
  if (!canTransition(oldStatus, newStatus)) {
    throw new InvalidStateTransitionError(
      `Không thể chuyển trạng thái từ "${STATUS_LABELS[oldStatus]}" sang "${STATUS_LABELS[newStatus]}".`,
    );
  }

  if (requiresReason(newStatus)) {
    const trimmed = (reason ?? "").trim();
    if (trimmed.length === 0) {
      throw new InvalidStateTransitionError(
        `Bắt buộc phải nhập lý do khi chuyển trạng thái sang "${STATUS_LABELS[newStatus]}".`,
      );
    }
    if (trimmed.length > 2000) {
      throw new InvalidStateTransitionError(
        "Lý do xử lý không được vượt quá 2000 ký tự.",
      );
    }
  }
}

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  PENDING_VERIFICATION: "Chờ xác minh email",
  SUBMITTED: "Đã gửi",
  UNDER_REVIEW: "Đang xét duyệt",
  NEEDS_REVISION: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
};

export const STATUS_BADGE_VARIANTS: Record<
  IdeaStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  PENDING_VERIFICATION: {
    label: "Chờ xác minh",
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748b",
    border: "rgba(100, 116, 139, 0.3)",
  },
  SUBMITTED: {
    label: "Đã gửi",
    bg: "rgba(2, 132, 199, 0.12)",
    color: "#0284c7",
    border: "rgba(2, 132, 199, 0.3)",
  },
  UNDER_REVIEW: {
    label: "Đang xét duyệt",
    bg: "rgba(234, 88, 12, 0.12)",
    color: "#ea580c",
    border: "rgba(234, 88, 12, 0.3)",
  },
  NEEDS_REVISION: {
    label: "Cần chỉnh sửa",
    bg: "rgba(217, 119, 6, 0.12)",
    color: "#d97706",
    border: "rgba(217, 119, 6, 0.3)",
  },
  APPROVED: {
    label: "Đã duyệt",
    bg: "rgba(22, 163, 74, 0.12)",
    color: "#16a34a",
    border: "rgba(22, 163, 74, 0.3)",
  },
  REJECTED: {
    label: "Đã từ chối",
    bg: "rgba(220, 38, 38, 0.12)",
    color: "#dc2626",
    border: "rgba(220, 38, 38, 0.3)",
  },
};
