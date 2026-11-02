"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retriedOnceRef = useRef(false);

  useEffect(() => {
    console.error("[ApplicationError]", error);
  }, [error]);

  const handleRetry = () => {
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    if (
      /ChunkLoadError|Loading chunk|Failed to fetch|imported module|network/i.test(
        msg,
      ) ||
      retriedOnceRef.current
    ) {
      window.location.reload();
      return;
    }
    retriedOnceRef.current = true;
    reset();
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: 24,
          padding: "40px 30px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 800,
            color: "#ffffff",
            background: "var(--brand-orange)",
            padding: "5px 14px",
            borderRadius: 99,
            marginBottom: 16,
          }}
        >
          ⚡ THỬ THÁCH SÁNG TẠO 4.0 • UTT
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--foreground)",
            marginBottom: 10,
          }}
        >
          Đã xảy ra sự cố tạm thời khi tải nội dung
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--muted)",
            lineHeight: 1.65,
            marginBottom: 26,
          }}
        >
          Hệ thống đang xử lý kết nối hoặc dữ liệu vừa được cập nhật. Bạn vui lòng nhấn
          &ldquo;Thử lại&rdquo; hoặc quay về Trang chủ để tiếp tục.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleRetry}
            className="button button-primary"
            style={{
              height: 42,
              padding: "0 22px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Thử lại ngay
          </button>
          <Link
            href="/"
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 42,
              padding: "0 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Về Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
