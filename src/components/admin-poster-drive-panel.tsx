"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  RefreshCw,
  ExternalLink,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Settings,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  PosterDriveMetadata,
  PosterDriveConfig,
} from "@/lib/google-drive/poster-drive-service";
import {
  formatVietnamDateTime,
  isValidPosterFileName,
} from "@/lib/google-drive/poster-file-utils";

interface AdminPosterDrivePanelProps {
  profileId: string;
  referenceCode: string;
  leaderEmail: string;
  initialPosterDrive: PosterDriveMetadata;
}

export function AdminPosterDrivePanel({
  profileId,
  referenceCode,
  leaderEmail,
  initialPosterDrive,
}: AdminPosterDrivePanelProps) {
  const router = useRouter();
  const [posterDrive, setPosterDrive] =
    useState<PosterDriveMetadata>(initialPosterDrive);
  const [loading, setLoading] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Isolated Webhook Configuration State (collapsed by default since default webhook is built in)
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [rootFolderName, setRootFolderName] = useState(
    initialPosterDrive.rootFolderName || "UTT_POSTER_VONG_2",
  );
  const [useTestSuffix, setUseTestSuffix] = useState(false);
  const [appsScriptCode, setAppsScriptCode] = useState("");

  useEffect(() => {
    fetch(`/api/admin/profiles/${profileId}/poster`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.config) {
          const cfg = data.config as PosterDriveConfig;
          setWebhookUrl(cfg.webhookUrl || "");
          setRootFolderName(cfg.rootFolderName || "UTT_POSTER_VONG_2");
          setUseTestSuffix(cfg.useTestSuffix ?? false);
        }
        if (data.appsScriptCode) {
          setAppsScriptCode(data.appsScriptCode);
        }
      })
      .catch(() => {});
  }, [profileId]);

  const handleSyncDrive = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/poster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SYNC_DRIVE" }),
      });
      const data = await res.json();
      if (data.posterDrive) {
        setPosterDrive(data.posterDrive);
      }
      if (!res.ok || !data.ok) {
        setFeedback({
          type: "error",
          text:
            data.message ||
            data.error ||
            "Chưa đồng bộ được thư mục Google Drive.",
        });
      } else {
        setFeedback({
          type: "success",
          text: data.message || "Đã đồng bộ thư mục Google Drive!",
        });
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Lỗi kết nối khi đồng bộ thư mục Google Drive.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfigAndSync = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/poster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_CONFIG_AND_SYNC",
          webhookUrl: webhookUrl.trim(),
          rootFolderName: rootFolderName.trim(),
          useTestSuffix,
        }),
      });
      const data = await res.json();
      if (data.posterDrive) {
        setPosterDrive(data.posterDrive);
      }
      if (!res.ok || !data.ok) {
        setFeedback({
          type: "error",
          text:
            data.message ||
            data.error ||
            "Đã lưu cấu hình nhưng chưa tạo được thư mục Drive.",
        });
      } else {
        setFeedback({
          type: "success",
          text:
            data.message ||
            "Đã lưu cấu hình Webhook Drive riêng và khởi tạo thư mục thành công!",
        });
        setShowConfigPanel(false);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Lỗi kết nối khi lưu cấu hình Webhook Drive.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyStandaloneScript = async () => {
    try {
      let code = appsScriptCode;
      if (!code) {
        const res = await fetch(`/api/admin/profiles/${profileId}/poster`);
        const data = await res.json();
        code = data.appsScriptCode || "";
        setAppsScriptCode(code);
      }
      if (code) {
        await navigator.clipboard.writeText(code);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 4000);
      }
    } catch {
      alert("Không thể copy tự động. Vui lòng thử lại.");
    }
  };

  const isSubmitted =
    posterDrive.posterStatus === "SUBMITTED" || posterDrive.files.length > 0;
  const safeSelectedIndex =
    selectedFileIndex < posterDrive.files.length ? selectedFileIndex : 0;
  const activeFile = posterDrive.files[safeSelectedIndex];

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "clamp(16px, 3.5vw, 22px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FolderOpen size={18} color="var(--brand-orange)" />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            Poster &amp; Tài liệu dự thi Vòng 2 (Google Drive)
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            style={{ height: 30, fontSize: 12 }}
          >
            <Settings size={13} style={{ marginRight: 5 }} />
            {showConfigPanel ? "Ẩn cấu hình Webhook" : "Cấu hình Webhook Drive riêng"}
          </Button>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 11px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              background: isSubmitted
                ? "rgba(2, 132, 199, 0.14)"
                : "rgba(217, 119, 6, 0.12)",
              color: isSubmitted ? "#0284c7" : "#d97706",
              border: `1px solid ${
                isSubmitted
                  ? "rgba(2, 132, 199, 0.35)"
                  : "rgba(217, 119, 6, 0.3)"
              }`,
            }}
          >
            {isSubmitted ? (
              <>
                <CheckCircle2 size={13} />
                Đã nộp Poster ({posterDrive.files.length} tệp)
              </>
            ) : (
              <>
                <Clock size={13} />
                Chờ đội tải Poster lên Drive
              </>
            )}
          </span>
        </div>
      </div>

      {/* Isolated Webhook Config Panel */}
      {showConfigPanel && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(2, 132, 199, 0.06)",
            border: "1px solid rgba(2, 132, 199, 0.3)",
            fontSize: 12.5,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <strong style={{ color: "#0284c7", fontSize: 13 }}>
                ⚙️ Cấu hình Webhook Google Drive Poster (Độc lập 100% với Google Sheets)
              </strong>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>
                Tạo 1 dự án mới trên{" "}
                <a
                  href="https://script.google.com/home"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0284c7", textDecoration: "underline" }}
                >
                  script.google.com/home
                </a>{" "}
                bằng mã bên phải, bấm Triển khai (Web App - Anyone) và dán URL vào dưới đây:
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyStandaloneScript}
              style={{ height: 32, fontSize: 12, flexShrink: 0 }}
            >
              {copiedScript ? (
                <>
                  <Check size={13} style={{ marginRight: 5, color: "#16a34a" }} />
                  Đã copy mã Script Drive!
                </>
              ) : (
                <>
                  <Copy size={13} style={{ marginRight: 5 }} />
                  Copy mã Apps Script (Chỉ dùng cho Drive)
                </>
              )}
            </Button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
                URL Web App của dự án Apps Script Drive *
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="form-input"
                style={{ width: "100%", height: 36, fontSize: 12.5, padding: "0 10px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
                Tên thư mục gốc trên Google Drive
              </label>
              <input
                type="text"
                value={rootFolderName}
                onChange={(e) => setRootFolderName(e.target.value)}
                placeholder="UTT_POSTER_VONG_2"
                className="form-input"
                style={{ width: "100%", height: 36, fontSize: 12.5, padding: "0 10px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={useTestSuffix}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseTestSuffix(checked);
                    if (checked && rootFolderName === "UTT_POSTER_VONG_2") {
                      setRootFolderName("UTT_POSTER_VONG_2_TEST");
                    } else if (!checked && rootFolderName === "UTT_POSTER_VONG_2_TEST") {
                      setRootFolderName("UTT_POSTER_VONG_2");
                    }
                  }}
                />
                <span>
                  Thêm hậu tố <strong>_TEST</strong> vào tên thư mục đề tài ({referenceCode}_TEST)
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              size="sm"
              disabled={loading || !webhookUrl.trim()}
              onClick={handleSaveConfigAndSync}
              style={{ backgroundColor: "#0284c7", color: "#fff", fontSize: 12.5 }}
            >
              <Save size={13} style={{ marginRight: 6 }} />
              {loading ? "Đang lưu & Tạo thư mục..." : "Lưu cấu hình & Tạo thư mục Drive ngay"}
            </Button>
          </div>
        </div>
      )}

      {/* Folder & Permission Info Box */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          background: "var(--background)",
          border: "1px solid var(--border)",
          fontSize: 13,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div>
              <span style={{ color: "var(--muted)" }}>Tên thư mục Drive: </span>
              <strong style={{ fontFamily: "monospace", color: "var(--brand-orange)" }}>
                {posterDrive.folderName || referenceCode}
              </strong>{" "}
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                (Thư mục gốc: {posterDrive.rootFolderName})
              </span>
            </div>
            <div>
              <span style={{ color: "var(--muted)" }}>
                Email Trưởng nhóm nộp bài:{" "}
              </span>
              <strong>{posterDrive.editorEmail || leaderEmail}</strong>
            </div>
            {posterDrive.submittedAt && (
              <div>
                <span style={{ color: "var(--muted)" }}>Thời điểm xác nhận nộp: </span>
                <strong>
                  {formatVietnamDateTime(posterDrive.submittedAt)}
                </strong>
              </div>
            )}
            {posterDrive.leaderNote && (
              <div style={{ marginTop: 4, fontStyle: "italic" }}>
                <span style={{ color: "var(--muted)" }}>Ghi chú của nhóm: </span>
                &ldquo;{posterDrive.leaderNote}&rdquo;
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {posterDrive.folderUrl && (
              <a
                href={posterDrive.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  padding: "0 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  backgroundColor: "var(--brand-orange)",
                  color: "#fff",
                  borderRadius: "var(--radius)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={14} />
                Mở thư mục Drive ({posterDrive.folderName})
              </a>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleSyncDrive}
              style={{ height: 34, fontSize: 12.5 }}
            >
              <RefreshCw
                size={13}
                className={loading ? "animate-spin" : undefined}
                style={{
                  marginRight: 6,
                }}
              />
              {loading
                ? "Đang kiểm tra Drive..."
                : posterDrive.folderUrl
                ? "Kiểm tra lại thư mục Drive"
                : "Tạo & Lấy link thư mục Drive"}
            </Button>
          </div>
        </div>
      </div>

      {/* Feedback or Drive Warning */}
      {(feedback || posterDrive.driveWarning) && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 12.5,
            background:
              feedback?.type === "success"
                ? "rgba(22, 163, 74, 0.1)"
                : "rgba(217, 119, 6, 0.1)",
            border: `1px solid ${
              feedback?.type === "success"
                ? "rgba(22, 163, 74, 0.3)"
                : "rgba(217, 119, 6, 0.3)"
            }`,
            color: feedback?.type === "success" ? "#16a34a" : "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px" }}>
            {feedback?.type === "success" ? (
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            )}
            <span>{feedback ? feedback.text : posterDrive.driveWarning}</span>
          </div>
        </div>
      )}

      {/* Uploaded Files & Direct Preview */}
      {posterDrive.files.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
            DANH SÁCH TỆP TIN TRONG THƯ MỤC ({posterDrive.files.length}):
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {posterDrive.files.map((file, idx) => {
              const isSelected = idx === safeSelectedIndex;
              const validName = isValidPosterFileName(file.name, referenceCode);
              return (
                <div
                  key={file.id || idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: isSelected
                      ? "1.5px solid var(--brand-orange)"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? "rgba(242, 92, 5, 0.08)"
                      : "var(--background)",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedFileIndex(idx)}
                >
                  <FileText size={14} color="var(--brand-orange)" />
                  <span style={{ fontWeight: 600 }}>{file.name}</span>
                  {file.size ? (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      ({formatFileSize(file.size)})
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: validName
                        ? "rgba(22, 163, 74, 0.12)"
                        : "rgba(220, 38, 38, 0.12)",
                      color: validName ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {validName ? "✓ Đúng tên mã" : `⚠️ Chưa đúng mã ${referenceCode}`}
                  </span>
                  <a
                    href={file.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: "#0284c7",
                      display: "inline-flex",
                      alignItems: "center",
                      marginLeft: 4,
                    }}
                    title="Mở trên Google Drive"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              );
            })}
          </div>

          {activeFile?.previewUrl && (
            <div
              style={{
                marginTop: 4,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "#0f172a",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--background)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <span>
                  Xem trước trực tiếp: <strong>{activeFile.name}</strong>
                </span>
                <a
                  href={activeFile.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--brand-orange)",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Mở toàn màn hình trên Drive <ExternalLink size={12} />
                </a>
              </div>
              <iframe
                src={activeFile.previewUrl}
                title={`Xem trước Poster ${activeFile.name}`}
                style={{
                  width: "100%",
                  height: 520,
                  border: "none",
                  display: "block",
                }}
                allow="autoplay"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "18px 16px",
            borderRadius: 8,
            border: "1px dashed var(--border)",
            textAlign: "center",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Hiện chưa có tệp Poster nào trong thư mục Google Drive của đội. Khi sinh viên tải tệp Poster (.PDF) lên từ trang Tra cứu (hoặc khi BTC bấm{" "}
          <strong>Kiểm tra lại thư mục Drive</strong>), danh sách tệp và bản xem trước sẽ hiển thị ngay tại đây.
        </div>
      )}
    </div>
  );
}
