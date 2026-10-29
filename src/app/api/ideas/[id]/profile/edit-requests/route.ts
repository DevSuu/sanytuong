import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticateLeaderByLookupToken } from "@/lib/domain/profile-service";
import { createEditRequestSchema } from "@/lib/validation/profile-schema";
import {
  ProjectProfileStatus,
  EditRequestStatus,
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
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) để tạo yêu cầu chỉnh sửa." },
        { status: 401 },
      );
    }

    const db = getDb();
    const authContext = await authenticateLeaderByLookupToken(ideaId, token, db);

    const profile = authContext.profile;
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Hồ sơ đề tài chưa được khởi tạo." },
        { status: 400 },
      );
    }

    // Business rule: Only COMPLETED profile requires Edit Request
    if (profile.status !== ProjectProfileStatus.COMPLETED) {
      return NextResponse.json(
        {
          ok: false,
          error: "Chỉ hồ sơ đã được xác nhận hoàn tất (COMPLETED) mới cần gửi Yêu cầu chỉnh sửa. Nếu hồ sơ đang ở trạng thái khác, bạn có thể chỉnh sửa trực tiếp.",
        },
        { status: 400 },
      );
    }

    // Check if there is already a PENDING edit request
    const existingPending = await db.profileEditRequest.findFirst({
      where: {
        profileId: profile.id,
        status: EditRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          ok: false,
          error: "Hiện đang có một yêu cầu chỉnh sửa đang chờ Ban tổ chức xét duyệt. Vui lòng đợi kết quả xử lý.",
        },
        { status: 400 },
      );
    }

    // Validate body
    const parsed = createEditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu chỉnh sửa không hợp lệ." },
        { status: 400 },
      );
    }

    const { reason, requestedFields } = parsed.data;

    // Atomic transaction: create edit request and history
    const editRequest = await db.$transaction(async (tx) => {
      const er = await tx.profileEditRequest.create({
        data: {
          profileId: profile.id,
          requestedBy: authContext.submitter.id,
          reason,
          requestedFields,
          status: EditRequestStatus.PENDING,
        },
      });

      await tx.profileHistory.create({
        data: {
          profileId: profile.id,
          ideaId,
          actorId: authContext.submitter.id,
          actorRole: "LEADER",
          action: ProfileHistoryAction.PROFILE_EDIT_REQUEST_CREATED,
          reason,
          metadata: { requestedFields },
        },
      });

      return er;
    });

    triggerGoogleSheetsAutoSync("profile:edit-request");

    return NextResponse.json({
      ok: true,
      message: "Yêu cầu chỉnh sửa đã được gửi thành công đến Ban tổ chức.",
      data: editRequest,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khi tạo yêu cầu chỉnh sửa.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
