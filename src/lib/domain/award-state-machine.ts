/**
 * Phase 4 — Awards & Seasons Domain State Machine & Metadata Tokens
 */

export const AwardSeasonStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type AwardSeasonStatus = (typeof AwardSeasonStatus)[keyof typeof AwardSeasonStatus];

export const AwardStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type AwardStatus = (typeof AwardStatus)[keyof typeof AwardStatus];

export const AwardHistoryAction = {
  AWARD_CREATED: "AWARD_CREATED",
  AWARD_UPDATED: "AWARD_UPDATED",
  AWARD_STATUS_CHANGED: "AWARD_STATUS_CHANGED",
  AWARD_PUBLISHED: "AWARD_PUBLISHED",
  AWARD_UNPUBLISHED: "AWARD_UNPUBLISHED",
  AWARD_ARCHIVED: "AWARD_ARCHIVED",
} as const;
export type AwardHistoryAction = (typeof AwardHistoryAction)[keyof typeof AwardHistoryAction];

export class InvalidAwardTransitionError extends Error {
  constructor(public fromStatus: AwardStatus, public toStatus: AwardStatus) {
    super(`Chuyển trạng thái giải thưởng không hợp lệ từ ${fromStatus} sang ${toStatus}.`);
    this.name = "InvalidAwardTransitionError";
  }
}

export class AwardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwardValidationError";
  }
}

export const VALID_AWARD_TRANSITIONS: Record<AwardStatus, AwardStatus[]> = {
  [AwardStatus.DRAFT]: [AwardStatus.PUBLISHED, AwardStatus.ARCHIVED],
  [AwardStatus.PUBLISHED]: [AwardStatus.DRAFT, AwardStatus.ARCHIVED],
  [AwardStatus.ARCHIVED]: [AwardStatus.DRAFT, AwardStatus.PUBLISHED],
};

export function canTransitionAward(from: AwardStatus, to: AwardStatus): boolean {
  if (from === to) return true;
  return VALID_AWARD_TRANSITIONS[from]?.includes(to) ?? false;
}

export const VALID_SEASON_TRANSITIONS: Record<AwardSeasonStatus, AwardSeasonStatus[]> = {
  [AwardSeasonStatus.DRAFT]: [AwardSeasonStatus.PUBLISHED, AwardSeasonStatus.ARCHIVED],
  [AwardSeasonStatus.PUBLISHED]: [AwardSeasonStatus.DRAFT, AwardSeasonStatus.ARCHIVED],
  [AwardSeasonStatus.ARCHIVED]: [AwardSeasonStatus.DRAFT, AwardSeasonStatus.PUBLISHED],
};

export function canTransitionSeason(from: AwardSeasonStatus, to: AwardSeasonStatus): boolean {
  if (from === to) return true;
  return VALID_SEASON_TRANSITIONS[from]?.includes(to) ?? false;
}

export const AWARD_STATUS_LABELS: Record<AwardStatus, string> = {
  [AwardStatus.DRAFT]: "Bản nháp",
  [AwardStatus.PUBLISHED]: "Đã công bố",
  [AwardStatus.ARCHIVED]: "Đã lưu trữ",
};

export const AWARD_STATUS_BADGES: Record<
  AwardStatus,
  { bg: string; color: string; border: string }
> = {
  [AwardStatus.DRAFT]: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#475569",
    border: "rgba(100, 116, 139, 0.3)",
  },
  [AwardStatus.PUBLISHED]: {
    bg: "rgba(22, 163, 74, 0.12)",
    color: "#16a34a",
    border: "rgba(22, 163, 74, 0.3)",
  },
  [AwardStatus.ARCHIVED]: {
    bg: "rgba(220, 38, 38, 0.12)",
    color: "#dc2626",
    border: "rgba(220, 38, 38, 0.3)",
  },
};

export const SEASON_STATUS_LABELS: Record<AwardSeasonStatus, string> = {
  [AwardSeasonStatus.DRAFT]: "Bản nháp",
  [AwardSeasonStatus.PUBLISHED]: "Đã công bố",
  [AwardSeasonStatus.ARCHIVED]: "Đã kết thúc",
};

export const SEASON_STATUS_BADGES: Record<
  AwardSeasonStatus,
  { bg: string; color: string; border: string }
> = {
  [AwardSeasonStatus.DRAFT]: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#475569",
    border: "rgba(100, 116, 139, 0.3)",
  },
  [AwardSeasonStatus.PUBLISHED]: {
    bg: "rgba(37, 99, 235, 0.12)",
    color: "#2563eb",
    border: "rgba(37, 99, 235, 0.3)",
  },
  [AwardSeasonStatus.ARCHIVED]: {
    bg: "rgba(107, 114, 128, 0.12)",
    color: "#4b5563",
    border: "rgba(107, 114, 128, 0.3)",
  },
};
