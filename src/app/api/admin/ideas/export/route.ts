import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { ideasExportQuerySchema } from "@/lib/validation/export-schema";
import { exportIdeasToExcel } from "@/lib/export/ideas-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ideas/export
 * Admin-only endpoint to export ideas matching active filters to an Excel workbook.
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
    const parseResult = ideasExportQuerySchema.safeParse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      sort: searchParams.get("sort") || undefined,
      order: searchParams.get("order") || undefined,
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

    const workbook = await exportIdeasToExcel(parseResult.data, {
      id: session.user.id,
      email: session.user.email,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `ideas_${dateStr}.xlsx`;

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
    console.error("[EXPORT_IDEAS_ERROR]", error);
    return NextResponse.json(
      { error: "Lỗi trong quá trình xuất dữ liệu Excel ý tưởng." },
      { status: 500 }
    );
  }
}
