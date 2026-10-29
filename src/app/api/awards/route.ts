import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AwardStatus, AwardSeasonStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_QUERY_KEYS = new Set([
  "season",
  "category",
  "prize",
  "award",
  "q",
  "search",
  "page",
  "limit",
]);

function resolveSafeAwardImageUrl(slug: string, rawImageUrl: string | null): string | null {
  if (!rawImageUrl) return null;
  const trimmed = rawImageUrl.trim();
  if (!trimmed) return null;
  // Never leak raw base64 data URLs in JSON DTOs; serve binary via /api/awards/[slug]/image
  if (trimmed.startsWith("data:image/")) {
    return `/api/awards/${encodeURIComponent(slug)}/image`;
  }
  return trimmed;
}

/**
 * GET /api/awards
 * Public API to fetch published awards for published seasons using strict DTO filtering.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Reject requests probing unknown query parameters
    for (const key of searchParams.keys()) {
      if (!ALLOWED_QUERY_KEYS.has(key)) {
        return NextResponse.json(
          { error: `Tham số truy vấn không hợp lệ: ${key}` },
          { status: 400 },
        );
      }
    }

    const seasonSlug = searchParams.get("season")?.trim().slice(0, 100);
    const category = searchParams.get("category")?.trim().slice(0, 120);
    const prize = (searchParams.get("prize") || searchParams.get("award"))?.trim().slice(0, 100);
    const searchQuery = (searchParams.get("q") || searchParams.get("search"))?.trim().slice(0, 150);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24));
    const skip = (page - 1) * limit;

    const db = getDb();

    // 1. Get published seasons for selector (Strict Public Season DTO)
    const publishedSeasons = await db.awardSeason.findMany({
      where: { status: AwardSeasonStatus.PUBLISHED },
      orderBy: [{ displayOrder: "asc" }, { year: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        year: true,
        isDemo: true,
      },
    });

    // 2. Build where filter: strictly require Award is PUBLISHED and Season is PUBLISHED
    const where: Prisma.AwardWhereInput = {
      status: AwardStatus.PUBLISHED,
      season: {
        is: {
          status: AwardSeasonStatus.PUBLISHED,
          ...(seasonSlug && seasonSlug !== "ALL" ? { slug: seasonSlug } : {}),
        },
      },
    };

    if (category && category !== "ALL") {
      where.category = { equals: category, mode: "insensitive" };
    }

    if (prize && prize !== "ALL") {
      where.awardName = { equals: prize, mode: "insensitive" };
    }

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { shortDescription: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } },
        { organization: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const [rawAwards, total, categoriesGroup, prizesGroup] = await Promise.all([
      db.award.findMany({
        where,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          awardName: true,
          category: true,
          organization: true,
          imageUrl: true,
          videoUrl: true,
          displayOrder: true,
          isDemo: true,
          createdAt: true,
          season: {
            select: {
              id: true,
              name: true,
              slug: true,
              year: true,
              isDemo: true,
            },
          },
          members: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              fullName: true,
              role: true,
              className: true,
              department: true,
              isDemo: true,
            },
          },
        },
      }),
      db.award.count({ where }),
      db.award.groupBy({
        by: ["category"],
        where: {
          status: AwardStatus.PUBLISHED,
          season: { status: AwardSeasonStatus.PUBLISHED },
          category: { not: null },
        },
      }),
      db.award.groupBy({
        by: ["awardName"],
        where: {
          status: AwardStatus.PUBLISHED,
          season: { status: AwardSeasonStatus.PUBLISHED },
        },
      }),
    ]);

    // Map to clean Public Award DTOs (never exposing raw base64 imageUrl or sensitive student PII)
    const awards = rawAwards.map((item) => ({
      id: item.slug,
      title: item.title,
      slug: item.slug,
      shortDescription: item.shortDescription,
      awardName: item.awardName,
      category: item.category,
      organization: item.organization,
      imageUrl: resolveSafeAwardImageUrl(item.slug, item.imageUrl),
      videoUrl: item.videoUrl,
      displayOrder: item.displayOrder,
      isDemo: false,
      createdAt: item.createdAt,
      season: {
        id: item.season.slug,
        name: item.season.name,
        slug: item.season.slug,
        year: item.season.year,
        isDemo: false,
      },
      members: item.members.map((m, idx) => ({
        id: `${item.slug}-m-${idx + 1}`,
        fullName: m.fullName,
        role: m.role,
        className: m.className,
        department: m.department,
        isDemo: false,
      })),
    }));

    const seasons = publishedSeasons.map((s) => ({
      id: s.slug,
      name: s.name,
      slug: s.slug,
      description: s.description,
      year: s.year,
      isDemo: false,
    }));

    const categories = categoriesGroup
      .map((c) => c.category)
      .filter((c): c is string => Boolean(c));

    const prizes = prizesGroup
      .map((p) => p.awardName)
      .filter((p): p is string => Boolean(p));

    return NextResponse.json(
      {
        success: true,
        awards,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        seasons,
        categories,
        prizes,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error: unknown) {
    console.error("[GetAwardsPublicError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải danh sách giải thưởng." },
      { status: 500 },
    );
  }
}
