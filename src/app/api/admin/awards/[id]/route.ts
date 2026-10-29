import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateAwardSchema } from "@/lib/validation/award-schema";
import { updateAwardRecord } from "@/lib/domain/award-service";
import { AwardValidationError } from "@/lib/domain/award-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/awards/[id]
 * Retrieves award details for admin inspection and editing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const award = await db.award.findUnique({
      where: { id },
      include: {
        season: true,
        members: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
        history: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });

    if (!award) {
      return NextResponse.json({ error: "Không tìm thấy giải thưởng." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      award,
    });
  } catch (error: unknown) {
    console.error("[AdminGetAwardDetailError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải chi tiết giải thưởng." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/awards/[id]
 * Updates an award and optionally replaces members.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = updateAwardSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu cập nhật không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const updated = await updateAwardRecord(id, parsed.data, session.user.id, db);

    triggerGoogleSheetsAutoSync("admin:award-update");

    return NextResponse.json({
      success: true,
      message: "Cập nhật giải thưởng thành công.",
      award: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AwardValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[AdminUpdateAwardError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi cập nhật giải thưởng." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/awards/[id]
 * Permanently deletes an award record along with its members and history.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const existing = await db.award.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy giải thưởng cần xóa." }, { status: 404 });
    }

    await db.award.delete({
      where: { id },
    });

    triggerGoogleSheetsAutoSync("admin:award-delete");

    return NextResponse.json({
      success: true,
      message: `Đã xóa giải thưởng "${existing.title}" thành công.`,
    });
  } catch (error: unknown) {
    console.error("[AdminDeleteAwardError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa giải thưởng." },
      { status: 500 }
    );
  }
}
