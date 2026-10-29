import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  authenticateLeaderByLookupToken,
  checkAndLockRepresentativeLimit,
  validateAllowedFieldsEnforcement,
} from "@/lib/domain/profile-service";
import { profileSubmitSchema } from "@/lib/validation/profile-schema";
import {
  validateProfileBusinessRules,
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
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) để nộp hồ sơ." },
        { status: 401 },
      );
    }

    const db = getDb();
    const authContext = await authenticateLeaderByLookupToken(ideaId, token, db);

    // 1. Business rule: Idea must be APPROVED
    if (authContext.idea.status !== "APPROVED") {
      return NextResponse.json(
        { ok: false, error: "Chỉ ý tưởng đã được Ban tổ chức phê duyệt (APPROVED) mới được phép nộp hồ sơ đề tài." },
        { status: 400 },
      );
    }

    // 2. Validate input schema
    const parsed = profileSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu hồ sơ không hợp lệ." },
        { status: 400 },
      );
    }

    const { title, members } = parsed.data;
    const nextTitle = title ? title.trim() : authContext.idea.title.trim();

    // 3. Domain business rules validation
    validateProfileBusinessRules(authContext.submitter, members);

    const currentProfile = authContext.profile;

    // 4. Reject submission if profile is currently SUBMITTED (under review)
    if (
      currentProfile &&
      currentProfile.status === ProjectProfileStatus.SUBMITTED
    ) {
      return NextResponse.json(
        { ok: false, error: "Hồ sơ đang trong quá trình xét duyệt của Ban tổ chức, không thể nộp lại vào lúc này." },
        { status: 400 },
      );
    }

    // 5. If previous profile was COMPLETED, check approved edit request & allowed fields
    interface EditRequestSummary {
      id: string;
      status: string;
      allowedFields: string[];
      requestedFields: string[];
      createdAt: Date | string;
    }
    let approvedEditRequest: EditRequestSummary | null = null;
    if (currentProfile && (currentProfile as { status: string }).status === ProjectProfileStatus.COMPLETED) {
      const editRequests = (currentProfile as { editRequests?: EditRequestSummary[] }).editRequests;
      approvedEditRequest = editRequests?.find(
        (er) =>
          er.status === "APPROVED" &&
          (!currentProfile.completedAt ||
            new Date(er.createdAt).getTime() >= new Date(currentProfile.completedAt).getTime()),
      ) || null;

      if (!approvedEditRequest) {
        return NextResponse.json(
          {
            ok: false,
            error: "Hồ sơ đề tài đã hoàn tất. Bạn phải tạo yêu cầu chỉnh sửa và được Ban tổ chức phê duyệt trước khi cập nhật lại.",
          },
          { status: 400 },
        );
      }

      // Enforce allowed fields
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

    const leaderMember = members.find((m) => m.isLeader)!;
    const leaderStudentCode = leaderMember.studentCode || authContext.submitter.studentCode;

    // 5. Atomic Transaction with Concurrency Advisory Lock on Representative Limit
    const updatedProfile = await db.$transaction(async (tx) => {
      // Concurrency lock and representative limit check
      await checkAndLockRepresentativeLimit(tx, leaderStudentCode, ideaId);

      // Update Idea official title directly in DB if changed
      const titleChanged = nextTitle !== authContext.idea.title.trim();
      if (titleChanged) {
        await tx.idea.update({
          where: { id: ideaId },
          data: {
            title: nextTitle,
            version: { increment: 1 },
          },
        });
      }

      // Upsert profile
      const profile = await tx.projectProfile.upsert({
        where: { ideaId },
        create: {
          ideaId,
          status: ProjectProfileStatus.SUBMITTED,
          submittedAt: new Date(),
          version: 1,
        },
        update: {
          status: ProjectProfileStatus.SUBMITTED,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
      });

      // Replace members
      await tx.projectMember.deleteMany({
        where: { profileId: profile.id },
      });

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

      // Record history
      const titleNote = titleChanged
        ? ` (Cập nhật tên đề tài mới: "${nextTitle}")`
        : "";
      await tx.profileHistory.create({
        data: {
          profileId: profile.id,
          ideaId,
          actorId: authContext.submitter.id,
          actorRole: "LEADER",
          action: ProfileHistoryAction.PROFILE_SUBMITTED,
          reason: approvedEditRequest
            ? `Nộp lại hồ sơ sau khi được duyệt yêu cầu chỉnh sửa${titleNote}.`
            : `Hoàn tất và gửi hồ sơ đề tài chính thức cho Ban tổ chức xét duyệt${titleNote}.`,
          metadata: titleChanged
            ? {
                changes: [
                  {
                    field: "Tên đề tài (idea.title)",
                    oldValue: authContext.idea.title,
                    newValue: nextTitle,
                  },
                ],
              }
            : undefined,
        },
      });

      return profile;
    });

    triggerGoogleSheetsAutoSync("profile:submit");

    const refreshed = await db.projectProfile.findUnique({
      where: { id: updatedProfile.id },
      include: {
        members: { orderBy: { orderIndex: "asc" } },
        editRequests: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Hồ sơ đề tài đã được gửi thành công đến Ban tổ chức.",
      data: refreshed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khi nộp hồ sơ đề tài.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
