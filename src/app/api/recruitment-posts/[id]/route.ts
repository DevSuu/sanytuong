import { NextResponse } from "next/server";
import { getPublicRecruitmentPostById } from "@/lib/domain/recruitment-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const post = await getPublicRecruitmentPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Tin tuyển dụng không tồn tại hoặc đã đóng." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khi tải thông tin tin tuyển dụng.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
