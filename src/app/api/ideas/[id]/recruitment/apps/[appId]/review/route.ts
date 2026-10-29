import { NextResponse } from "next/server";
import { reviewRecruitmentApplication } from "@/lib/domain/recruitment-service";
import { recruitmentApplicationReviewSchema } from "@/lib/validation/recruitment-schema";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import { processPendingEmailJobs } from "@/lib/email/queue";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; appId: string }> },
) {
  try {
    const { id: ideaId, appId: applicationId } = await params;
    const body = await req.json();
    const token = extractLookupToken(req, body);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) của Trưởng nhóm." },
        { status: 401 },
      );
    }

    const parsed = recruitmentApplicationReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Dữ liệu xét duyệt không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await reviewRecruitmentApplication(
      ideaId,
      applicationId,
      token,
      parsed.data.action,
      parsed.data.reviewNote,
    );

    triggerGoogleSheetsAutoSync("recruitment:app-review");
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    const message =
      result.action === "ACCEPT"
        ? "Đã chấp thuận ứng viên thành công. Ứng viên đã được thêm vào nhóm đề tài."
        : "Đã từ chối ứng viên.";

    return NextResponse.json({
      ok: true,
      message,
      data: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đã xảy ra lỗi khi xét duyệt ứng viên.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
