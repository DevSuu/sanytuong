import {
  PrismaClient,
  IdeaRecruitmentPost,
  IdeaRecruitmentPostStatus,
  RecruitmentApplicationStatus,
  EmailJobType,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  generateOtp,
  hashOtp,
  verifyOtpConstantTime,
  normalizeEmail,
  decryptToken,
} from "@/lib/crypto";
import { authenticateLeaderByLookupToken } from "./profile-service";
import { DomainValidationError } from "./profile-state-machine";
import { enqueueEmailJob } from "@/lib/email/queue";
import { maskEmail } from "@/lib/email/errors";
import {
  RecruitmentPostCreateInput,
  RecruitmentApplicationSubmitInput,
} from "@/lib/validation/recruitment-schema";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ============================================================================
// 1. PUBLIC QUERIES & VIEWS (PII Safe)
// ============================================================================

export interface PublicRecruitmentPostListItem {
  id: string;
  ideaId: string;
  referenceCode: string;
  ideaTitle: string;
  ideaDescription?: string | null;
  field?: string | null;
  currentMembers?: number;
  totalTeamCapacity?: number;
  title: string;
  description: string;
  targetMemberCount: number;
  acceptedCount: number;
  remainingSlots: number;
  requiredSkills: string;
  status: IdeaRecruitmentPostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  leaderName: string;
  leaderClass: string | null;
}

/**
 * Lists published recruitment posts for the public Idea Fair (/hoi-cho-y-tuong).
 * Strictly filters by PUBLISHED status.
 * Never exposes candidate emails, phone numbers, or lookup tokens (PII safe).
 */
