import { NextResponse } from "next/server";
import { recruitmentApplicationSubmitSchema } from "@/lib/validation/recruitment-schema";
import { submitRecruitmentApplication } from "@/lib/domain/recruitment-service";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import { processPendingEmailJobs } from "@/lib/email/queue";
import { checkTargetRateLimit } from "@/lib/security/rate-limiter";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params;
    const body = await req.json();

    const parsed = recruitmentApplicationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Dữ liệu ứng tuyển không hợp lệ.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const emailRateLimit = checkTargetRateLimit(
      "recruitment_apply_email",
      parsed.data.email,
      { windowMs: 5 * 60 * 1000, max: 5 },
    );
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Địa chỉ email này vừa gửi quá nhiều yêu cầu liên tiếp. Vui lòng kiểm tra hộp thư hoặc thử lại sau ít phút.",
        },
        { status: 429 },
      );
    }

    const result = await submitRecruitmentApplication(postId, parsed.data);

    triggerGoogleSheetsAutoSync("recruitment:apply");
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message: `Mã OTP xác thực đã được gửi tới email ${result.maskedEmail}. Vui lòng nhập mã để hoàn tất gửi đơn.`,
      data: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đã xảy ra lỗi khi gửi đơn ứng tuyển.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
