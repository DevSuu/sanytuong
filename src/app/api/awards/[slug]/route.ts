import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AwardStatus, AwardSeasonStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function resolveSafeAwardImageUrl(slug: string, rawImageUrl: string | null): string | null {
  if (!rawImageUrl) return null;
  const trimmed = rawImageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) {
    return `/api/awards/${encodeURIComponent(slug)}/image`;
  }
  return trimmed;
}

/**
 * GET /api/awards/[slug]
 * Public API to fetch details of a published award using strict DTO filtering.
 * Returns 404 if award is not found, not PUBLISHED, or belongs to a non-PUBLISHED season.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug?.trim().slice(0, 150);

    if (!cleanSlug) {
      return NextResponse.json({ error: "Thiếu mã định danh giải thưởng." }, { status: 400 });
    }

    const db = getDb();

    // Support lookup by new clean slug or legacy "demo-" prefixed slug
    const rawAward =
      (await db.award.findUnique({
        where: { slug: cleanSlug },
        include: {
          season: true,
          members: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      })) ||
      (cleanSlug.startsWith("demo-")
        ? await db.award.findUnique({
            where: { slug: cleanSlug.replace(/^demo-/, "") },
            include: {
              season: true,
              members: {
                orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          })
        : null);

    if (!rawAward) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin giải thưởng yêu cầu." },
        { status: 404 },
      );
    }

    // Rule 15: Public only sees if both Award and Season are PUBLISHED
    if (
      rawAward.status !== AwardStatus.PUBLISHED ||
      rawAward.season.status !== AwardSeasonStatus.PUBLISHED
    ) {
      return NextResponse.json(
        { error: "Giải thưởng này chưa được công bố hoặc đang trong quá trình xét duyệt." },
        { status: 404 },
      );
    }

    // Strict Public DTO: never expose internal CUIDs, studentCode PII, or raw base64 imageUrl
    const award = {
      id: rawAward.slug,
      title: rawAward.title,
      slug: rawAward.slug,
      shortDescription: rawAward.shortDescription,
      description: rawAward.description,
      awardName: rawAward.awardName,
      category: rawAward.category,
      organization: rawAward.organization,
      imageUrl: resolveSafeAwardImageUrl(rawAward.slug, rawAward.imageUrl),
      videoUrl: rawAward.videoUrl,
      displayOrder: rawAward.displayOrder,
      status: rawAward.status,
      isDemo: false,
      createdAt: rawAward.createdAt,
      updatedAt: rawAward.updatedAt,
      season: {
        id: rawAward.season.slug,
        name: rawAward.season.name,
        slug: rawAward.season.slug,
        description: rawAward.season.description,
        status: rawAward.season.status,
        year: rawAward.season.year,
        isDemo: false,
      },
      members: rawAward.members.map((m, idx) => ({
        id: `${rawAward.slug}-m-${idx + 1}`,
        fullName: m.fullName,
        className: m.className,
        role: m.role,
        department: m.department,
        isDemo: false,
      })),
    };

    return NextResponse.json(
      {
        success: true,
        award,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error: unknown) {
    console.error("[GetAwardDetailPublicError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải chi tiết giải thưởng." },
      { status: 500 },
    );
  }
}
