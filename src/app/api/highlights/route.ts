import { NextResponse } from "next/server";
import { getPublicHighlights } from "@/lib/domain/highlights-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/highlights
 * Returns the list of images for the Homepage "Dấu ấn mùa 1" continuous horizontal marquee.
 */
export async function GET() {
  try {
    const items = await getPublicHighlights();
    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: unknown) {
    console.error("[GetPublicHighlightsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải danh sách ảnh Dấu ấn mùa 1." },
      { status: 500 }
    );
  }
}
