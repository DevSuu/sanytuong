"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  Send,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PosterDriveMetadata } from "@/lib/google-drive/poster-drive-service";
import {
  buildStandardPosterFileName,
  formatPosterFileSize,
  formatVietnamDateTime,
  MAX_POSTER_FILE_SIZE_BYTES,
  POSTER_UPLOAD_CHUNK_SIZE,
} from "@/lib/google-drive/poster-file-utils";

interface StudentPosterDrivePanelProps {
  ideaId: string;
  referenceCode: string;
  lookupToken: string;
  leaderEmail: string;
  initialPosterDrive: PosterDriveMetadata | null;
}

export function StudentPosterDrivePanel({
  ideaId,
  referenceCode,
  lookupToken,
  leaderEmail,
  initialPosterDrive,
}: StudentPosterDrivePanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultFolderName = referenceCode || "IDEA";

  const [uploadedPosterDrive, setUploadedPosterDrive] =
    useState<PosterDriveMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [standardizedName, setStandardizedName] = useState<string>("");
  const [note, setNote] = useState<string>(initialPosterDrive?.leaderNote || "");
  const [uploading, setUploading] = useState(false);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const defaultPosterDrive: PosterDriveMetadata = {
    folderId: null,
    folderName: defaultFolderName,
    rootFolderName: "UTT_POSTER_VONG_2",
    folderUrl: null,
    editorEmail: leaderEmail,
    posterStatus: "WAITING_UPLOAD",
    submittedAt: null,
    leaderNote: null,
    files: [],
    lastCheckedAt: null,
    driveWarning: null,
  };

  const serverLastCheckedMs = initialPosterDrive?.lastCheckedAt
    ? new Date(initialPosterDrive.lastCheckedAt).getTime()
    : 0;
  const localLastCheckedMs = uploadedPosterDrive?.lastCheckedAt
    ? new Date(uploadedPosterDrive.lastCheckedAt).getTime()
    : 0;
  const posterDrive =
    uploadedPosterDrive && localLastCheckedMs >= serverLastCheckedMs
      ? uploadedPosterDrive
      : (initialPosterDrive ?? defaultPosterDrive);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setStandardizedName("");
      return;
    }

    if (file.size <= 0) {
      setSelectedFile(null);
      setStandardizedName("");
      setFeedback({
        type: "error",
        text: "Tệp tin bạn chọn bị rỗng (0 byte). Vui lòng chọn tệp khác.",
      });
      return;
    }

    if (file.size > MAX_POSTER_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setStandardizedName("");
      setFeedback({
        type: "error",
        text: `Dung lượng tệp (${formatPosterFileSize(file.size)}) vượt quá giới hạn 150 MB. Vui lòng nén nhẹ lại rồi thử tải lên.`,
      });
      return;
    }

    const nameCheck = buildStandardPosterFileName(
      file.name,
      file.type,
      referenceCode,
    );
    if (!nameCheck.ok) {
      setSelectedFile(null);
      setStandardizedName("");
      setFeedback({
        type: "error",
        text: nameCheck.error,
      });
      return;
    }

    setSelectedFile(file);
    setStandardizedName(nameCheck.targetFileName);
  };

  const handleUploadPoster = async () => {
    if (!selectedFile) {
      setFeedback({
        type: "error",
        text: "Vui lòng chọn tệp Poster định dạng .PDF từ máy trước khi bấm tải lên.",
      });
      return;
    }

    setUploading(true);
    setUploadedBytes(0);
    setProgressPct(0);
    setFeedback(null);

    try {
      // 1. Initialize Resumable Upload Session via server + Apps Script #2
      const initRes = await fetch(`/api/ideas/${ideaId}/profile/poster`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify({
          action: "INIT_UPLOAD",
          lookupToken,
          originalFileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          note: note.trim() || undefined,
        }),
      });

      const initData = (await initRes.json()) as {
        ok?: boolean;
        error?: string;
        uploadSessionToken?: string;
        targetFileName?: string;
        chunkSize?: number;
      };

      if (!initRes.ok || !initData.ok || !initData.uploadSessionToken) {
        setFeedback({
          type: "error",
          text:
            initData.error ||
            "Không thể khởi tạo phiên tải lên Google Drive. Vui lòng thử lại hoặc báo Ban tổ chức.",
        });
        return;
      }

      const chunkSize = initData.chunkSize || POSTER_UPLOAD_CHUNK_SIZE;
      const totalSize = selectedFile.size;
      let offset = 0;

      // 2. Stream 768 KiB chunks cleanly through chunk proxy -> Google Drive (with per-chunk retry)
      while (offset < totalSize) {
        const end = Math.min(offset + chunkSize, totalSize) - 1;
        const chunkBlob = selectedFile.slice(offset, end + 1);

        let chunkRes: Response | null = null;
        let chunkData: {
          ok?: boolean;
          done?: boolean;
          nextOffset?: number;
          error?: string;
          message?: string;
          posterDrive?: PosterDriveMetadata;
        } = {};
        let chunkSucceeded = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            chunkRes = await fetch(
              `/api/ideas/${ideaId}/profile/poster/chunk`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/octet-stream",
                  "x-lookup-token": lookupToken,
                  "x-upload-session": initData.uploadSessionToken,
                  "x-chunk-start": String(offset),
                  "x-chunk-end": String(end),
                  "x-total-size": String(totalSize),
                },
                body: chunkBlob,
              },
            );

            chunkData = (await chunkRes.json().catch(() => ({}))) as typeof chunkData;

            if (chunkRes.ok && chunkData.ok) {
              chunkSucceeded = true;
              break;
            }

            if (chunkRes.status < 500 || attempt === 3) {
              break;
            }
          } catch (err) {
            if (attempt === 3) {
              throw err;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }

        if (!chunkSucceeded || !chunkRes?.ok || !chunkData.ok) {
          setFeedback({
            type: "error",
            text:
              chunkData.error ||
              "Quá trình truyền tải bị gián đoạn. Vui lòng bấm Tải lên lại.",
          });
          return;
        }

        const nextOffset =
          typeof chunkData.nextOffset === "number"
            ? chunkData.nextOffset
            : end + 1;
        const sentNow = Math.min(totalSize, chunkData.done ? totalSize : nextOffset);
        setUploadedBytes(sentNow);
        setProgressPct(Math.min(100, Math.round((sentNow / totalSize) * 100)));

        if (chunkData.done) {
          if (chunkData.posterDrive) {
            setUploadedPosterDrive(chunkData.posterDrive);
          }
          setSelectedFile(null);
          setStandardizedName("");
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setFeedback({
            type: "success",
            text:
              chunkData.message ||
              `Đã tải lên và nộp Poster "${initData.targetFileName || standardizedName}" thành công!`,
          });
          router.refresh();
          return;
        }

        offset = nextOffset;
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Lỗi kết nối mạng khi tải tệp Poster. Vui lòng kiểm tra kết nối và thử lại.",
      });
    } finally {
      setUploading(false);
    }
  };

  const isSubmitted =
    posterDrive.posterStatus === "SUBMITTED" && posterDrive.files.length > 0;

  return (
    <div
      style={{
        marginTop: 14,
        padding: "clamp(14px, 3.5vw, 20px)",
        borderRadius: 10,
        border: isSubmitted
          ? "1.5px solid rgba(2, 132, 199, 0.45)"
          : "1.5px solid rgba(234, 88, 12, 0.4)",
        background: isSubmitted
          ? "rgba(2, 132, 199, 0.05)"
          : "rgba(234, 88, 12, 0.05)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UploadCloud
            size={20}
            style={{
              color: isSubmitted ? "#0284c7" : "var(--brand-orange)",
              flexShrink: 0,
            }}
          />
          <h5 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>
            NỘP POSTER DỰ THI VÒNG 2
          </h5>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 11px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: isSubmitted
              ? "rgba(2, 132, 199, 0.14)"
              : "rgba(234, 88, 12, 0.14)",
            color: isSubmitted ? "#0284c7" : "var(--brand-orange)",
            border: `1px solid ${
              isSubmitted
                ? "rgba(2, 132, 199, 0.35)"
                : "rgba(234, 88, 12, 0.35)"
            }`,
            whiteSpace: "nowrap",
          }}
        >
          {isSubmitted ? (
            <>
              <CheckCircle2 size={13} />
              Đã nộp Poster
            </>
          ) : (
            <>
              <Clock size={13} />
              Chờ nộp Poster Vòng 2
            </>
          )}
        </span>
      </div>

      {/* Already Submitted Summary Card */}
      {isSubmitted && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--surface)",
            border: "1px solid rgba(2, 132, 199, 0.35)",
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              color: "#0284c7",
              marginBottom: 8,
            }}
          >
            <FileCheck2 size={16} style={{ flexShrink: 0 }} />
            <span>Hệ thống đã ghi nhận Poster Vòng 2 của đội:</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {posterDrive.files.map((f, idx) => (
              <div
                key={f.id || idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <FileText size={15} color="var(--brand-orange)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{f.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {f.size ? formatPosterFileSize(f.size) : ""}
                      {posterDrive.submittedAt
                        ? ` • Nộp lúc ${formatVietnamDateTime(posterDrive.submittedAt)}`
                        : ""}
                    </div>
                  </div>
                </div>

                {f.viewUrl && (
                  <a
                    href={f.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "rgba(2, 132, 199, 0.1)",
                      color: "#0284c7",
                      fontWeight: 600,
                      fontSize: 12,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>Xem lại Poster đã nộp</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>

          {posterDrive.leaderNote && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              Ghi chú đã gửi: &ldquo;{posterDrive.leaderNote}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Direct Web Upload Form */}
      <div
        style={{
          padding: "14px",
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--foreground)" }}>
          {isSubmitted
            ? "Tải lên bản Poster mới (nếu muốn thay thế bản đã nộp)"
            : "Tải tệp Poster trực tiếp lên hệ thống Ban tổ chức"}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 12 }}>
          Chọn tệp Poster định dạng <strong>.PDF</strong> từ máy tính — hệ thống sẽ <strong>tự động đổi tên chuẩn</strong> thành{" "}
          <strong style={{ fontFamily: "monospace", color: "var(--brand-orange)" }}>
            {referenceCode}.pdf
          </strong>{" "}
          và ghi nhận hoàn tất ngay khi tải xong.
        </div>

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />

        {/* Clickable File Picker Zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%",
            padding: "16px 14px",
            borderRadius: 8,
            border: selectedFile
              ? "1.5px solid #0284c7"
              : "1.5px dashed var(--border)",
            background: selectedFile
              ? "rgba(2, 132, 199, 0.05)"
              : "var(--background)",
            cursor: uploading ? "not-allowed" : "pointer",
            textAlign: "center",
            color: "var(--foreground)",
            marginBottom: 12,
          }}
        >
          <UploadCloud
            size={24}
            style={{
              margin: "0 auto 6px",
              color: selectedFile ? "#0284c7" : "var(--brand-orange)",
              display: "block",
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
            {selectedFile
              ? "Bấm để đổi tệp Poster (.PDF) khác"
              : "Bấm vào đây để chọn tệp Poster (.PDF — tối đa 150 MB)"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Định dạng chuẩn .PDF • Dung lượng tối đa 150 MB
          </div>
        </button>

        {/* Selected file preview & Auto-renamed preview */}
        {selectedFile && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(22, 163, 74, 0.06)",
              border: "1px solid rgba(22, 163, 74, 0.3)",
              marginBottom: 12,
              fontSize: 12.5,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              <span style={{ color: "var(--muted)" }}>Tệp đã chọn: </span>
              <strong style={{ overflowWrap: "anywhere" }}>{selectedFile.name}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>
                ({formatPosterFileSize(selectedFile.size)})
              </span>
            </div>
            <div>
              <span style={{ color: "var(--muted)" }}>
                Tên chuẩn hệ thống tự động đổi khi lưu:{" "}
              </span>
              <strong style={{ fontFamily: "monospace", color: "#16a34a" }}>
                {standardizedName}
              </strong>{" "}
              <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 11.5 }}>
                (✓ Tự động chuẩn hóa theo Mã đề tài)
              </span>
            </div>
          </div>
        )}

        {/* Live Upload Progress Bar */}
        {uploading && selectedFile && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 600,
                color: "#0284c7",
                marginBottom: 5,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={12} className="animate-spin" />
                Đang tải lên hệ thống lưu trữ BTC...
              </span>
              <span>
                {progressPct}% ({formatPosterFileSize(uploadedBytes)} /{" "}
                {formatPosterFileSize(selectedFile.size)})
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: "var(--brand-orange)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              background:
                feedback.type === "success"
                  ? "rgba(22, 163, 74, 0.1)"
                  : feedback.type === "info"
                  ? "rgba(2, 132, 199, 0.1)"
                  : "rgba(220, 38, 38, 0.1)",
              border: `1px solid ${
                feedback.type === "success"
                  ? "rgba(22, 163, 74, 0.3)"
                  : feedback.type === "info"
                  ? "rgba(2, 132, 199, 0.3)"
                  : "rgba(220, 38, 38, 0.3)"
              }`,
              color:
                feedback.type === "success"
                  ? "#16a34a"
                  : feedback.type === "info"
                  ? "#0284c7"
                  : "#dc2626",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            ) : feedback.type === "info" ? (
              <Clock size={16} style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Optional note + Submit Button */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thêm cho BTC (tùy chọn)..."
            className="form-input"
            style={{
              flex: "1 1 200px",
              minWidth: 0,
              width: "100%",
              height: 38,
              fontSize: 13,
              padding: "0 10px",
            }}
            disabled={uploading}
          />
          <Button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUploadPoster}
            style={{
              flex: "1 1 auto",
              maxWidth: "100%",
              minHeight: 38,
              height: "auto",
              padding: "8px 16px",
              fontSize: 13,
              lineHeight: 1.35,
              whiteSpace: "normal",
              backgroundColor: "var(--brand-orange)",
              color: "#fff",
            }}
          >
            <Send size={14} style={{ marginRight: 6, flexShrink: 0 }} />
            <span>
              {uploading
                ? `Đang tải lên (${progressPct}%)...`
                : isSubmitted
                ? "Tải bản mới thay thế Poster cũ"
                : "Tải lên & Nộp Poster ngay"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
