import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticateLeaderByLookupToken } from "@/lib/domain/profile-service";
import { getAdminSession } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const db = getDb();

    // Check if requester is Admin
    const adminSession = await getAdminSession();
    if (adminSession) {
      const idea = await db.idea.findUnique({
        where: { id: ideaId },
        include: {
          submitter: true,
          projectProfile: {
            include: {
              members: { orderBy: { orderIndex: "asc" } },
              editRequests: { orderBy: { createdAt: "desc" } },
              history: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      });

      if (!idea) {
        return NextResponse.json({ ok: false, error: "Ý tưởng không tồn tại." }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        data: {
          idea,
          submitter: idea.submitter,
          profile: idea.projectProfile,
        },
      });
    }

    // Otherwise, authenticate via permanent lookup token
    const url = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const tokenHeader = req.headers.get("x-lookup-token");
    const tokenQuery = url.searchParams.get("token");

    const token =
      tokenHeader ||
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
      tokenQuery;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu cung cấp mã tra cứu (lookup token) để truy cập hồ sơ đề tài." },
        { status: 401 },
      );
    }

    const authContext = await authenticateLeaderByLookupToken(ideaId, token, db);

    return NextResponse.json(
      {
        ok: true,
        data: authContext,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Đã xảy ra lỗi khi tải hồ sơ đề tài.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
