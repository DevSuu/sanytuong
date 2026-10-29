import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createAwardSchema } from "@/lib/validation/award-schema";
import { createAwardRecord } from "@/lib/domain/award-service";
import { AwardValidationError } from "@/lib/domain/award-state-machine";
import { AwardStatus, Prisma } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/awards
 * Returns list of awards for admin management with filters.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const seasonId = searchParams.get("seasonId")?.trim();
    const isDemoParam = searchParams.get("isDemo")?.trim();
    const searchQuery = searchParams.get("q")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const skip = (page - 1) * limit;

    const db = getDb();
    const where: Prisma.AwardWhereInput = {};

    if (status && Object.values(AwardStatus).includes(status as AwardStatus)) {
      where.status = status as AwardStatus;
    }

    if (seasonId && seasonId !== "ALL") {
      where.seasonId = seasonId;
    }

    if (isDemoParam === "true") {
      where.isDemo = true;
    } else if (isDemoParam === "false") {
      where.isDemo = false;
    }

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { awardName: { contains: searchQuery, mode: "insensitive" } },
        { category: { contains: searchQuery, mode: "insensitive" } },
        { organization: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const [awards, total] = await Promise.all([
      db.award.findMany({
        where,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          season: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              year: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      db.award.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      awards,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: unknown) {
    console.error("[AdminGetAwardsError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải danh sách giải thưởng." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/awards
 * Creates a new award entry with optional members.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createAwardSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu giải thưởng không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const award = await createAwardRecord(parsed.data, session.user.id, db);

    triggerGoogleSheetsAutoSync("admin:award-create");

    return NextResponse.json(
      {
        success: true,
        message: "Tạo bản ghi giải thưởng thành công.",
        award,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AwardValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[AdminCreateAwardError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi tạo giải thưởng." },
      { status: 500 }
    );
  }
}
