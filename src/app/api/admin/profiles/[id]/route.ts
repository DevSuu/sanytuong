import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { adminDirectEditProfileSchema } from "@/lib/validation/profile-schema";
import { computeMemberChangeSet } from "@/lib/domain/profile-service";
import {
  ProfileHistoryAction,
  validateProfileBusinessRules,
} from "@/lib/domain/profile-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const profile = await db.projectProfile.findUnique({
      where: { id },
      include: {
        idea: {
          include: {
            submitter: true,
          },
        },
        members: { orderBy: { orderIndex: "asc" } },
        editRequests: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Hồ sơ đề tài không tồn tại." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: profile });
  } catch (error: unknown) {
    console.error("[AdminProfileDetailError]", error);
    return NextResponse.json({ ok: false, error: "Lỗi khi lấy thông tin hồ sơ." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const profile = await db.projectProfile.findUnique({
      where: { id },
      include: {
        idea: { include: { submitter: true } },
        members: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Hồ sơ đề tài không tồn tại." }, { status: 404 });
    }

    const parsed = adminDirectEditProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu chỉnh sửa không hợp lệ." },
        { status: 400 },
      );
    }

    const { title, members, reason } = parsed.data;
    const nextTitle = title ? title.trim() : profile.idea.title.trim();
    const titleChanged = nextTitle !== profile.idea.title.trim();

    // Validate business rules (e.g. 2-10 members, min 1 SV, min 1 GVHD, 1 leader)
    validateProfileBusinessRules(profile.idea.submitter, members);

    // Compute structured change set for audit history
    const changes = computeMemberChangeSet(profile.members, members);
    if (titleChanged) {
      changes.unshift({
        field: "Tên đề tài (idea.title)",
        oldValue: profile.idea.title,
        newValue: nextTitle,
      });
    }

    await db.$transaction(async (tx) => {
      // 0. Update Idea title directly if changed
      if (titleChanged) {
        await tx.idea.update({
          where: { id: profile.ideaId },
          data: {
            title: nextTitle,
            version: { increment: 1 },
          },
        });
      }

      // 1. Replace members
      await tx.projectMember.deleteMany({ where: { profileId: id } });

      await tx.projectMember.createMany({
        data: members.map((m, idx) => ({
          profileId: id,
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

      // 2. Increment version & timestamp
      const p = await tx.projectProfile.update({
        where: { id },
        data: {
          version: { increment: 1 },
        },
      });

      // 3. Record structured audit history
      await tx.profileHistory.create({
        data: {
          profileId: id,
          ideaId: profile.ideaId,
          actorId: session.user.id,
          actorRole: "ADMIN",
          action: ProfileHistoryAction.ADMIN_EDITED_PROFILE,
          reason,
          metadata: JSON.parse(
            JSON.stringify({
              adminEmail: session.user.email,
              adminName: session.user.name,
              reason,
              changes,
            })
          ),
        },
      });

      return p;
    });

    triggerGoogleSheetsAutoSync("admin:profile-direct-edit");

    const refreshed = await db.projectProfile.findUnique({
      where: { id },
      include: {
        members: { orderBy: { orderIndex: "asc" } },
        history: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Quản trị viên đã cập nhật hồ sơ trực tiếp thành công.",
      data: refreshed,
    });
  } catch (error: unknown) {
    console.error("[AdminDirectEditError]", error);
    const message = error instanceof Error ? error.message : "Lỗi khi cập nhật hồ sơ.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
