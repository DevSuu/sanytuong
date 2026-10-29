"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface AdminExportButtonProps {
  exportUrl: string;
  queryParams?: Record<string, string | undefined | null>;
  filenameDefault?: string;
  label?: string;
  variant?: "outline" | "solid";
  style?: React.CSSProperties;
}

export function AdminExportButton({
  exportUrl,
  queryParams = {},
  filenameDefault = "export.xlsx",
  label = "Xuất Excel",
  variant = "outline",
  style,
}: AdminExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val.trim() !== "") {
          params.set(key, val.trim());
        }
      });

      const queryString = params.toString();
      const fullUrl = queryString ? `${exportUrl}?${queryString}` : exportUrl;

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          alert("Phiên làm việc quản trị đã hết hạn. Vui lòng đăng nhập lại.");
          window.location.href = "/quan-tri/dang-nhap";
          return;
        }

        let errorMessage = "Xuất file thất bại. Vui lòng thử lại sau.";
        try {
          const errorJson = await response.json();
          if (errorJson?.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // Keep default error message
        }

        alert(errorMessage);
        return;
      }

      // Extract filename from Content-Disposition header if available
      const disposition = response.headers.get("content-disposition");
      let filename = filenameDefault;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("[EXPORT_CLIENT_ERROR]", err);
      alert("Đã xảy ra lỗi khi tải xuống file Excel. Vui lòng kiểm tra kết nối mạng.");
    } finally {
      setIsExporting(false);
    }
  };

  const isSolid = variant === "solid";

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      title="Tải toàn bộ kết quả lọc hiện tại ra file Excel (.xlsx)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 38,
        padding: "0 14px",
        borderRadius: "var(--radius)",
        fontSize: 13,
        fontWeight: 600,
        cursor: isExporting ? "not-allowed" : "pointer",
        opacity: isExporting ? 0.7 : 1,
        transition: "all 0.15s ease",
        backgroundColor: isSolid ? "var(--brand-orange)" : "var(--surface)",
        color: isSolid ? "#fff" : "var(--foreground)",
        border: isSolid ? "none" : "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        ...style,
      }}
    >
      {isExporting ? (
        <Loader2 size={15} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
      ) : (
        <FileSpreadsheet size={15} style={{ color: isSolid ? "#fff" : "var(--brand-orange)" }} />
      )}
      <span>{isExporting ? "Đang xuất..." : label}</span>
    </button>
  );
}
