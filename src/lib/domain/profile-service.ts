import {
  PrismaClient,
  ProjectProfile,
  ProjectMember,
  ProfileEditRequest,
  ProfileHistory,
} from "@/generated/prisma/client";
import { hashToken } from "@/lib/crypto";
import {
  DomainValidationError,
  RepresentativeLimitExceededError,
  ForbiddenEditFieldError,
  MemberInputDto,
} from "./profile-state-machine";

export type LeaderAuthProfile = ProjectProfile & {
  members: ProjectMember[];
  editRequests: ProfileEditRequest[];
  history: ProfileHistory[];
};

export interface LeaderAuthContext {
  idea: {
    id: string;
    referenceCode: string;
    title: string;
    status: string;
    submitterId: string;
  };
  submitter: {
    id: string;
    fullName: string;
    studentCode: string;
    className: string | null;
    email: string;
    emailNormalized: string;
  };
  profile: LeaderAuthProfile | null;
}

/**
 * Authenticates that the request bearer possesses a valid permanent lookup token
 * matching the Submitter of the target Idea.
 */
export async function authenticateLeaderByLookupToken(
  ideaId: string,
  token: string,
  db: PrismaClient,
): Promise<LeaderAuthContext> {
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

  // Find Idea and verify it belongs to this Submitter
  const idea = await db.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      referenceCode: true,
      title: true,
      status: true,
      submitterId: true,
      projectProfile: {
        include: {
          members: {
            orderBy: { orderIndex: "asc" },
          },
          editRequests: {
            orderBy: { createdAt: "desc" },
          },
          history: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!idea) {
    throw new DomainValidationError("Ý tưởng đề tài không tồn tại.");
  }

  if (idea.submitterId !== credential.submitter.id) {
    throw new DomainValidationError("Bạn không có quyền quản lý hồ sơ đề tài này (Chỉ dành cho Trưởng nhóm / Submitter).");
  }

  return {
    idea: {
      id: idea.id,
      referenceCode: idea.referenceCode,
      title: idea.title,
      status: idea.status,
      submitterId: idea.submitterId,
    },
    submitter: credential.submitter,
    profile: idea.projectProfile,
  };
}

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Enforces the strict rule that a student cannot be leader of more than 3 ideas.
 * Uses PostgreSQL advisory xact lock to serialize concurrent submission attempts
 * for the same student code across concurrent transactions.
 */
export async function checkAndLockRepresentativeLimit(
  tx: TxClient,
  studentCode: string,
  currentIdeaId: string,
): Promise<void> {
  const normCode = studentCode.trim().toUpperCase();

  // Acquire PostgreSQL transaction-scoped advisory lock for this student code
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leader-rep-limit:' || ${normCode}))`;

  // Query distinct ideas where this student is Leader (excluding current idea)
  const existingLeaderMembers = await tx.projectMember.findMany({
    where: {
      isLeader: true,
      studentCode: { equals: studentCode.trim(), mode: "insensitive" },
      profile: {
        ideaId: { not: currentIdeaId },
      },
    },
    select: {
      profile: {
        select: {
          ideaId: true,
        },
      },
    },
  });

  const distinctIdeas = new Set(
    existingLeaderMembers.map((m: { profile: { ideaId: string } }) => m.profile.ideaId),
  );

  if (distinctIdeas.size >= 3) {
    throw new RepresentativeLimitExceededError(studentCode, distinctIdeas.size);
  }
}

export interface StructuredFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  memberIdentifier?: string;
}

/**
 * Computes structured changes between previous members and updated members
 * for detailed Admin audit logging and allowed fields enforcement.
 */
