/**
 * Phase 4 — Awards & Seasons Domain Service Layer
 */

import { PrismaClient } from "@/generated/prisma/client";
import {
  AwardStatus,
  AwardSeasonStatus,
  AwardHistoryAction,
  canTransitionAward,
  InvalidAwardTransitionError,
  AwardValidationError,
} from "./award-state-machine";
import { slugify } from "./task-service";

export interface CreateAwardInput {
  seasonId: string;
  title: string;
  slug?: string | null;
  awardName: string;
  category?: string | null;
  organization?: string | null;
  shortDescription?: string | null;
  description: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  displayOrder?: number;
  status?: AwardStatus;
  isDemo?: boolean;
  members?: Array<{
    fullName: string;
    studentCode?: string | null;
    className?: string | null;
    role?: string | null;
    department?: string | null;
    displayOrder?: number;
    isDemo?: boolean;
  }>;
}

export interface UpdateAwardInput {
  seasonId?: string;
  title?: string;
  slug?: string;
  awardName?: string;
  category?: string | null;
  organization?: string | null;
  shortDescription?: string | null;
  description?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  displayOrder?: number;
  status?: AwardStatus;
  isDemo?: boolean;
  members?: Array<{
    id?: string;
    fullName: string;
    studentCode?: string | null;
    className?: string | null;
    role?: string | null;
    department?: string | null;
    displayOrder?: number;
    isDemo?: boolean;
  }>;
}

/**
 * Generate a unique slug for Award, ensuring no collision.
 */
