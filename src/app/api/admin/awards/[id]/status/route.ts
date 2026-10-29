import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { changeAwardStatusSchema } from "@/lib/validation/award-schema";
import { transitionAwardStatus } from "@/lib/domain/award-service";
import {
  AwardValidationError,
  InvalidAwardTransitionError,
} from "@/lib/domain/award-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/awards/[id]/status
 * Transitions an award's status (DRAFT -> PUBLISHED -> ARCHIVED) with validation and audit.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = changeAwardStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Trạng thái giải thưởng không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const updated = await transitionAwardStatus(
      id,
      parsed.data.status,
      parsed.data.reason,
      session.user.id,
      db
    );

    triggerGoogleSheetsAutoSync("admin:award-status");

    return NextResponse.json({
      success: true,
      message: `Đã chuyển trạng thái giải thưởng sang "${updated.status}".`,
      award: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AwardValidationError || error instanceof InvalidAwardTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[AdminChangeAwardStatusError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi chuyển trạng thái giải thưởng." },
      { status: 500 }
    );
  }
}
