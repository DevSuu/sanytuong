import { NextRequest, NextResponse } from "next/server";
import { getCustomHighlightRawImage } from "@/lib/domain/highlights-service";
import { decodePublicId, optimizeApiImage } from "@/lib/security/public-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/highlights/[id]/image
 * Serves the optimized, resized WebP image for a custom highlight item stored in PostgreSQL.
 * Accepts signed UUIDs (prevents sequential ID enumeration) and optional ?w= & ?q= params.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = decodePublicId(id, "hl");
    if (numericId === null) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const raw = await getCustomHighlightRawImage(numericId);
    if (!raw) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (raw.startsWith("data:image/")) {
      const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return new NextResponse("Invalid image format", { status: 400 });
      }
      const contentType = match[1];
      const base64Data = match[2];

      const wParam = req.nextUrl.searchParams.get("w");
      const qParam = req.nextUrl.searchParams.get("q");
      const requestedWidth = wParam ? parseInt(wParam, 10) : 564;
      const requestedQuality = qParam ? parseInt(qParam, 10) : 80;

      const optimized = await optimizeApiImage(
        `hl:${numericId}`,
        base64Data,
        contentType,
        Number.isNaN(requestedWidth) ? 564 : requestedWidth,
        Number.isNaN(requestedQuality) ? 80 : requestedQuality
      );

      return new NextResponse(Buffer.from(optimized.buffer), {
        status: 200,
        headers: {
          "Content-Type": optimized.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          Vary: "Accept-Encoding",
        },
      });
    }

    if (raw.startsWith("/")) {
      return NextResponse.redirect(new URL(raw, req.url));
    }

    return new NextResponse("Not Found", { status: 404 });
  } catch (error: unknown) {
    console.error("[HighlightImageRouteError]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
