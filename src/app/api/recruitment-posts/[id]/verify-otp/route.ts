import { NextResponse } from "next/server";
import { recruitmentVerifyOtpSchema } from "@/lib/validation/recruitment-schema";
import { verifyRecruitmentApplicationOtp } from "@/lib/domain/recruitment-service";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import { processPendingEmailJobs } from "@/lib/email/queue";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params; // consume params
    const body = await req.json();

    const parsed = recruitmentVerifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Mã OTP không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await verifyRecruitmentApplicationOtp(
      parsed.data.applicationId,
      parsed.data.otp,
    );

    triggerGoogleSheetsAutoSync("recruitment:verify-otp");
    processPendingEmailJobs().catch((err) =>
      console.error("[EmailQueueBackgroundError]", err),
    );

    return NextResponse.json({
      ok: true,
      message: result.message,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đã xảy ra lỗi khi xác thực OTP.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
