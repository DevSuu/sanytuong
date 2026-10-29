import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { IdeaRecruitmentPostStatus } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (
      !status ||
      !Object.values(IdeaRecruitmentPostStatus).includes(status as IdeaRecruitmentPostStatus)
    ) {
      return NextResponse.json(
        { error: "Trạng thái tin tuyển dụng không hợp lệ." },
        { status: 400 },
      );
    }

    const db = getDb();
    const post = await db.ideaRecruitmentPost.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Tin tuyển dụng không tồn tại." },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (status === IdeaRecruitmentPostStatus.PUBLISHED && !post.publishedAt) {
      updateData.publishedAt = new Date();
    }
    if (status === IdeaRecruitmentPostStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    const updated = await db.ideaRecruitmentPost.update({
      where: { id },
      data: updateData,
    });

    triggerGoogleSheetsAutoSync("admin:recruitment-post-status");

    return NextResponse.json({
      ok: true,
      message: `Đã cập nhật trạng thái tin thành "${status}".`,
      data: updated,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi cập nhật trạng thái tin tuyển dụng.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id } = await params;
    const db = getDb();

    const post = await db.ideaRecruitmentPost.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Tin tuyển dụng không tồn tại." },
        { status: 404 },
      );
    }

    await db.ideaRecruitmentPost.delete({
      where: { id },
    });

    triggerGoogleSheetsAutoSync("admin:recruitment-post-delete");

    return NextResponse.json({
      ok: true,
      message: `Đã xóa tin tuyển dụng "${post.title}" thành công.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi xóa tin tuyển dụng.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
