import { NextResponse } from "next/server";
import { getPublicRecruitmentPosts } from "@/lib/domain/recruitment-service";

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
    const message = error instanceof Error ? error.message : "Lỗi khi tải danh sách tin tuyển dụng.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
