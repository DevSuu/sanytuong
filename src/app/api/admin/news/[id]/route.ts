import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  updateNewsPost,
  deleteNewsPost,
  getAdminNewsPosts,
  NewsCategory,
  NewsStatus,
} from "@/lib/domain/news-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID bản tin không hợp lệ." }, { status: 400 });
    }

    const body = await req.json();
    const updated = await updateNewsPost(numericId, {
      title: typeof body?.title === "string" ? body.title : undefined,
      summary: typeof body?.summary === "string" ? body.summary : undefined,
      content: typeof body?.content === "string" ? body.content : undefined,
      category: body?.category as NewsCategory | undefined,
      author: typeof body?.author === "string" ? body.author : undefined,
      isPinned: typeof body?.isPinned === "boolean" ? body.isPinned : undefined,
      status: body?.status as NewsStatus | undefined,
      imageDataUrl:
        typeof body?.imageDataUrl === "string" ? body.imageDataUrl : undefined,
      thumbLabel:
        typeof body?.thumbLabel === "string" ? body.thumbLabel : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Không tìm thấy bản tin cần cập nhật." },
        { status: 404 }
      );
    }

    const items = await getAdminNewsPosts();
    return NextResponse.json({
      success: true,
      message: "Đã cập nhật bản tin thành công.",
      item: updated,
      items,
    });
  } catch (error: unknown) {
    console.error("[AdminUpdateNewsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi cập nhật bản tin." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID bản tin không hợp lệ." }, { status: 400 });
    }

    const items = await deleteNewsPost(numericId);
    return NextResponse.json({
      success: true,
      message: "Đã xóa vĩnh viễn bản tin.",
      items,
    });
  } catch (error: unknown) {
    console.error("[AdminDeleteNewsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa bản tin." },
      { status: 500 }
    );
  }
}
