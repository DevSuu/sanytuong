import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTaskRawImage, resolveTaskDefaultImage } from "@/lib/domain/task-image-service";
import { optimizeApiImage } from "@/lib/security/public-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[slug]/image
 * Serves the binary cover image for a task (or redirects to its static asset URL).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug?.trim();
    if (!cleanSlug) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const db = getDb();
    const task = await db.task.findUnique({
      where: { slug: cleanSlug },
      select: { id: true, slug: true, category: true },
    });

    if (!task) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const raw = await getTaskRawImage(task.id);
    if (!raw) {
      const fallback = resolveTaskDefaultImage(task.category, task.slug);
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    if (raw.startsWith("data:image/")) {
      const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return new NextResponse("Invalid image format", { status: 400 });
      }
      const contentType = match[1];
      const base64Data = match[2];
      const wParam = req.nextUrl.searchParams.get("w");
      const requestedWidth = wParam ? parseInt(wParam, 10) : 640;

      const optimized = await optimizeApiImage(
        `task:${task.id}`,
        base64Data,
        contentType,
        Number.isNaN(requestedWidth) ? 640 : requestedWidth,
        82
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

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return NextResponse.redirect(raw);
    }

    return new NextResponse("Not Found", { status: 404 });
  } catch (error: unknown) {
    console.error("[TaskImageRouteError]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
