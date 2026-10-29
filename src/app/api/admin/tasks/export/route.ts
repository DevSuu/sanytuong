import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { tasksExportQuerySchema } from "@/lib/validation/export-schema";
import { exportTasksToExcel } from "@/lib/export/tasks-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tasks/export
 * Admin-only endpoint to export ordered tasks and applicant rosters to an Excel workbook.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parseResult = tasksExportQuerySchema.safeParse({
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Tham số tìm kiếm không hợp lệ.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const workbook = await exportTasksToExcel(parseResult.data, {
      id: session.user.id,
      email: session.user.email,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `tasks_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[EXPORT_TASKS_ERROR]", error);
    return NextResponse.json(
      { error: "Lỗi trong quá trình xuất dữ liệu Excel nhiệm vụ." },
      { status: 500 }
    );
  }
}
