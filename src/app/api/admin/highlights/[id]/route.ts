import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { deleteCustomHighlight } from "@/lib/domain/highlights-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/highlights/[id]
 * Deletes a specific highlight image from "Dấu ấn mùa 1".
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
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "Mã ảnh không hợp lệ." }, { status: 400 });
    }

    const updated = await deleteCustomHighlight(numericId);

    return NextResponse.json({
      success: true,
      message: "Đã xóa ảnh khỏi mục Dấu ấn mùa 1.",
      items: updated.map((item) => ({
        ...item,
        imageUrl: `/api/highlights/${item.id}/image?t=${encodeURIComponent(item.createdAt)}`,
      })),
    });
  } catch (error: unknown) {
    console.error("[AdminDeleteHighlightError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa ảnh." },
      { status: 500 }
    );
  }
}
