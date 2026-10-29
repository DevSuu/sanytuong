import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticateTaskLeaderByLookupToken } from "@/lib/domain/task-service";
import { DomainValidationError } from "@/lib/domain/task-state-machine";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[slug]/my-application?token=...
 * Authenticates applicant via permanent lookup token and returns their application for this task.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const token =
      req.headers.get("x-lookup-token")?.trim() ||
      searchParams.get("token")?.trim() ||
      "";

    const db = getDb();
    const task = await db.task.findUnique({ where: { slug } });

    if (!task) {
      return NextResponse.json({ error: "Nhiệm vụ không tồn tại." }, { status: 404 });
    }

    if (!token) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp mã xác thực tra cứu (lookup token)." },
        { status: 400 }
      );
    }

    const authContext = await authenticateTaskLeaderByLookupToken(task.id, token, db);

    return NextResponse.json(
      {
        success: true,
        task: authContext.task,
        submitter: authContext.submitter,
        application: authContext.application,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch (error: unknown) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[GetMyTaskApplicationError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi kiểm tra đơn đăng ký." },
      { status: 500 }
    );
  }
}
