import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  getCustomHighlightsIndex,
  addCustomHighlights,
} from "@/lib/domain/highlights-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/highlights
 * Returns the admin list of uploaded highlight images for "Dấu ấn mùa 1".
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const items = await getCustomHighlightsIndex();
    return NextResponse.json({
      success: true,
      items: items.map((item) => ({
        ...item,
        imageUrl: `/api/highlights/${item.id}/image?t=${encodeURIComponent(item.createdAt)}`,
      })),
    });
  } catch (error: unknown) {
    console.error("[AdminGetHighlightsError]", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách ảnh Dấu ấn mùa 1." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/highlights
 * Uploads one or multiple images to the "Dấu ấn mùa 1" marquee.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const body = await req.json();
    const rawImages = Array.isArray(body?.images) ? body.images : [];

    if (rawImages.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 hình ảnh để tải lên." },
        { status: 400 }
      );
    }

    const validInputs: { dataUrl: string; title?: string }[] = [];
    for (const img of rawImages) {
      if (typeof img === "string" && img.startsWith("data:image/")) {
        validInputs.push({ dataUrl: img });
      } else if (
        typeof img === "object" &&
        img !== null &&
        typeof img.dataUrl === "string" &&
        img.dataUrl.startsWith("data:image/")
      ) {
        validInputs.push({
          dataUrl: img.dataUrl,
          title: typeof img.title === "string" ? img.title : undefined,
        });
      }
    }

    if (validInputs.length === 0) {
      return NextResponse.json(
        { error: "Định dạng ảnh tải lên không hợp lệ." },
        { status: 400 }
      );
    }

    const updated = await addCustomHighlights(validInputs);

    return NextResponse.json({
      success: true,
      message: `Đã tải lên ${validInputs.length} ảnh thành công.`,
      items: updated.map((item) => ({
        ...item,
        imageUrl: `/api/highlights/${item.id}/image?t=${encodeURIComponent(item.createdAt)}`,
      })),
    });
  } catch (error: unknown) {
    console.error("[AdminAddHighlightsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu ảnh." },
      { status: 500 }
    );
  }
}
