"use client";

import React, { useState } from "react";
import { RefreshCw, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoogleSheetsConfig } from "@/lib/google-sheets/sync-service";

interface AdminGoogleSheetsPanelProps {
  initialConfig: GoogleSheetsConfig;
}

export function AdminGoogleSheetsPanel({
  initialConfig,
}: AdminGoogleSheetsPanelProps) {
  const [configOverride, setConfigOverride] =
    useState<GoogleSheetsConfig | null>(null);
  const config = configOverride ?? initialConfig;
  const [syncing, setSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (data.config) setConfigOverride(data.config);
      if (data.ok) {
        setFeedback({
          type: "success",
          text: "Đã đồng bộ Google Sheet!",
        });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Không thể đồng bộ Google Sheet.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Lỗi kết nối khi đồng bộ.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {feedback && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            borderRadius: "var(--radius)",
            fontSize: 12.5,
            fontWeight: 600,
            background:
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
            color: feedback.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          {feedback.text}
        </span>
      )}

      {config.spreadsheetUrl && (
        <a
          href={config.spreadsheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button button-outline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 38,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            borderRadius: "var(--radius)",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={15} />
          Mở Google Sheet
        </a>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={syncing}
        onClick={handleSyncNow}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 38,
          padding: "0 14px",
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <RefreshCw
          size={15}
          style={{
            animation: syncing ? "spin 1s linear infinite" : "none",
          }}
        />
        {syncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
      </Button>
    </div>
  );
}
