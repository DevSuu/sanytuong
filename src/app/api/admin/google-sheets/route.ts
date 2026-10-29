import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  getGoogleSheetsSyncStatus,
  syncAllDataToGoogleSheets,
  getGoogleAppsScriptTemplate,
} from "@/lib/google-sheets/sync-service";

export async function GET() {
  const session = await getAdminSession();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Chưa đăng nhập quyền Quản trị viên." },
      { status: 401 }
    );
  }

  const [config, status] = await Promise.all([
    getGoogleSheetsConfig(),
    getGoogleSheetsSyncStatus(),
  ]);

  return NextResponse.json({
    ok: true,
    config,
    status,
    appsScriptCode: getGoogleAppsScriptTemplate(config.secret),
  });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Chưa đăng nhập quyền Quản trị viên." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "save_config" | "sync" | "save_and_sync";
      webhookUrl?: string;
      spreadsheetUrl?: string;
      secret?: string;
      enabled?: boolean;
    };

    const action = body.action || "sync";
    let config = await getGoogleSheetsConfig();

    if (action === "save_config" || action === "save_and_sync") {
      if (
        body.webhookUrl &&
        !body.webhookUrl.startsWith("https://script.google.com/") &&
        !body.webhookUrl.startsWith("https://")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "URL Webhook không hợp lệ (phải bắt đầu bằng https://script.google.com/...).",
          },
          { status: 400 }
        );
      }

      config = await saveGoogleSheetsConfig(
        {
          webhookUrl: body.webhookUrl,
          spreadsheetUrl: body.spreadsheetUrl,
          secret: body.secret,
          enabled:
            body.enabled !== undefined
              ? body.enabled
              : Boolean(body.webhookUrl?.trim()),
        },
        session.user.email || "ADMIN"
      );
    }

    if (action === "sync" || action === "save_and_sync") {
      if (!config.webhookUrl) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Vui lòng nhập URL Web App của Google Apps Script trước khi bấm đồng bộ.",
            config,
          },
          { status: 400 }
        );
      }

      const status = await syncAllDataToGoogleSheets(
        `ADMIN (${session.user.email || "Admin"})`
      );

      return NextResponse.json({
        ok: status.lastSyncStatus === "SUCCESS",
        error:
          status.lastSyncStatus === "ERROR" ? status.lastSyncMessage : undefined,
        config,
        status,
        appsScriptCode: getGoogleAppsScriptTemplate(config.secret),
      });
    }

    const status = await getGoogleSheetsSyncStatus();
    return NextResponse.json({
      ok: true,
      config,
      status,
      appsScriptCode: getGoogleAppsScriptTemplate(config.secret),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi xử lý cấu hình Google Sheets.",
      },
      { status: 500 }
    );
  }
}