export function computeMemberChangeSet(
  oldMembers: Record<string, unknown>[],
  newMembers: MemberInputDto[],
): StructuredFieldChange[] {
  const changes: StructuredFieldChange[] = [];
  const matchedOldMembers = new Set<Record<string, unknown>>();

  for (let i = 0; i < newMembers.length; i++) {
    const next = newMembers[i];
    let prev: Record<string, unknown> | undefined;

    if (next.id) {
      prev = oldMembers.find((m) => !matchedOldMembers.has(m) && m.id === next.id);
    }
    if (!prev && next.studentCode && next.memberType === "STUDENT") {
      const norm = next.studentCode.trim().toUpperCase();
      prev = oldMembers.find(
        (m) =>
          !matchedOldMembers.has(m) &&
          typeof m.studentCode === "string" &&
          m.studentCode.trim().toUpperCase() === norm,
      );
    }
    if (!prev && next.email) {
      const norm = next.email.trim().toLowerCase();
      prev = oldMembers.find(
        (m) =>
          !matchedOldMembers.has(m) &&
          typeof m.email === "string" &&
          m.email.trim().toLowerCase() === norm,
      );
    }

    // Positional fallback: if member count is identical and slot at index i exists
    if (
      !prev &&
      oldMembers.length === newMembers.length &&
      oldMembers[i] &&
      !matchedOldMembers.has(oldMembers[i])
    ) {
      prev = oldMembers[i];
    }

    if (!prev) {
      changes.push({
        field: `Member #${i + 1}`,
        oldValue: null,
        newValue: `${next.fullName} (${next.memberType})`,
        memberIdentifier: next.studentCode || next.email,
      });
      continue;
    }

    matchedOldMembers.add(prev);

    const normalizeStr = (val: unknown): string | null => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      return s.length > 0 ? s : null;
    };

    // Check individual fields
    if (normalizeStr(prev.fullName) !== normalizeStr(next.fullName)) {
      changes.push({
        field: `Member #${i + 1} -> fullName`,
        oldValue: prev.fullName ?? null,
        newValue: next.fullName ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (normalizeStr(prev.studentCode) !== normalizeStr(next.studentCode)) {
      changes.push({
        field: `Member #${i + 1} -> studentCode`,
        oldValue: prev.studentCode ?? null,
        newValue: next.studentCode ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (normalizeStr(prev.className) !== normalizeStr(next.className)) {
      changes.push({
        field: `Member #${i + 1} -> className`,
        oldValue: prev.className ?? null,
        newValue: next.className ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (normalizeStr(prev.email) !== normalizeStr(next.email)) {
      changes.push({
        field: `Member #${i + 1} -> email`,
        oldValue: prev.email ?? null,
        newValue: next.email ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (normalizeStr(prev.phone) !== normalizeStr(next.phone)) {
      changes.push({
        field: `Member #${i + 1} -> phone`,
        oldValue: prev.phone ?? null,
        newValue: next.phone ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (normalizeStr(prev.department) !== normalizeStr(next.department)) {
      changes.push({
        field: `Member #${i + 1} -> department`,
        oldValue: prev.department ?? null,
        newValue: next.department ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (prev.memberType !== next.memberType) {
      changes.push({
        field: `Member #${i + 1} -> memberType`,
        oldValue: prev.memberType ?? null,
        newValue: next.memberType ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }

    if (Boolean(prev.isLeader) !== Boolean(next.isLeader)) {
      changes.push({
        field: `Member #${i + 1} -> isLeader`,
        oldValue: prev.isLeader ?? null,
        newValue: next.isLeader ?? null,
        memberIdentifier: next.studentCode || next.email,
      });
    }
  }

  // Check removed members
  for (const prev of oldMembers) {
    if (!matchedOldMembers.has(prev)) {
      changes.push({
        field: `Removed Member`,
        oldValue: `${prev.fullName} (${prev.memberType})`,
        newValue: null,
        memberIdentifier: (prev.studentCode as string) || (prev.email as string),
      });
    }
  }

  // Check total member count changes
  if (oldMembers.length !== newMembers.length) {
    changes.push({
      field: `memberCount`,
      oldValue: oldMembers.length,
      newValue: newMembers.length,
      memberIdentifier: `count: ${oldMembers.length} -> ${newMembers.length}`,
    });
  }

  return changes;
}

const FIELD_ALIAS_MAP: Record<string, string[]> = {
  title: ["title", "tên đề tài", "tên ý tưởng", "ten de tai", "ten y tuong", "đề tài"],
  phone: ["phone", "số điện thoại", "sđt", "điện thoại", "so dien thoai"],
  classname: ["classname", "class", "lớp", "lop", "lớp thành viên"],
  studentcode: ["studentcode", "mssv", "mã sinh viên", "mã sv", "ma sinh vien"],
  fullname: ["fullname", "name", "họ tên", "họ và tên", "ho ten"],
  email: ["email", "email thành viên"],
  department: ["department", "khoa", "đơn vị", "thông tin gvhd", "gvhd"],
  membertype: ["membertype", "loại thành viên", "vai trò", "vai trò thành viên"],
  membercount: ["membercount", "số lượng thành viên", "danh sách thành viên"],
};

/**
 * Enforces that allowedFields approved by Admin must be a strict subset of requestedFields
 * submitted by the Leader (allowedFields ⊆ requestedFields).
 */
export function validateAllowedSubsetOfRequested(
  allowedFields: string[],
  requestedFields: string[],
): string[] {
  if (!allowedFields || allowedFields.length === 0) {
    return requestedFields;
  }

  const requestedNormalized = new Map<string, string>();
  for (const rf of requestedFields) {
    requestedNormalized.set(rf.trim().toLowerCase(), rf);
  }

  const invalidFields: string[] = [];
  const resolved: string[] = [];

  for (const af of allowedFields) {
    const key = af.trim().toLowerCase();
    if (!requestedNormalized.has(key)) {
      invalidFields.push(af);
    } else {
      resolved.push(requestedNormalized.get(key)!);
    }
  }

  if (invalidFields.length > 0) {
    throw new DomainValidationError(
      `Các trường được phép sửa (${invalidFields.join(", ")}) không nằm trong danh sách các trường trưởng nhóm đã yêu cầu (${requestedFields.join(", ")}). allowedFields phải là tập con của requestedFields (allowedFields ⊆ requestedFields).`,
    );
  }

  return resolved;
}

/**
 * Verifies that when a Leader edits a completed profile after an Edit Request is approved,
 * ONLY the fields approved by Admin were modified.
 */
export function validateAllowedFieldsEnforcement(
  oldMembers: Record<string, unknown>[],
  newMembers: MemberInputDto[],
  allowedFields: string[],
  oldTitle?: string,
  newTitle?: string,
): void {
  const changes = computeMemberChangeSet(oldMembers, newMembers);

  if (
    oldTitle !== undefined &&
    newTitle !== undefined &&
    oldTitle.trim() !== newTitle.trim()
  ) {
    changes.push({
      field: "title",
      oldValue: oldTitle.trim(),
      newValue: newTitle.trim(),
    });
  }

  if (changes.length === 0) {
    return; // No changes made
  }

  // Strict rule: Changing leader is never supported in Phase 2C
  const hasLeaderChange = changes.some((c) =>
    c.field.toLowerCase().includes("isleader"),
  );
  if (hasLeaderChange) {
    throw new DomainValidationError(
      "Quy chế cuộc thi hiện tại không cho phép thay đổi Trưởng nhóm / Người đại diện.",
    );
  }

  const normalizedAllowed = allowedFields.map((f) => f.trim().toLowerCase());

  for (const change of changes) {
    const normField = change.field.toLowerCase();
    const propPart = normField.includes("->")
      ? normField.split("->")[1].trim().toLowerCase()
      : normField;

    const isPermitted = normalizedAllowed.some((allowed) => {
      // 1. Wildcard or general member list permission
      if (
        allowed === "all" ||
        allowed === "*" ||
        allowed === "danh sách thành viên" ||
        allowed === "thành viên" ||
        allowed === "members" ||
        allowed === "member"
      ) {
        return true;
      }

      // 2. Direct match with property
      if (propPart === allowed) {
        return true;
      }

      // 3. Exact alias dictionary check
      const aliases = FIELD_ALIAS_MAP[propPart];
      if (aliases && aliases.some((alias) => alias === allowed)) {
        return true;
      }

      return false;
    });

    if (!isPermitted) {
      throw new ForbiddenEditFieldError(change.field, allowedFields);
    }
  }
}
