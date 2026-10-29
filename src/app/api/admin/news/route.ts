import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  getAdminNewsPosts,
  createNewsPost,
  NewsCategory,
  NewsStatus,
} from "@/lib/domain/news-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 }
      );
    }

    const items = await getAdminNewsPosts();
    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: unknown) {
    console.error("[AdminGetNewsError]", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách bản tin." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Vui lòng nhập tiêu đề bản tin." },
        { status: 400 }
      );
    }
    if (!content) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung bản tin." },
        { status: 400 }
      );
    }

    const item = await createNewsPost({
      title,
      summary: typeof body?.summary === "string" ? body.summary : undefined,
      content,
      category: body?.category as NewsCategory | undefined,
      author: typeof body?.author === "string" ? body.author : undefined,
      isPinned: Boolean(body?.isPinned),
      status: (body?.status as NewsStatus) || "PUBLISHED",
      imageDataUrl:
        typeof body?.imageDataUrl === "string" ? body.imageDataUrl : undefined,
      thumbLabel:
        typeof body?.thumbLabel === "string" ? body.thumbLabel : undefined,
    });

    const items = await getAdminNewsPosts();

    return NextResponse.json({
      success: true,
      message: "Đã đăng bản tin mới thành công.",
      item,
      items,
    });
  } catch (error: unknown) {
    console.error("[AdminCreateNewsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu bản tin." },
      { status: 500 }
    );
  }
}
