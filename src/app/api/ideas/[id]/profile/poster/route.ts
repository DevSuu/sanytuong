import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { authenticateLeaderByLookupToken } from "@/lib/domain/profile-service";
import {
  ProjectProfileStatus,
  ProfileHistoryAction,
} from "@/lib/domain/profile-state-machine";
import {
  buildStandardPosterFileName,
  extractPosterDriveMetadata,
  initPosterResumableUpload,
  isValidPosterFileName,
  listPosterDriveFiles,
  MAX_DIRECT_DRIVEAPP_BYTES,
  MAX_POSTER_FILE_SIZE_BYTES,
  POSTER_UPLOAD_CHUNK_SIZE,
  provisionPosterDriveFolder,
} from "@/lib/google-drive/poster-drive-service";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      lookupToken?: string;
      action?: "INIT_UPLOAD" | "PROVISION_OR_REFRESH" | "CONFIRM_SUBMITTED";
      originalFileName?: string;
      mimeType?: string;
      fileSize?: number;
      note?: string;
    };

    const authHeader = req.headers.get("authorization");
    const tokenHeader = req.headers.get("x-lookup-token");
    const token =
      tokenHeader ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null) ||
      body.lookupToken;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Thiếu mã tra cứu (lookup token)." },
        { status: 401 },
      );
    }

    const db = getDb();
    const authContext = await authenticateLeaderByLookupToken(
      ideaId,
      token,
      db,
    );

    const profile = authContext.profile;
    if (!profile || profile.status !== ProjectProfileStatus.COMPLETED) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Chỉ hồ sơ đội Vòng 2 đã được Ban tổ chức phê duyệt (Đã duyệt hồ sơ Vòng 2) mới có thể nộp Poster.",
        },
        { status: 400 },
      );
    }

    const leaderMember = profile.members.find((m) => m.isLeader);
    const leaderEmail = leaderMember?.email || authContext.submitter.email;
    const existingMeta = extractPosterDriveMetadata(
      profile.history,
      authContext.idea.referenceCode,
      leaderEmail,
    );

    const action = body.action || "CONFIRM_SUBMITTED";
    const note = body.note ? String(body.note).trim().slice(0, 500) : null;

    if (action === "INIT_UPLOAD") {
      const fileSize = Number(body.fileSize || 0);
      if (
        !Number.isInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_POSTER_FILE_SIZE_BYTES
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              fileSize > MAX_POSTER_FILE_SIZE_BYTES
                ? "Dung lượng tệp vượt quá giới hạn 150 MB."
                : "Dung lượng file không hợp lệ.",
          },
          { status: 400 },
        );
      }

      const nameCheck = buildStandardPosterFileName(
        body.originalFileName || "",
        body.mimeType || "",
        authContext.idea.referenceCode,
      );
      if (!nameCheck.ok) {
        return NextResponse.json(
          { ok: false, error: nameCheck.error },
          { status: 400 },
        );
      }

      const initRes = await initPosterResumableUpload({
        referenceCode: authContext.idea.referenceCode,
        ideaTitle: authContext.idea.title,
        leaderEmail,
        targetFileName: nameCheck.targetFileName,
        mimeType: nameCheck.resolvedMimeType,
        fileSize,
      });

      let sessionPayload: Record<string, unknown>;
      if (initRes.ok && initRes.uploadUrl) {
        sessionPayload = {
          mode: "RESUMABLE",
          uploadUrl: initRes.uploadUrl,
          folderId: initRes.folderId || null,
          folderName: initRes.folderName,
          targetFileName: nameCheck.targetFileName,
          mimeType: nameCheck.resolvedMimeType,
          fileSize,
          note,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
      } else if (fileSize <= MAX_DIRECT_DRIVEAPP_BYTES) {
        sessionPayload = {
          mode: "DIRECT_BUFFER",
          directBufferId: crypto.randomUUID(),
          uploadUrl: "",
          folderId: initRes.folderId || existingMeta?.folderId || null,
          folderName: initRes.folderName,
          targetFileName: nameCheck.targetFileName,
          mimeType: nameCheck.resolvedMimeType,
          fileSize,
          note,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
      } else {
        return NextResponse.json(
          {
            ok: false,
            error:
              initRes.error ||
              "Không khởi tạo được phiên tải lên Google Drive cho tệp > 36 MB.",
          },
          { status: 400 },
        );
      }

      const uploadSessionToken = encryptToken(
        JSON.stringify(sessionPayload),
        ideaId,
      );

      return NextResponse.json({
        ok: true,
        uploadSessionToken,
        targetFileName: nameCheck.targetFileName,
        chunkSize: POSTER_UPLOAD_CHUNK_SIZE,
      });
    }

    if (action === "PROVISION_OR_REFRESH") {
      const syncedMeta = existingMeta?.folderUrl
        ? await listPosterDriveFiles({
            referenceCode: authContext.idea.referenceCode,
            ideaTitle: authContext.idea.title,
            leaderEmail,
            existingMeta,
          })
        : await provisionPosterDriveFolder({
            referenceCode: authContext.idea.referenceCode,
            ideaTitle: authContext.idea.title,
            leaderEmail,
          });

      await db.profileHistory.create({
        data: {
          profileId: profile.id,
          ideaId,
          actorId: authContext.submitter.id,
          actorRole: "LEADER",
          action: ProfileHistoryAction.PROFILE_SAVED_DRAFT,
          reason: `Đồng bộ thư mục Google Drive nộp Poster (${syncedMeta.folderName}).`,
          metadata: {
            eventType: "POSTER_FOLDER_SYNC",
            posterDrive: JSON.parse(JSON.stringify(syncedMeta)),
          },
        },
      });

      return NextResponse.json({
        ok: true,
        posterDrive: syncedMeta,
      });
    }

    // CONFIRM_SUBMITTED: Check files in the Google Drive folder
    const checkedMeta = await listPosterDriveFiles({
      referenceCode: authContext.idea.referenceCode,
      ideaTitle: authContext.idea.title,
      leaderEmail,
      existingMeta,
    });

    if (checkedMeta.driveWarning && !checkedMeta.folderUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: checkedMeta.driveWarning,
          posterDrive: checkedMeta,
        },
        { status: 400 },
      );
    }

    if (!checkedMeta.files || checkedMeta.files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Thư mục Google Drive "${checkedMeta.folderName}" hiện đang trống (0 tệp tin). Vui lòng tải file Poster vào thư mục Google Drive trước khi bấm xác nhận!`,
          posterDrive: checkedMeta,
        },
        { status: 400 },
      );
    }

    const refCode = authContext.idea.referenceCode;
    const invalidFiles = checkedMeta.files.filter(
      (f) => !isValidPosterFileName(f.name, refCode),
    );

    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map((f) => `"${f.name}"`).join(", ");
      return NextResponse.json(
        {
          ok: false,
          error: `Tệp tin tải lên chưa đặt đúng tên Mã đề tài (${invalidNames}). Vui lòng mở thư mục Google Drive, chuột phải vào tệp -> chọn "Đổi tên" (Rename) thành "${refCode}.pdf" (hoặc bắt đầu bằng "${refCode}_...") rồi bấm Xác nhận lại!`,
          posterDrive: checkedMeta,
        },
        { status: 400 },
      );
    }

    const fileNames = checkedMeta.files.map((f) => f.name).join(", ");
    const finalMeta = {
      ...checkedMeta,
      posterStatus: "SUBMITTED" as const,
      submittedAt: new Date().toISOString(),
      leaderNote: note || existingMeta?.leaderNote || null,
    };

    await db.profileHistory.create({
      data: {
        profileId: profile.id,
        ideaId,
        actorId: authContext.submitter.id,
        actorRole: "LEADER",
        action: ProfileHistoryAction.PROFILE_COMPLETED,
        reason: `[POSTER_SUBMITTED] Đã tải Poster lên thư mục Google Drive (${finalMeta.folderName}): ${fileNames}${
          note ? ` — Ghi chú: "${note}"` : ""
        }`,
        metadata: {
          eventType: "POSTER_SUBMITTED",
          posterDrive: JSON.parse(JSON.stringify(finalMeta)),
        },
      },
    });

    triggerGoogleSheetsAutoSync("profile:poster-submit");

    return NextResponse.json({
      ok: true,
      message: `Đã xác nhận nộp Poster thành công (${finalMeta.files.length} tệp tin trong thư mục ${finalMeta.folderName})!`,
      posterDrive: finalMeta,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi xác nhận nộp Poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