export async function generateUniqueAwardSlug(
  baseTitle: string,
  currentId?: string,
  db?: PrismaClient,
): Promise<string> {
  const baseSlug = slugify(baseTitle) || "giai-thuong";
  let candidate = baseSlug;
  let counter = 1;

  if (!db) return candidate;

  while (true) {
    const existing = await db.award.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || (currentId && existing.id === currentId)) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Generate a unique slug for Season
 */
export async function generateUniqueSeasonSlug(
  baseName: string,
  currentId?: string,
  db?: PrismaClient,
): Promise<string> {
  const baseSlug = slugify(baseName) || "season";
  let candidate = baseSlug;
  let counter = 1;

  if (!db) return candidate;

  while (true) {
    const existing = await db.awardSeason.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || (currentId && existing.id === currentId)) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Creates an Award with transactional audit record and member creation.
 */
export async function createAwardRecord(
  input: CreateAwardInput,
  actorId: string,
  db: PrismaClient,
) {
  // 1. Verify Season exists
  const season = await db.awardSeason.findUnique({
    where: { id: input.seasonId },
  });
  if (!season) {
    throw new AwardValidationError("Mùa giải (Season) không tồn tại.");
  }

  // 2. Rule 15: Cannot publish award if season is not PUBLISHED
  const initialStatus = input.status || AwardStatus.DRAFT;
  if (initialStatus === AwardStatus.PUBLISHED && season.status !== AwardSeasonStatus.PUBLISHED) {
    throw new AwardValidationError(
      "Không thể công bố (PUBLISH) giải thưởng khi Mùa giải chưa ở trạng thái Đã công bố (PUBLISHED)."
    );
  }

  // 3. Resolve slug
  const slug = input.slug?.trim()
    ? slugify(input.slug.trim())
    : await generateUniqueAwardSlug(input.title, undefined, db);

  // Check unique slug
  const existingSlug = await db.award.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new AwardValidationError(`Đường dẫn slug "${slug}" đã tồn tại. Vui lòng chọn slug khác.`);
  }

  return await db.$transaction(async (tx) => {
    const award = await tx.award.create({
      data: {
        seasonId: input.seasonId,
        title: input.title.trim(),
        slug,
        awardName: input.awardName.trim(),
        category: input.category?.trim() || null,
        organization: input.organization?.trim() || null,
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description.trim(),
        imageUrl: input.imageUrl?.trim() || null,
        videoUrl: input.videoUrl?.trim() || null,
        displayOrder: input.displayOrder ?? 0,
        status: initialStatus,
        isDemo: input.isDemo ?? false,
        members: {
          create: (input.members || []).map((m, idx) => ({
            fullName: m.fullName.trim(),
            studentCode: m.studentCode?.trim().toUpperCase() || null,
            className: m.className?.trim() || null,
            role: m.role?.trim() || null,
            department: m.department?.trim() || null,
            displayOrder: m.displayOrder ?? idx,
            isDemo: m.isDemo ?? input.isDemo ?? false,
          })),
        },
      },
      include: {
        members: true,
        season: true,
      },
    });

    // Audit creation
    await tx.awardHistory.create({
      data: {
        awardId: award.id,
        actorId,
        actorRole: "ADMIN",
        action: AwardHistoryAction.AWARD_CREATED,
        reason: "Tạo mới bản ghi giải thưởng.",
        metadata: {
          title: award.title,
          status: award.status,
          awardName: award.awardName,
        },
      },
    });

    return award;
  });
}

/**
 * Updates an Award and records history
 */
export async function updateAwardRecord(
  id: string,
  input: UpdateAwardInput,
  actorId: string,
  db: PrismaClient,
) {
  const currentAward = await db.award.findUnique({
    where: { id },
    include: { season: true },
  });
  if (!currentAward) {
    throw new AwardValidationError("Giải thưởng không tồn tại.");
  }

  const targetSeasonId = input.seasonId || currentAward.seasonId;
  const targetSeason = await db.awardSeason.findUnique({
    where: { id: targetSeasonId },
  });
  if (!targetSeason) {
    throw new AwardValidationError("Mùa giải không tồn tại.");
  }

  const targetStatus = input.status || currentAward.status;
  if (targetStatus === AwardStatus.PUBLISHED && targetSeason.status !== AwardSeasonStatus.PUBLISHED) {
    throw new AwardValidationError(
      "Không thể công bố (PUBLISH) giải thưởng khi Mùa giải chưa ở trạng thái Đã công bố (PUBLISHED)."
    );
  }

  // Slug check
  let finalSlug = currentAward.slug;
  if (input.slug && input.slug.trim() !== currentAward.slug) {
    finalSlug = slugify(input.slug.trim());
    const existing = await db.award.findUnique({ where: { slug: finalSlug } });
    if (existing && existing.id !== id) {
      throw new AwardValidationError(`Đường dẫn slug "${finalSlug}" đã được sử dụng.`);
    }
  }

  return await db.$transaction(async (tx) => {
    // If members provided, replace members
    if (input.members !== undefined) {
      await tx.awardMember.deleteMany({ where: { awardId: id } });
    }

    const updatedAward = await tx.award.update({
      where: { id },
      data: {
        seasonId: targetSeasonId,
        title: input.title !== undefined ? input.title.trim() : undefined,
        slug: finalSlug,
        awardName: input.awardName !== undefined ? input.awardName.trim() : undefined,
        category: input.category !== undefined ? input.category?.trim() || null : undefined,
        organization: input.organization !== undefined ? input.organization?.trim() || null : undefined,
        shortDescription: input.shortDescription !== undefined ? input.shortDescription?.trim() || null : undefined,
        description: input.description !== undefined ? input.description.trim() : undefined,
        imageUrl: input.imageUrl !== undefined ? input.imageUrl?.trim() || null : undefined,
        videoUrl: input.videoUrl !== undefined ? input.videoUrl?.trim() || null : undefined,
        displayOrder: input.displayOrder !== undefined ? input.displayOrder : undefined,
        status: input.status !== undefined ? input.status : undefined,
        isDemo: input.isDemo !== undefined ? input.isDemo : undefined,
        members: input.members
          ? {
              create: input.members.map((m, idx) => ({
                fullName: m.fullName.trim(),
                studentCode: m.studentCode?.trim().toUpperCase() || null,
                className: m.className?.trim() || null,
                role: m.role?.trim() || null,
                department: m.department?.trim() || null,
                displayOrder: m.displayOrder ?? idx,
                isDemo: m.isDemo ?? currentAward.isDemo,
              })),
            }
          : undefined,
      },
      include: {
        members: true,
        season: true,
      },
    });

    await tx.awardHistory.create({
      data: {
        awardId: id,
        actorId,
        actorRole: "ADMIN",
        action: AwardHistoryAction.AWARD_UPDATED,
        reason: "Cập nhật thông tin giải thưởng.",
        metadata: {
          previousStatus: currentAward.status,
          newStatus: updatedAward.status,
        },
      },
    });

    return updatedAward;
  });
}

/**
 * Transitions Award status with validation and audit
 */
export async function transitionAwardStatus(
  id: string,
  toStatus: AwardStatus,
  reason: string | null | undefined,
  actorId: string,
  db: PrismaClient,
) {
  const award = await db.award.findUnique({
    where: { id },
    include: { season: true },
  });
  if (!award) {
    throw new AwardValidationError("Giải thưởng không tồn tại.");
  }

  if (!canTransitionAward(award.status, toStatus)) {
    throw new InvalidAwardTransitionError(award.status, toStatus);
  }

  // Rule 15: Cannot publish award if season is not PUBLISHED
  if (toStatus === AwardStatus.PUBLISHED && award.season.status !== AwardSeasonStatus.PUBLISHED) {
    throw new AwardValidationError(
      "Không thể công bố (PUBLISH) giải thưởng khi Mùa giải (Season) chưa ở trạng thái PUBLISHED."
    );
  }

  let action: AwardHistoryAction = AwardHistoryAction.AWARD_STATUS_CHANGED;
  if (toStatus === AwardStatus.PUBLISHED) action = AwardHistoryAction.AWARD_PUBLISHED;
  else if (award.status === AwardStatus.PUBLISHED && toStatus === AwardStatus.DRAFT) action = AwardHistoryAction.AWARD_UNPUBLISHED;
  else if (toStatus === AwardStatus.ARCHIVED) action = AwardHistoryAction.AWARD_ARCHIVED;

  return await db.$transaction(async (tx) => {
    const updated = await tx.award.update({
      where: { id },
      data: { status: toStatus },
      include: { season: true, members: true },
    });

    await tx.awardHistory.create({
      data: {
        awardId: id,
        actorId,
        actorRole: "ADMIN",
        action,
        reason: reason?.trim() || `Chuyển trạng thái sang ${toStatus}`,
        metadata: {
          fromStatus: award.status,
          toStatus,
        },
      },
    });

    return updated;
  });
}
