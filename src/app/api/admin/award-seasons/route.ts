import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createSeasonSchema } from "@/lib/validation/award-schema";
import { generateUniqueSeasonSlug } from "@/lib/domain/award-service";
import { AwardSeasonStatus } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/award-seasons
 * Lists all seasons with award counts.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const db = getDb();
    const seasons = await db.awardSeason.findMany({
      orderBy: [{ displayOrder: "asc" }, { year: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            awards: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      seasons,
    });
  } catch (error: unknown) {
    console.error("[AdminGetSeasonsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải danh sách mùa giải." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/award-seasons
 * Creates a new Season.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSeasonSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu mùa giải không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const slug = parsed.data.slug?.trim()
      ? parsed.data.slug.trim()
      : await generateUniqueSeasonSlug(parsed.data.name, undefined, db);

    const existingSlug = await db.awardSeason.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: `Đường dẫn slug mùa giải "${slug}" đã tồn tại.` },
        { status: 400 }
      );
    }

    const season = await db.awardSeason.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        year: parsed.data.year || new Date().getFullYear(),
        status: parsed.data.status || AwardSeasonStatus.DRAFT,
        isDemo: parsed.data.isDemo ?? false,
        displayOrder: parsed.data.displayOrder ?? 0,
      },
    });

    triggerGoogleSheetsAutoSync("admin:season-create");

    return NextResponse.json(
      {
        success: true,
        message: "Tạo mùa giải mới thành công.",
        season,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[AdminCreateSeasonError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tạo mùa giải mới." },
      { status: 500 }
    );
  }
}
