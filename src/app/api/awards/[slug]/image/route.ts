import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AwardStatus, AwardSeasonStatus } from "@/generated/prisma/client";
import { optimizeApiImage } from "@/lib/security/public-id";

export const dynamic = "force-dynamic";

const DATA_IMAGE_REGEX = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;

/**
 * GET /api/awards/[slug]/image
 * Streams binary image for an award so that base64 payloads are never exposed in JSON APIs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug?.trim();
    if (!cleanSlug) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const db = getDb();
    const award = await db.award.findUnique({
      where: { slug: cleanSlug },
      select: {
        imageUrl: true,
        status: true,
        season: {
          select: { status: true },
        },
      },
    });

    if (
      !award ||
      !award.imageUrl ||
      award.status !== AwardStatus.PUBLISHED ||
      award.season.status !== AwardSeasonStatus.PUBLISHED
    ) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (award.imageUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(award.imageUrl, req.url), 302);
    }

    const match = award.imageUrl.match(DATA_IMAGE_REGEX);
    if (!match) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const mimeType = match[1].toLowerCase();
    const allowedMimes = ["image/webp", "image/jpeg", "image/png", "image/gif"];
    if (!allowedMimes.includes(mimeType)) {
      return new NextResponse("Unsupported Media Type", { status: 415 });
    }

    const wParam = req.nextUrl.searchParams.get("w");
    const requestedWidth = wParam ? parseInt(wParam, 10) : 640;
    const optimized = await optimizeApiImage(
      `award:${cleanSlug}`,
      match[2],
      mimeType,
      Number.isNaN(requestedWidth) ? 640 : requestedWidth,
      82
    );

    return new NextResponse(Buffer.from(optimized.buffer), {
      status: 200,
      headers: {
        "Content-Type": optimized.contentType,
        "Content-Length": String(optimized.buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        Vary: "Accept-Encoding",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
