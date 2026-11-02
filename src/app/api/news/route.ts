import { NextResponse } from "next/server";
import { getPublicNewsPosts } from "@/lib/domain/news-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getPublicNewsPosts();
    return NextResponse.json(
      {
        success: true,
        items,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    console.error("[GetPublicNewsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải Bảng tin sáng tạo." },
      { status: 500 }
    );
  }
}
