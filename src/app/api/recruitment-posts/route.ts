import { NextResponse } from "next/server";
import { getPublicRecruitmentPosts } from "@/lib/domain/recruitment-service";
import { DomainValidationError } from "@/lib/domain/profile-state-machine";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const skill = url.searchParams.get("skill") || undefined;
    const field = url.searchParams.get("field") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const limit = Number(url.searchParams.get("limit")) || 20;
    const offset = Number(url.searchParams.get("offset")) || 0;

    const result = await getPublicRecruitmentPosts({
      search,
      skill,
      field,
      sort,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        ok: true,
        data: result.items,
        total: result.total,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[GetPublicRecruitmentPostsError]", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tải danh sách đề tài lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
