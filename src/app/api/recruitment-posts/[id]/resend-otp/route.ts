import { NextResponse } from "next/server";
import { recruitmentResendOtpSchema } from "@/lib/validation/recruitment-schema";
import { resendRecruitmentApplicationOtp } from "@/lib/domain/recruitment-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params; // consume params
    const body = await req.json();

    const parsed = recruitmentResendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Thiếu mã đơn ứng tuyển.",
        },
        { status: 400 },
      );
    }

    const result = await resendRecruitmentApplicationOtp(parsed.data.applicationId);

    return NextResponse.json({
      ok: true,
      message: `Mã OTP mới đã được gửi tới email ${result.maskedEmail}.`,
      data: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đã xảy ra lỗi khi gửi lại OTP.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
