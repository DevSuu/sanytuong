import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { authenticateLeaderByLookupToken } from "@/lib/domain/profile-service";
import {
  ProjectProfileStatus,
  ProfileHistoryAction,
} from "@/lib/domain/profile-state-machine";
import {
  appendDirectUploadChunk,
  clearDirectUploadBuffer,
  consumeDirectUploadBuffer,
  finalizePosterDriveUpload,
  POSTER_UPLOAD_CHUNK_SIZE,
  uploadPosterDirectViaDriveApp,
} from "@/lib/google-drive/poster-drive-service";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

interface EncryptedUploadSession {
  mode?: "RESUMABLE" | "DIRECT_BUFFER";
  directBufferId?: string;
  uploadUrl: string;
  folderId: string | null;
  folderName: string;
  targetFileName: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  expiresAt: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;

    const authHeader = req.headers.get("authorization");
    const tokenHeader = req.headers.get("x-lookup-token");
    const token =
      tokenHeader ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Thiếu mã tra cứu (lookup token)." },
        { status: 401 },
      );
    }

    const sessionHeader = req.headers.get("x-upload-session");
    if (!sessionHeader) {
      return NextResponse.json(
        { ok: false, error: "Thiếu phiên tải lên (upload session)." },
        { status: 400 },
      );
    }

    let session: EncryptedUploadSession;
    try {
      const decrypted = decryptToken(sessionHeader, ideaId);
      session = JSON.parse(decrypted) as EncryptedUploadSession;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Phiên tải lên không hợp lệ hoặc đã hết hạn." },
        { status: 401 },
      );
    }

    const isDirectBuffer = session.mode === "DIRECT_BUFFER";
    if (
      Date.now() > session.expiresAt ||
      (!isDirectBuffer && !session.uploadUrl) ||
      (isDirectBuffer && !session.directBufferId)
    ) {
      return NextResponse.json(
        { ok: false, error: "Phiên tải lên đã hết hạn. Vui lòng chọn file và tải lại." },
        { status: 401 },
      );
    }

    const startRaw = req.headers.get("x-chunk-start");
    const endRaw = req.headers.get("x-chunk-end");
    const totalRaw = req.headers.get("x-total-size");

    const start = Number(startRaw);
    const end = Number(endRaw);
    const totalSize = Number(totalRaw);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      !Number.isInteger(totalSize) ||
      start < 0 ||
      end < start ||
      end >= totalSize ||
      totalSize !== session.fileSize
    ) {
      return NextResponse.json(
        { ok: false, error: "Thông số phân mảnh tệp tin (Content-Range) không hợp lệ." },
        { status: 400 },
      );
    }

    const arrayBuf = await req.arrayBuffer();
    const chunkLen = arrayBuf.byteLength;
    if (
      chunkLen !== end - start + 1 ||
      chunkLen > POSTER_UPLOAD_CHUNK_SIZE + 1024
    ) {
      return NextResponse.json(
        { ok: false, error: "Kích thước phân mảnh tải lên không hợp lệ." },
        { status: 400 },
      );
    }

    const chunkBuf = Buffer.from(arrayBuf);

    // Fallback Mode: Buffer <1MB chunks in memory and upload directly via pure DriveApp (no UrlFetchApp needed)
    if (isDirectBuffer && session.directBufferId) {
      appendDirectUploadChunk(session.directBufferId, start, chunkBuf);

      if (end + 1 < totalSize) {
        return NextResponse.json({
          ok: true,
          done: false,
          nextOffset: end + 1,
        });
      }

      try {
        const fullBuffer = consumeDirectUploadBuffer(session.directBufferId);
        if (!fullBuffer || fullBuffer.byteLength !== totalSize) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Dữ liệu phân mảnh chưa đủ trên máy chủ. Vui lòng bấm Tải lên lại.",
            },
            { status: 400 },
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
                "Chỉ hồ sơ đội Vòng 2 đã được Ban tổ chức phê duyệt mới có thể nộp Poster.",
            },
            { status: 400 },
          );
        }

        const leaderMember = profile.members.find((m) => m.isLeader);
        const leaderEmail = leaderMember?.email || authContext.submitter.email;

        const uploadResult = await uploadPosterDirectViaDriveApp({
          referenceCode: authContext.idea.referenceCode,
          ideaTitle: authContext.idea.title,
          leaderEmail,
          targetFileName: session.targetFileName,
          mimeType: session.mimeType,
          fileBuffer: fullBuffer,
          leaderNote: session.note,
        });

        if (!uploadResult.ok || !uploadResult.posterDrive) {
          return NextResponse.json(
            {
              ok: false,
              error:
                uploadResult.error ||
                "Không thể lưu tệp Poster vào Google Drive qua Apps Script.",
            },
            { status: 502 },
          );
        }

        await db.profileHistory.create({
          data: {
            profileId: profile.id,
            ideaId,
            actorId: authContext.submitter.id,
            actorRole: "LEADER",
            action: ProfileHistoryAction.PROFILE_COMPLETED,
            reason: `[POSTER_SUBMITTED] Đã tải Poster trực tiếp lên hệ thống (${session.targetFileName})${
              session.note ? ` — Ghi chú: "${session.note}"` : ""
            }`,
            metadata: {
              eventType: "POSTER_SUBMITTED",
              posterDrive: JSON.parse(JSON.stringify(uploadResult.posterDrive)),
            },
          },
        });

        triggerGoogleSheetsAutoSync("profile:poster-upload");

        return NextResponse.json({
          ok: true,
          done: true,
          message: `Đã tải lên và nộp Poster "${session.targetFileName}" thành công!`,
          posterDrive: uploadResult.posterDrive,
        });
      } finally {
        clearDirectUploadBuffer(session.directBufferId);
      }
    }

    // Primary Mode: Stream chunk directly to Google Drive v3 Resumable Upload URL
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let googleRes: Response;
    try {
      googleRes = await fetch(session.uploadUrl, {
        method: "PUT",
        redirect: "manual",
        headers: {
          "Content-Length": String(chunkLen),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Type": session.mimeType || "application/octet-stream",
        },
        body: chunkBuf,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (googleRes.status === 308) {
      await googleRes.arrayBuffer().catch(() => null);
      const rangeHeader = googleRes.headers.get("range") || "";
      const rangeMatch = /bytes=0-(\d+)/i.exec(rangeHeader);
      const nextOffset = rangeMatch ? Number(rangeMatch[1]) + 1 : end + 1;
      return NextResponse.json({
        ok: true,
        done: false,
        nextOffset,
      });
    }

    if (googleRes.status === 200 || googleRes.status === 201) {
      const driveFile = (await googleRes.json().catch(() => ({}))) as {
        id?: string;
        name?: string;
      };

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
              "Chỉ hồ sơ đội Vòng 2 đã được Ban tổ chức phê duyệt mới có thể nộp Poster.",
          },
          { status: 400 },
        );
      }

      const leaderMember = profile.members.find((m) => m.isLeader);
      const leaderEmail = leaderMember?.email || authContext.submitter.email;

      const finalMeta = await finalizePosterDriveUpload({
        referenceCode: authContext.idea.referenceCode,
        ideaTitle: authContext.idea.title,
        leaderEmail,
        folderId: session.folderId,
        uploadedFileId: driveFile.id || "",
        targetFileName: session.targetFileName,
        leaderNote: session.note,
      });

      await db.profileHistory.create({
        data: {
          profileId: profile.id,
          ideaId,
          actorId: authContext.submitter.id,
          actorRole: "LEADER",
          action: ProfileHistoryAction.PROFILE_COMPLETED,
          reason: `[POSTER_SUBMITTED] Đã tải Poster trực tiếp lên hệ thống (${session.targetFileName})${
            session.note ? ` — Ghi chú: "${session.note}"` : ""
          }`,
          metadata: {
            eventType: "POSTER_SUBMITTED",
            posterDrive: JSON.parse(JSON.stringify(finalMeta)),
          },
        },
      });

      triggerGoogleSheetsAutoSync("profile:poster-upload");

      return NextResponse.json({
        ok: true,
        done: true,
        message: `Đã tải lên và nộp Poster "${session.targetFileName}" thành công!`,
        posterDrive: finalMeta,
      });
    }

    await googleRes.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        error: `Lỗi khi truyền dữ liệu lên Google Drive (HTTP ${googleRes.status}). Vui lòng thử tải lại.`,
      },
      { status: 502 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi tải lên phân mảnh Poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
