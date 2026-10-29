import { NextResponse } from "next/server";
import {
  getLeaderRecruitmentData,
  createOrUpdateRecruitmentPost,
} from "@/lib/domain/recruitment-service";
import { recruitmentPostCreateSchema } from "@/lib/validation/recruitment-schema";
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const token = extractLookupToken(req);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) của Trưởng nhóm." },
        { status: 401 },
      );
    }

    const data = await getLeaderRecruitmentData(ideaId, token);

    return NextResponse.json(
      { ok: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi tải thông tin tuyển dụng.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(
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

    const parsed = recruitmentPostCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const post = await createOrUpdateRecruitmentPost(ideaId, token, parsed.data);

    triggerGoogleSheetsAutoSync("recruitment:post-save");

    return NextResponse.json({
      ok: true,
      message: "Lưu tin tuyển dụng thành công.",
      data: post,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi lưu tin tuyển dụng.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
