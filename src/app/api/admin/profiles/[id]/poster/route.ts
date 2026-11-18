import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { ProfileHistoryAction } from "@/lib/domain/profile-state-machine";
import {
  extractPosterDriveMetadata,
  getPosterDriveConfig,
  savePosterDriveConfig,
  getStandalonePosterAppsScriptTemplate,
  isValidPosterFileName,
  listPosterDriveFiles,
  provisionPosterDriveFolder,
} from "@/lib/google-drive/poster-drive-service";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Yêu cầu đăng nhập quản trị viên." },
      { status: 401 },
    );
  }

  const config = await getPosterDriveConfig();
  return NextResponse.json({
    ok: true,
    config,
    appsScriptCode: getStandalonePosterAppsScriptTemplate(),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu đăng nhập quản trị viên." },
        { status: 401 },
      );
    }

    const { id: profileId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: "SYNC_DRIVE" | "SAVE_CONFIG_AND_SYNC";
      webhookUrl?: string;
      rootFolderName?: string;
      useTestSuffix?: boolean;
    };

    if (body.action === "SAVE_CONFIG_AND_SYNC") {
      if (
        body.webhookUrl &&
        !body.webhookUrl.startsWith("https://script.google.com/") &&
        !body.webhookUrl.startsWith("https://")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "URL Webhook Google Drive không hợp lệ (phải bắt đầu bằng https://script.google.com/...).",
          },
          { status: 400 },
        );
      }

      await savePosterDriveConfig(
        {
          webhookUrl: body.webhookUrl,
          rootFolderName: body.rootFolderName,
          useTestSuffix: body.useTestSuffix,
        },
        session.user.email || "ADMIN",
      );
    }

    const db = getDb();
    const profile = await db.projectProfile.findUnique({
      where: { id: profileId },
      include: {
        idea: {
          include: { submitter: true },
        },
        members: true,
        history: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Hồ sơ đề tài không tồn tại." },
        { status: 404 },
      );
    }

    const leaderMember = profile.members.find((m) => m.isLeader);
    const leaderEmail = leaderMember?.email || profile.idea.submitter.email;
    const existingMeta = extractPosterDriveMetadata(
      profile.history,
      profile.idea.referenceCode,
      leaderEmail,
    );

    const syncedMeta = existingMeta?.folderUrl
      ? await listPosterDriveFiles({
          referenceCode: profile.idea.referenceCode,
          ideaTitle: profile.idea.title,
          leaderEmail,
          existingMeta,
        })
      : await provisionPosterDriveFolder({
          referenceCode: profile.idea.referenceCode,
          ideaTitle: profile.idea.title,
          leaderEmail,
        });

    const hasFilesNow = Boolean(syncedMeta.files && syncedMeta.files.length > 0);
    const allFilesValidName =
      hasFilesNow &&
      syncedMeta.files.every((f) =>
        isValidPosterFileName(f.name, profile.idea.referenceCode),
      );
    const wasAlreadySubmitted = existingMeta?.posterStatus === "SUBMITTED";
    const finalStatus =
      allFilesValidName || wasAlreadySubmitted ? "SUBMITTED" : "WAITING_UPLOAD";

    const finalMeta = {
      ...syncedMeta,
      posterStatus: finalStatus as "WAITING_UPLOAD" | "SUBMITTED",
      submittedAt:
        finalStatus === "SUBMITTED"
          ? existingMeta?.submittedAt || new Date().toISOString()
          : null,
      leaderNote: syncedMeta.leaderNote ?? existingMeta?.leaderNote ?? null,
    };

    const isNewlyDetectedSubmission = !wasAlreadySubmitted && allFilesValidName;

    await db.profileHistory.create({
      data: {
        profileId: profile.id,
        ideaId: profile.ideaId,
        actorId: session.user.id,
        actorRole: "ADMIN",
        action: isNewlyDetectedSubmission
          ? ProfileHistoryAction.PROFILE_COMPLETED
          : ProfileHistoryAction.PROFILE_SAVED_DRAFT,
        reason: isNewlyDetectedSubmission
          ? `[POSTER_SUBMITTED] Quản trị viên đồng bộ thư mục Google Drive (${finalMeta.folderName}) — Phát hiện ${finalMeta.files.length} tệp tin: ${finalMeta.files.map((f) => f.name).join(", ")}`
          : `Đồng bộ thư mục Google Drive (${finalMeta.folderName}).`,
        metadata: {
          eventType: isNewlyDetectedSubmission
            ? "POSTER_SUBMITTED"
            : "POSTER_FOLDER_SYNC",
          posterDrive: JSON.parse(JSON.stringify(finalMeta)),
        },
      },
    });

    if (isNewlyDetectedSubmission) {
      triggerGoogleSheetsAutoSync("admin:poster-sync");
    }

    const config = await getPosterDriveConfig();

    const syncSuccessMessage =
      hasFilesNow && !allFilesValidName
        ? `Đã đồng bộ thư mục "${finalMeta.folderName}" (${finalMeta.files.length} tệp tin — Lưu ý: có tệp chưa đặt tên đúng mã ${profile.idea.referenceCode}).`
        : `Đã kết nối & tạo/đồng bộ thư mục Google Drive "${finalMeta.folderName}" (${finalMeta.files.length} tệp tin).`;

    return NextResponse.json({
      ok: !finalMeta.driveWarning,
      message: finalMeta.driveWarning
        ? finalMeta.driveWarning
        : syncSuccessMessage,
      posterDrive: finalMeta,
      config,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Lỗi khi đồng bộ thư mục Google Drive.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
