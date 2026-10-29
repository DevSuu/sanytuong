import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateSeasonSchema } from "@/lib/validation/award-schema";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/award-seasons/[id]
 * Updates a Season's attributes or status.
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

    const parsed = updateSeasonSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu cập nhật không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.awardSeason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Mùa giải không tồn tại." }, { status: 404 });
    }

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const duplicateSlug = await db.awardSeason.findUnique({
        where: { slug: parsed.data.slug },
      });
      if (duplicateSlug && duplicateSlug.id !== id) {
        return NextResponse.json({ error: "Đường dẫn slug này đã được sử dụng." }, { status: 400 });
      }
    }

    const updated = await db.awardSeason.update({
      where: { id },
      data: {
        name: parsed.data.name !== undefined ? parsed.data.name.trim() : undefined,
        slug: parsed.data.slug !== undefined ? parsed.data.slug.trim() : undefined,
        description: parsed.data.description !== undefined ? parsed.data.description?.trim() || null : undefined,
        year: parsed.data.year !== undefined ? parsed.data.year : undefined,
        status: parsed.data.status !== undefined ? parsed.data.status : undefined,
        isDemo: parsed.data.isDemo !== undefined ? parsed.data.isDemo : undefined,
        displayOrder: parsed.data.displayOrder !== undefined ? parsed.data.displayOrder : undefined,
      },
    });

    triggerGoogleSheetsAutoSync("admin:season-update");

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin mùa giải thành công.",
      season: updated,
    });
  } catch (error: unknown) {
    console.error("[AdminUpdateSeasonError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi cập nhật mùa giải." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/award-seasons/[id]
 * Permanently deletes an AwardSeason (and cascades to its awards).
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

    const existing = await db.awardSeason.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mùa giải không tồn tại." }, { status: 404 });
    }

    await db.awardSeason.delete({
      where: { id },
    });

    triggerGoogleSheetsAutoSync("admin:season-delete");

    return NextResponse.json({
      success: true,
      message: `Đã xóa mùa giải "${existing.name}" thành công.`,
    });
  } catch (error: unknown) {
    console.error("[AdminDeleteSeasonError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa mùa giải." },
      { status: 500 }
    );
  }
}
