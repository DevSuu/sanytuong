"use client";

import React from "react";
import { validateSmartEmail } from "@/lib/validation/email-validator";

export interface EmailTypoSuggestionProps {
  email: string;
  onAccept: (correctedEmail: string) => void;
  style?: React.CSSProperties;
}

export function EmailTypoSuggestion({
  email,
  onAccept,
  style,
}: EmailTypoSuggestionProps) {
  const trimmed = (email || "").trim();
  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }

  const check = validateSmartEmail(trimmed);
  if (check.valid || !check.suggestion) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 12px",
        borderRadius: 6,
        backgroundColor: "#fffbeb",
        border: "1px solid #fcd34d",
        fontSize: 12.5,
        color: "#92400e",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <span>
        ⚠️ Phát hiện lỗi gõ nhầm tên miền email. Ý của bạn có phải là{" "}
        <strong>{check.suggestion}</strong>?
      </span>
      <button
        type="button"
        onClick={() => onAccept(check.suggestion!)}
        style={{
          padding: "3px 10px",
          borderRadius: 4,
          backgroundColor: "#d97706",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Sửa ngay
      </button>
    </div>
  );
}