export async function getPublicRecruitmentPosts(params?: {
  search?: string;
  skill?: string;
  field?: string;
  sort?: "newest" | "oldest" | "slots" | string;
  limit?: number;
  offset?: number;
  client?: PrismaClient;
}): Promise<{ items: PublicRecruitmentPostListItem[]; total: number }> {
  const db = params?.client || getDb();
  const search = params?.search?.trim();
  const skill = params?.skill?.trim();
  const field = params?.field?.trim();
  const limit = Math.min(params?.limit || 20, 50);
  const offset = params?.offset || 0;

  const andClauses: Record<string, unknown>[] = [
    { status: IdeaRecruitmentPostStatus.PUBLISHED },
  ];

  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { requiredSkills: { contains: search, mode: "insensitive" } },
        { idea: { title: { contains: search, mode: "insensitive" } } },
        { idea: { referenceCode: { contains: search, mode: "insensitive" } } },
        { idea: { field: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (field && field !== "all") {
    andClauses.push({
      idea: { field: { contains: field, mode: "insensitive" } },
    });
  }

  if (skill) {
    const skills = skill.split(",").map((s) => s.trim()).filter(Boolean);
    if (skills.length === 1) {
      andClauses.push({
        requiredSkills: { contains: skills[0], mode: "insensitive" },
      });
    } else if (skills.length > 1) {
      andClauses.push({
        OR: skills.map((s) => ({ requiredSkills: { contains: s, mode: "insensitive" } })),
      });
    }
  }

  const whereClause = {
    AND: andClauses,
  };

  let orderBy: Record<string, "asc" | "desc">[] = [{ createdAt: "desc" }, { id: "desc" }];
  if (params?.sort === "oldest") {
    orderBy = [{ createdAt: "asc" }, { id: "asc" }];
  } else if (params?.sort === "slots") {
    orderBy = [{ targetMemberCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }

  const [posts, total] = await Promise.all([
    db.ideaRecruitmentPost.findMany({
      where: whereClause,
      include: {
        idea: {
          select: {
            id: true,
            title: true,
            description: true,
            referenceCode: true,
            field: true,
            submitter: {
              select: {
                fullName: true,
                className: true,
              },
            },
            projectProfile: {
              select: {
                members: {
                  select: { id: true },
                },
              },
            },
          },
        },
        applications: {
          where: {
            status: RecruitmentApplicationStatus.ACCEPTED,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.ideaRecruitmentPost.count({ where: whereClause }),
  ]);

  const items: PublicRecruitmentPostListItem[] = posts.map((p) => {
    const acceptedCount = p.applications.length;
    const remainingSlots = Math.max(0, p.targetMemberCount - acceptedCount);
    const initialMembers = p.idea.projectProfile?.members?.length || 1;
    const currentMembers = Math.max(initialMembers, 1);
    const totalTeamCapacity = currentMembers + remainingSlots;

    return {
      id: p.id,
      ideaId: p.idea.referenceCode,
      referenceCode: p.idea.referenceCode,
      ideaTitle: p.idea.title,
      ideaDescription: null,
      field: p.idea.field,
      currentMembers,
      totalTeamCapacity,
      title: p.title,
      description: p.description,
      targetMemberCount: p.targetMemberCount,
      acceptedCount,
      remainingSlots,
      requiredSkills: p.requiredSkills,
      status: p.status,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      leaderName: p.idea.submitter.fullName,
      leaderClass: p.idea.submitter.className,
    };
  });

  return { items, total };
}

/**
 * Gets a single published recruitment post for public details and application modal.
 */
export async function getPublicRecruitmentPostById(
  id: string,
  client?: PrismaClient,
): Promise<PublicRecruitmentPostListItem | null> {
  const db = client || getDb();
  const post = await db.ideaRecruitmentPost.findUnique({
    where: { id },
    include: {
      idea: {
        select: {
          id: true,
          title: true,
          description: true,
          referenceCode: true,
          field: true,
          submitter: {
            select: {
              fullName: true,
              className: true,
            },
          },
          projectProfile: {
            select: {
              members: {
                select: { id: true },
              },
            },
          },
        },
      },
      applications: {
        where: {
          status: RecruitmentApplicationStatus.ACCEPTED,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!post || post.status !== IdeaRecruitmentPostStatus.PUBLISHED) {
    return null;
  }

  const acceptedCount = post.applications.length;
  const remainingSlots = Math.max(0, post.targetMemberCount - acceptedCount);
  const initialMembers = post.idea.projectProfile?.members?.length || 1;
  const currentMembers = Math.max(initialMembers, 1);
  const totalTeamCapacity = currentMembers + remainingSlots;

  return {
    id: post.id,
    ideaId: post.idea.referenceCode,
    referenceCode: post.idea.referenceCode,
    ideaTitle: post.idea.title,
    ideaDescription: null,
    field: post.idea.field,
    currentMembers,
    totalTeamCapacity,
    title: post.title,
    description: post.description,
    targetMemberCount: post.targetMemberCount,
    acceptedCount,
    remainingSlots,
    requiredSkills: post.requiredSkills,
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    leaderName: post.idea.submitter.fullName,
    leaderClass: post.idea.submitter.className,
  };
}

// ============================================================================
// 2. LEADER ACTIONS & INVARIANT 1 ENFORCEMENT
// ============================================================================

/**
 * Computes current member count and available recruitment quota for an Idea.
 * Invariant 1: targetMemberCount >= 1 and targetMemberCount <= (10 - currentProfileMemberCount)
 */
export async function getIdeaRecruitmentCapacity(
  ideaId: string,
  client?: PrismaClient | TxClient,
): Promise<{ currentMemberCount: number; maxAllowedRecruits: number }> {
  const db = client || getDb();
  const idea = await db.idea.findUnique({
    where: { id: ideaId },
    include: {
      projectProfile: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!idea) {
    throw new DomainValidationError("Ý tưởng đề tài không tồn tại.");
  }

  // If a project profile exists, count its members. Otherwise, initial count is 1 (the Submitter/Leader).
  const currentMemberCount = idea.projectProfile
    ? Math.max(1, idea.projectProfile.members.length)
    : 1;

  const maxAllowedRecruits = Math.max(0, 10 - currentMemberCount);

  return { currentMemberCount, maxAllowedRecruits };
}

/**
 * Creates or updates a recruitment post for an Idea.
 * Enforces Invariant 1: targetMemberCount >= 1 && <= 10 - currentProfileMemberCount.
 * Enforces Invariant 4: Only the authorized Leader of this Idea can manage this post.
 */
export async function createOrUpdateRecruitmentPost(
  ideaId: string,
  leaderToken: string,
  input: RecruitmentPostCreateInput,
  client?: PrismaClient,
): Promise<IdeaRecruitmentPost> {
  const db = client || getDb();

  // Invariant 4: Authenticate Leader via permanent lookup token
  const authContext = await authenticateLeaderByLookupToken(ideaId, leaderToken, db);

  if (authContext.idea.status !== "APPROVED") {
    throw new DomainValidationError(
      "Chỉ các đề tài đã được Ban tổ chức phê duyệt (APPROVED) mới được phép mở tin tuyển thành viên trên Hội chợ ý tưởng.",
    );
  }

  // Invariant 1: Enforce targetMemberCount quota against current profile members
  const { currentMemberCount, maxAllowedRecruits } = await getIdeaRecruitmentCapacity(
    ideaId,
    db,
  );

  if (maxAllowedRecruits < 1) {
    throw new DomainValidationError(
      `Đề tài hiện đã có ${currentMemberCount} thành viên (đạt giới hạn tối đa 10 người), không thể mở tuyển thêm.`,
    );
  }

  if (input.targetMemberCount < 1 || input.targetMemberCount > maxAllowedRecruits) {
    throw new DomainValidationError(
      `Chỉ tiêu tuyển thành viên không hợp lệ: Nhóm hiện có ${currentMemberCount} thành viên. Số lượng cần tuyển phải từ 1 đến ${maxAllowedRecruits} người (để không vượt quá giới hạn 10 người/nhóm).`,
    );
  }

  const existingPost = await db.ideaRecruitmentPost.findUnique({
    where: { ideaId },
  });

  if (existingPost) {
    return await db.ideaRecruitmentPost.update({
      where: { id: existingPost.id },
      data: {
        title: input.title.trim(),
        description: input.description.trim(),
        targetMemberCount: input.targetMemberCount,
        requiredSkills: input.requiredSkills.trim(),
        // Keep existing status if already set, or default to DRAFT
      },
    });
  }

  return await db.ideaRecruitmentPost.create({
    data: {
      ideaId,
      title: input.title.trim(),
      description: input.description.trim(),
      targetMemberCount: input.targetMemberCount,
      requiredSkills: input.requiredSkills.trim(),
      status: IdeaRecruitmentPostStatus.DRAFT,
    },
  });
}

/**
 * Updates status of a recruitment post (PUBLISHED, PAUSED, CLOSED, DRAFT).
 * Enforces Invariant 1 when transitioning to PUBLISHED: cannot publish if team is already full.
 */
export async function updateRecruitmentPostStatus(
  ideaId: string,
  leaderToken: string,
  newStatus: IdeaRecruitmentPostStatus,
  client?: PrismaClient,
): Promise<IdeaRecruitmentPost> {
  const db = client || getDb();
  await authenticateLeaderByLookupToken(ideaId, leaderToken, db);

  const post = await db.ideaRecruitmentPost.findUnique({
    where: { ideaId },
  });

  if (!post) {
    throw new DomainValidationError("Tin tuyển dụng chưa được tạo. Vui lòng tạo tin tuyển dụng trước.");
  }

  if (newStatus === IdeaRecruitmentPostStatus.PUBLISHED) {
    const { currentMemberCount, maxAllowedRecruits } = await getIdeaRecruitmentCapacity(
      ideaId,
      db,
    );
    if (maxAllowedRecruits < 1) {
      throw new DomainValidationError(
        `Nhóm đã có đủ ${currentMemberCount} thành viên, không thể công khai tuyển thêm.`,
      );
    }
    if (post.targetMemberCount > maxAllowedRecruits) {
      throw new DomainValidationError(
        `Chỉ tiêu của tin tuyển dụng (${post.targetMemberCount}) vượt quá số chỗ trống còn lại (${maxAllowedRecruits}). Vui lòng cập nhật lại chỉ tiêu trước khi đăng tin.`,
      );
    }
  }

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === IdeaRecruitmentPostStatus.PUBLISHED && !post.publishedAt) {
    updateData.publishedAt = new Date();
  }
  if (newStatus === IdeaRecruitmentPostStatus.CLOSED) {
    updateData.closedAt = new Date();
  }

  return await db.ideaRecruitmentPost.update({
    where: { id: post.id },
    data: updateData,
  });
}

/**
 * Leader data view: Returns post details and submitted applications for evaluation.
 * Invariant 4: IDOR Protection – strictly enforces leaderToken owns ideaId.
 * Filters out unverified applications (PENDING_VERIFICATION is never shown to Leader).
 */
export async function getLeaderRecruitmentData(
  ideaId: string,
  leaderToken: string,
  client?: PrismaClient,
) {
  const db = client || getDb();
  const authContext = await authenticateLeaderByLookupToken(ideaId, leaderToken, db);

  const [post, capacity] = await Promise.all([
    db.ideaRecruitmentPost.findUnique({
      where: { ideaId },
      include: {
        applications: {
          where: {
            status: {
              in: [
                RecruitmentApplicationStatus.PENDING,
                RecruitmentApplicationStatus.ACCEPTED,
                RecruitmentApplicationStatus.REJECTED,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getIdeaRecruitmentCapacity(ideaId, db),
  ]);

  return {
    idea: {
      id: authContext.idea.id,
      referenceCode: authContext.idea.referenceCode,
      title: authContext.idea.title,
      status: authContext.idea.status,
    },
    post,
    capacity,
  };
}

// ============================================================================
// 3. CANDIDATE APPLICATION & OTP FLOW (Reusing Task Hall Security Pattern)
// ============================================================================

export interface SubmitApplicationResult {
  applicationId: string;
  maskedEmail: string;
  expiresAt: Date;
}

/**
 * Submits an application to a published recruitment post.
 * Invariant 5: Enforces candidate explicit consent to share data with the Leader.
 * Security: Reuses Task Hall OTP pattern.
 * Starts in PENDING_VERIFICATION.
 */
export async function submitRecruitmentApplication(
  postId: string,
  input: RecruitmentApplicationSubmitInput,
  client?: PrismaClient,
): Promise<SubmitApplicationResult> {
  const db = client || getDb();
  const emailNorm = normalizeEmail(input.email);
  const studentCodeNorm = input.studentCode.trim().toUpperCase();

  // Invariant 5: Consent check
  if (!input.consentAccepted) {
    throw new DomainValidationError(
      "Bạn phải xác nhận đồng ý chia sẻ thông tin ứng tuyển với Trưởng nhóm để phục vụ xét duyệt.",
    );
  }

  const post = await db.ideaRecruitmentPost.findUnique({
    where: { id: postId },
    include: {
      idea: {
        include: {
          projectProfile: {
            include: { members: true },
          },
          submitter: true,
        },
      },
    },
  });

  if (!post || post.status !== IdeaRecruitmentPostStatus.PUBLISHED) {
    throw new DomainValidationError("Tin tuyển dụng không tồn tại hoặc đã đóng tiếp nhận hồ sơ.");
  }

  // Prevent Leader from applying to their own idea
  if (
    post.idea.submitter.studentCode.toUpperCase() === studentCodeNorm ||
    normalizeEmail(post.idea.submitter.email) === emailNorm
  ) {
    throw new DomainValidationError("Bạn là Trưởng nhóm của đề tài này, không thể nộp đơn ứng tuyển.");
  }

  // Check if candidate is already in the project members
  if (post.idea.projectProfile?.members) {
    const alreadyInTeam = post.idea.projectProfile.members.some(
      (m) =>
        (m.studentCode && m.studentCode.toUpperCase() === studentCodeNorm) ||
        normalizeEmail(m.email) === emailNorm,
    );
    if (alreadyInTeam) {
      throw new DomainValidationError("Bạn đã là thành viên trong nhóm nghiên cứu của đề tài này.");
    }
  }

  // Check unique constraints for this post: studentCode and email
  const existingApp = await db.ideaRecruitmentApplication.findFirst({
    where: {
      postId,
      OR: [
        { studentCode: studentCodeNorm },
        { emailNormalized: emailNorm },
      ],
    },
  });

  if (existingApp) {
    if (existingApp.status === RecruitmentApplicationStatus.PENDING_VERIFICATION) {
      // Allow re-verification of existing pending application if unverified, and update its form fields
      const otp = generateOtp(6);
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.ideaRecruitmentApplication.update({
        where: { id: existingApp.id },
        data: {
          fullName: input.fullName.trim(),
          studentCode: studentCodeNorm,
          email: input.email.trim(),
          emailNormalized: emailNorm,
          className: input.className?.trim() || null,
          phone: input.phone?.trim() || null,
          specialty: input.specialty.trim(),
          motivation: input.motivation.trim(),
          contribution: input.contribution.trim(),
        },
      });

      // Invalidate existing verifications
      await db.ideaRecruitmentVerification.updateMany({
        where: { applicationId: existingApp.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await db.ideaRecruitmentVerification.create({
        data: {
          applicationId: existingApp.id,
          email: emailNorm,
          otpHash,
          expiresAt,
          maxAttempts: 5,
          attempts: 0,
        },
      });

      await enqueueEmailJob(db, {
        type: EmailJobType.RECRUITMENT_APPLICATION_OTP,
        recipient: emailNorm,
        payload: {
          candidateName: input.fullName.trim(),
          postTitle: post.title,
          ideaTitle: post.idea.title,
          otp,
          expiresMinutes: 10,
        },
      });

      return {
        applicationId: existingApp.id,
        maskedEmail: maskEmail(emailNorm),
        expiresAt,
      };
    }

    throw new DomainValidationError(
      "Bạn đã nộp hồ sơ ứng tuyển cho đề tài này trước đó. Mỗi sinh viên chỉ được nộp 1 hồ sơ cho mỗi đề tài.",
    );
  }

  // Create new application in PENDING_VERIFICATION
  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const application = await db.ideaRecruitmentApplication.create({
    data: {
      postId,
      fullName: input.fullName.trim(),
      studentCode: studentCodeNorm,
      email: input.email.trim(),
      emailNormalized: emailNorm,
      className: input.className?.trim() || null,
      phone: input.phone?.trim() || null,
      specialty: input.specialty.trim(),
      motivation: input.motivation.trim(),
      contribution: input.contribution.trim(),
      status: RecruitmentApplicationStatus.PENDING_VERIFICATION,
      verifications: {
        create: {
          email: emailNorm,
          otpHash,
          expiresAt,
          maxAttempts: 5,
          attempts: 0,
        },
      },
    },
  });

  // Enqueue OTP email
  await enqueueEmailJob(db, {
    type: EmailJobType.RECRUITMENT_APPLICATION_OTP,
    recipient: emailNorm,
    payload: {
      candidateName: input.fullName.trim(),
      postTitle: post.title,
      ideaTitle: post.idea.title,
      otp,
      expiresMinutes: 10,
    },
  });

  return {
    applicationId: application.id,
    maskedEmail: maskEmail(emailNorm),
    expiresAt,
  };
}

/**
 * Resends OTP for recruitment application.
 * Reuses Task Hall security pattern: 60s cooldown, invalidates old OTP, max 5 attempts.
 */
export async function resendRecruitmentApplicationOtp(
  applicationId: string,
  client?: PrismaClient,
): Promise<{ maskedEmail: string; expiresAt: Date }> {
  const db = client || getDb();

  const app = await db.ideaRecruitmentApplication.findUnique({
    where: { id: applicationId },
    include: {
      post: {
        include: { idea: true },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!app) {
    throw new DomainValidationError("Hồ sơ ứng tuyển không tồn tại.");
  }

  if (app.status !== RecruitmentApplicationStatus.PENDING_VERIFICATION) {
    throw new DomainValidationError("Hồ sơ ứng tuyển này đã được xác thực trước đó.");
  }

  // 60-second resend cooldown check
  const latestVerification = app.verifications[0];
  if (latestVerification) {
    const elapsedMs = Date.now() - new Date(latestVerification.createdAt).getTime();
    if (elapsedMs < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - elapsedMs) / 1000);
      throw new DomainValidationError(
        `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại mã OTP mới.`,
      );
    }
  }

  // Invalidate previous unconsumed verifications
  await db.ideaRecruitmentVerification.updateMany({
    where: { applicationId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.ideaRecruitmentVerification.create({
    data: {
      applicationId,
      email: app.emailNormalized,
      otpHash,
      expiresAt,
      maxAttempts: 5,
      attempts: 0,
    },
  });

  await enqueueEmailJob(db, {
    type: EmailJobType.RECRUITMENT_APPLICATION_OTP,
    recipient: app.emailNormalized,
    payload: {
      candidateName: app.fullName,
      postTitle: app.post.title,
      ideaTitle: app.post.idea.title,
      otp,
      expiresMinutes: 10,
    },
  });

  return {
    maskedEmail: maskEmail(app.emailNormalized),
    expiresAt,
  };
}

/**
 * Verifies OTP for recruitment application.
 * Reuses Task Hall security pattern:
 * - Transactional advisory lock
 * - Constant-time comparison
 * - Transitions to PENDING
 * - Enqueues notice email to Leader
 * - NEVER returns lookup token to candidate.
 */
export async function verifyRecruitmentApplicationOtp(
  applicationId: string,
  inputOtp: string,
  client?: PrismaClient,
): Promise<{ success: boolean; message: string }> {
  const db = client || getDb();

  if (!inputOtp || !/^\d{6}$/.test(inputOtp.trim())) {
    throw new DomainValidationError("Mã xác thực OTP phải gồm đúng 6 chữ số.");
  }

  return await db.$transaction(async (tx) => {
    // 1. Transactional advisory lock on application
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('recruitment-app-verify:' || ${applicationId}))`;

    const app = await tx.ideaRecruitmentApplication.findUnique({
      where: { id: applicationId },
      include: {
        post: {
          include: {
            idea: {
              include: {
                submitter: {
                  include: {
                    lookupCredential: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!app) {
      throw new DomainValidationError("Hồ sơ ứng tuyển không tồn tại.");
    }

    if (app.status === RecruitmentApplicationStatus.PENDING) {
      return { success: true, message: "Hồ sơ đã được xác thực trước đó." };
    }

    if (app.status !== RecruitmentApplicationStatus.PENDING_VERIFICATION) {
      throw new DomainValidationError(
        `Đơn ứng tuyển không ở trạng thái chờ xác thực (trạng thái: "${app.status}").`,
      );
    }

    const verification = await tx.ideaRecruitmentVerification.findFirst({
      where: { applicationId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      throw new DomainValidationError("Không tìm thấy mã OTP hợp lệ. Vui lòng yêu cầu gửi mã mới.");
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new DomainValidationError(
        "Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.",
      );
    }

    if (new Date() > new Date(verification.expiresAt)) {
      throw new DomainValidationError("Mã OTP đã hết hạn (10 phút). Vui lòng yêu cầu gửi lại mã mới.");
    }

    const isValid = verifyOtpConstantTime(inputOtp.trim(), verification.otpHash);
    if (!isValid) {
      const nextAttempts = verification.attempts + 1;
      await getDb().ideaRecruitmentVerification.update({
        where: { id: verification.id },
        data: { attempts: nextAttempts },
      });

      const remaining = Math.max(0, verification.maxAttempts - nextAttempts);
      if (remaining === 0) {
        throw new DomainValidationError(
          "Mã xác thực không chính xác. Đã nhập sai 5 lần, mã bị vô hiệu hóa. Vui lòng yêu cầu gửi mã mới.",
        );
      }
      throw new DomainValidationError(`Mã xác thực không đúng. Bạn còn ${remaining} lần thử.`);
    }

    // Mark verification consumed and invalidate any others
    await tx.ideaRecruitmentVerification.updateMany({
      where: { applicationId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Update status to PENDING
    await tx.ideaRecruitmentApplication.update({
      where: { id: applicationId },
      data: { status: RecruitmentApplicationStatus.PENDING },
    });

    // Enqueue notice email to Leader
    const leader = app.post.idea.submitter;
    const appUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://ttst.i4t.pro.vn";
    let lookupUrl = `${appUrl}/tra-cuu`;
    if (leader.lookupCredential && !leader.lookupCredential.revokedAt) {
      try {
        const rawLeaderToken = decryptToken(leader.lookupCredential.encryptedToken);
        lookupUrl = `${appUrl}/tra-cuu/${rawLeaderToken}`;
      } catch {
        lookupUrl = `${appUrl}/tra-cuu`;
      }
    }

    await enqueueEmailJob(tx, {
      type: EmailJobType.RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE,
      recipient: leader.emailNormalized,
      payload: {
        leaderName: leader.fullName,
        ideaTitle: app.post.idea.title,
        postTitle: app.post.title,
        candidateName: app.fullName,
        candidateStudentCode: app.studentCode,
        candidateSpecialty: app.specialty,
        lookupUrl,
      },
    });

    return {
      success: true,
      message: "Xác thực email thành công! Hồ sơ của bạn đã được chuyển tới Trưởng nhóm để xét duyệt.",
    };
  });
}

// ============================================================================
// 4. LEADER REVIEW ACTIONS & INVARIANTS 2 & 3 ENFORCEMENT
// ============================================================================

export interface ReviewApplicationResult {
  action: "ACCEPT" | "REJECT";
  applicationId: string;
  postStatus: IdeaRecruitmentPostStatus;
  newMemberCount: number;
}

/**
 * Reviews a recruitment application (ACCEPT or REJECT).
 *
 * Enforces Invariant 2:
 * - Accept is ONLY valid when Post = PUBLISHED and Application = PENDING.
 * - All checks are server-side and executed inside the transaction.
 *
 * Enforces Invariant 3:
 * - Two concurrent Accept requests on the same Application MUST ensure ONLY ONE succeeds.
 * - Protected by PostgreSQL transaction advisory locks (app & profile levels).
 *
 * Enforces Invariant 4:
 * - Only the authorized Leader of this specific Idea can review this application.
 */
export async function reviewRecruitmentApplication(
  ideaId: string,
  applicationId: string,
  leaderToken: string,
  action: "ACCEPT" | "REJECT",
  reviewNote?: string | null,
  client?: PrismaClient,
): Promise<ReviewApplicationResult> {
  const db = client || getDb();

  // Invariant 4: Authorization check before entering transaction
  const authContext = await authenticateLeaderByLookupToken(ideaId, leaderToken, db);

  return await db.$transaction(async (tx) => {
    // Invariant 3: Acquire PostgreSQL transactional advisory lock for this application
    // to serialize any concurrent accept/reject requests
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('recruitment_app_accept:' || ${applicationId}))`;

    // Also lock the Idea's project profile to serialize concurrent team additions
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('project_profile_' || ${ideaId}))`;

    // Fetch fresh Application and Post inside locked transaction
    const app = await tx.ideaRecruitmentApplication.findUnique({
      where: { id: applicationId },
      include: {
        post: {
          include: {
            idea: {
              include: {
                projectProfile: {
                  include: {
                    members: true,
                    editRequests: { orderBy: { createdAt: "desc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!app) {
      throw new DomainValidationError("Hồ sơ ứng tuyển không tồn tại.");
    }

    // Invariant 4: Verify application belongs to this Idea's post
    if (app.post.ideaId !== ideaId) {
      throw new DomainValidationError("Hồ sơ ứng tuyển này không thuộc quyền quản lý của đề tài này.");
    }

    const post = app.post;

    // Invariant 2 Check: Application must be in PENDING status
    if (app.status !== RecruitmentApplicationStatus.PENDING) {
      throw new DomainValidationError(
        `Đơn ứng tuyển không ở trạng thái PENDING chờ xét duyệt (trạng thái hiện tại: "${app.status}").`,
      );
    }

    if (action === "REJECT") {
      await tx.ideaRecruitmentApplication.update({
        where: { id: applicationId },
        data: {
          status: RecruitmentApplicationStatus.REJECTED,
          reviewedAt: new Date(),
          reviewNote: reviewNote?.trim() || null,
        },
      });

      // Enqueue rejection notification email
      await enqueueEmailJob(tx, {
        type: EmailJobType.RECRUITMENT_APPLICATION_REJECTED,
        recipient: app.emailNormalized,
        payload: {
          candidateName: app.fullName,
          ideaTitle: post.idea.title,
          postTitle: post.title,
          reviewNote: reviewNote?.trim() || "",
        },
      });

      const currentCount = post.idea.projectProfile
        ? post.idea.projectProfile.members.length
        : 1;

      return {
        action: "REJECT",
        applicationId,
        postStatus: post.status,
        newMemberCount: currentCount,
      };
    }

    // ==========================================
    // ACTION === "ACCEPT"
    // ==========================================

    // Invariant 2 Check: Post MUST be PUBLISHED to accept candidates
    if (post.status !== IdeaRecruitmentPostStatus.PUBLISHED) {
      throw new DomainValidationError(
        `Chỉ có thể tiếp nhận thành viên khi tin tuyển dụng đang ở trạng thái PUBLISHED (trạng thái hiện tại: "${post.status}").`,
      );
    }

    // Ensure ProjectProfile exists and is not locked by Vòng 2 review/completion
    let profile = post.idea.projectProfile;
    if (profile) {
      if (profile.status === "SUBMITTED") {
        throw new DomainValidationError(
          "Hồ sơ đề tài Vòng 2 đang trong quá trình xét duyệt của Ban tổ chức, không thể thêm thành viên mới vào lúc này.",
        );
      }
      if (profile.status === "COMPLETED") {
        const hasApprovedMemberEdit = profile.editRequests?.some(
          (er) =>
            er.status === "APPROVED" &&
            (!profile!.completedAt ||
              new Date(er.createdAt).getTime() >= new Date(profile!.completedAt).getTime()),
        );
        if (!hasApprovedMemberEdit) {
          throw new DomainValidationError(
            "Hồ sơ đề tài Vòng 2 đã được Ban tổ chức phê duyệt hoàn tất. Bạn cần gửi yêu cầu chỉnh sửa hồ sơ trước khi tiếp nhận thêm thành viên.",
          );
        }
      }
    } else {
      // Auto-create initial project profile with Leader as first member
      profile = await tx.projectProfile.create({
        data: {
          ideaId,
          version: 1,
          members: {
            create: {
              isLeader: true,
              memberType: "STUDENT",
              fullName: authContext.submitter.fullName,
              studentCode: authContext.submitter.studentCode,
              className: authContext.submitter.className,
              email: authContext.submitter.emailNormalized,
              orderIndex: 0,
            },
          },
        },
        include: { members: true, editRequests: true },
      });
    }

    // Re-check team capacity (strictly <= 10)
    if (profile.members.length >= 10) {
      throw new DomainValidationError(
        "Nhóm nghiên cứu đã đạt tối đa 10 thành viên. Không thể tiếp nhận thêm ứng viên.",
      );
    }

    // Check duplicate studentCode or email in members
    const isDuplicate = profile.members.some(
      (m) =>
        (m.studentCode && m.studentCode.toUpperCase() === app.studentCode.toUpperCase()) ||
        normalizeEmail(m.email) === app.emailNormalized,
    );
    if (isDuplicate) {
      throw new DomainValidationError(
        `Sinh viên "${app.fullName}" (${app.studentCode}) đã là thành viên trong nhóm nghiên cứu của đề tài.`,
      );
    }

    // Add applicant as ProjectMember
    const nextOrder = profile.members.length;
    await tx.projectMember.create({
      data: {
        profileId: profile.id,
        isLeader: false,
        memberType: "STUDENT",
        fullName: app.fullName,
        studentCode: app.studentCode,
        className: app.className,
        phone: app.phone,
        department: app.specialty,
        email: app.emailNormalized,
        orderIndex: nextOrder,
      },
    });

    // Update application status to ACCEPTED
    await tx.ideaRecruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: RecruitmentApplicationStatus.ACCEPTED,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    const updatedMemberCount = profile.members.length + 1;

    // Check post target quota: count accepted applications
    const acceptedCount = await tx.ideaRecruitmentApplication.count({
      where: {
        postId: post.id,
        status: RecruitmentApplicationStatus.ACCEPTED,
      },
    });

    let currentPostStatus: IdeaRecruitmentPostStatus = post.status;
    // Auto-close post if target quota reached OR max 10 members reached
    if (acceptedCount >= post.targetMemberCount || updatedMemberCount >= 10) {
      await tx.ideaRecruitmentPost.update({
        where: { id: post.id },
        data: {
          status: IdeaRecruitmentPostStatus.CLOSED,
          closedAt: new Date(),
        },
      });
      currentPostStatus = IdeaRecruitmentPostStatus.CLOSED;
    }

    // Enqueue acceptance notification email to candidate
    await enqueueEmailJob(tx, {
      type: EmailJobType.RECRUITMENT_APPLICATION_ACCEPTED,
      recipient: app.emailNormalized,
      payload: {
        candidateName: app.fullName,
        ideaTitle: post.idea.title,
        postTitle: post.title,
        leaderName: authContext.submitter.fullName,
        leaderEmail: authContext.submitter.emailNormalized,
        reviewNote: reviewNote?.trim() || "",
      },
    });

    return {
      action: "ACCEPT",
      applicationId,
      postStatus: currentPostStatus,
      newMemberCount: updatedMemberCount,
    };
  });
}
