import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  authenticateLeaderByLookupToken,
  validateAllowedFieldsEnforcement,
} from "@/lib/domain/profile-service";
import { profileDraftSaveSchema } from "@/lib/validation/profile-schema";
import {
  ProjectProfileStatus,
  ProfileHistoryAction,
} from "@/lib/domain/profile-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();

    const authHeader = req.headers.get("authorization");
    const tokenHeader = req.headers.get("x-lookup-token");
    const token =
      tokenHeader ||
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
      body.lookupToken;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) để lưu bản nháp." },
        { status: 401 },
      );
    }

    const db = getDb();
    const authContext = await authenticateLeaderByLookupToken(ideaId, token, db);

    // Business rule: Only APPROVED idea can create / edit Project Profile
    if (authContext.idea.status !== "APPROVED") {
      return NextResponse.json(
        { ok: false, error: "Chỉ ý tưởng đã được Ban tổ chức phê duyệt (APPROVED) mới được phép tạo hồ sơ đề tài." },
        { status: 400 },
      );
    }

    // Parse and validate draft inputs
    const parsed = profileDraftSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu bản nháp không hợp lệ." },
        { status: 400 },
      );
    }

    const { title, members } = parsed.data;
    const nextTitle =
      title && title.trim().length >= 5
        ? title.trim()
        : authContext.idea.title.trim();

    // Check current status
    const currentProfile = authContext.profile;
    if (
      currentProfile &&
      currentProfile.status === ProjectProfileStatus.SUBMITTED
    ) {
      return NextResponse.json(
        { ok: false, error: "Hồ sơ đang trong quá trình xét duyệt, không thể chỉnh sửa bản nháp." },
        { status: 400 },
      );
    }

    if (
      currentProfile &&
      currentProfile.status === ProjectProfileStatus.COMPLETED
    ) {
      const approvedEditRequest = currentProfile.editRequests?.find(
        (er) =>
          er.status === "APPROVED" &&
          (!currentProfile.completedAt ||
            new Date(er.createdAt).getTime() >= new Date(currentProfile.completedAt).getTime()),
      );
      if (!approvedEditRequest) {
        return NextResponse.json(
          { ok: false, error: "Hồ sơ đã hoàn tất. Bạn cần gửi yêu cầu chỉnh sửa để được Ban tổ chức phê duyệt trước." },
          { status: 400 },
        );
      }

      const allowedFields =
        approvedEditRequest.allowedFields && approvedEditRequest.allowedFields.length > 0
          ? approvedEditRequest.allowedFields
          : approvedEditRequest.requestedFields;

      validateAllowedFieldsEnforcement(
        (currentProfile as { members: Record<string, unknown>[] }).members,
        members,
        allowedFields,
        authContext.idea.title,
        nextTitle,
      );
    }

    // Execute atomic transaction to save draft and replace members
    const result = await db.$transaction(async (tx) => {
      if (nextTitle !== authContext.idea.title.trim()) {
        await tx.idea.update({
          where: { id: ideaId },
          data: {
            title: nextTitle,
            version: { increment: 1 },
          },
        });
      }

      // 1. Upsert ProjectProfile
      const profile = await tx.projectProfile.upsert({
        where: { ideaId },
        create: {
          ideaId,
          status: ProjectProfileStatus.DRAFT,
          version: 1,
        },
        update: {
          // If status was NEEDS_REVISION or DRAFT, keep it editable
          status: currentProfile?.status === ProjectProfileStatus.COMPLETED
            ? ProjectProfileStatus.COMPLETED
            : ProjectProfileStatus.DRAFT,
          version: { increment: 1 },
        },
      });

      // 2. Clear old members and insert updated members
      await tx.projectMember.deleteMany({
        where: { profileId: profile.id },
      });

      if (members.length > 0) {
        await tx.projectMember.createMany({
          data: members.map((m, idx) => ({
            profileId: profile.id,
            memberType: m.memberType,
            isLeader: m.isLeader,
            fullName: m.fullName.trim(),
            email: m.email.trim().toLowerCase(),
            studentCode: m.studentCode ? m.studentCode.trim().toUpperCase() : null,
            className: m.className ? m.className.trim() : null,
            phone: m.phone ? m.phone.trim() : null,
            department: m.department ? m.department.trim() : null,
            orderIndex: idx,
          })),
        });
      }

      // 3. Record history
      await tx.profileHistory.create({
        data: {
          profileId: profile.id,
          ideaId,
          actorId: authContext.submitter.id,
          actorRole: "LEADER",
          action: currentProfile
            ? ProfileHistoryAction.PROFILE_SAVED_DRAFT
            : ProfileHistoryAction.PROFILE_CREATED,
          reason: "Lưu bản nháp thành viên hồ sơ đề tài.",
        },
      });

      return profile;
    });

    triggerGoogleSheetsAutoSync("profile:draft");

    const updatedProfile = await db.projectProfile.findUnique({
      where: { id: result.id },
      include: {
        members: { orderBy: { orderIndex: "asc" } },
        editRequests: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Đã lưu bản nháp thành công.",
      data: updatedProfile,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khi lưu bản nháp hồ sơ.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
