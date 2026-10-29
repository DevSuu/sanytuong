import { NextResponse } from "next/server";
import { updateRecruitmentPostStatus } from "@/lib/domain/recruitment-service";
import { IdeaRecruitmentPostStatus } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

function extractLookupToken(req: Request, body?: Record<string, unknown>): string | null {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const tokenHeader = req.headers.get("x-lookup-token");
  const tokenQuery = url.searchParams.get("token");
  const tokenBody = body?.lookupToken as string | undefined;

  return (
    tokenHeader ||
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
    tokenBody ||
    tokenQuery ||
    null
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const token = extractLookupToken(req, body);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) của Trưởng nhóm." },
        { status: 401 },
      );
    }

    const { status } = body;
    if (
      !status ||
      !Object.values(IdeaRecruitmentPostStatus).includes(status as IdeaRecruitmentPostStatus)
    ) {
      return NextResponse.json(
        { ok: false, error: "Trạng thái tin tuyển dụng không hợp lệ." },
        { status: 400 },
      );
    }

    const post = await updateRecruitmentPostStatus(
      ideaId,
      token,
      status as IdeaRecruitmentPostStatus,
    );

    triggerGoogleSheetsAutoSync("recruitment:post-status");

    return NextResponse.json({
      ok: true,
      message: `Cập nhật trạng thái tin tuyển dụng thành "${post.status}" thành công.`,
      data: post,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi cập nhật trạng thái tin tuyển dụng.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
