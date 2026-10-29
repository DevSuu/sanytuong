"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AwardStatus } from "@/lib/domain/award-state-machine";

interface AdminAwardActionsProps {
  awardId: string;
  status: AwardStatus;
  seasonStatus: string;
}

export function AdminAwardActions({ awardId, status, seasonStatus }: AdminAwardActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (targetStatus: AwardStatus) => {
    if (targetStatus === AwardStatus.PUBLISHED && seasonStatus !== "PUBLISHED") {
      alert("Không thể xuất bản giải thưởng vì mùa giải chưa được xuất bản (PUBLISHED)!");
      return;
    }

    const actionText =
      targetStatus === AwardStatus.PUBLISHED
        ? "xuất bản công khai"
        : targetStatus === AwardStatus.DRAFT
        ? "chuyển về bản nháp"
        : "lưu trữ";

    if (!confirm(`Bạn có chắc chắn muốn ${actionText} giải thưởng này?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/awards/${awardId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: `Admin changed status to ${targetStatus}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể cập nhật trạng thái");
        return;
      }
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi cập nhật trạng thái");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAward = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn XÓA VĨNH VIỄN giải thưởng này không?\nThao tác này sẽ xóa toàn bộ thông tin giải thưởng và không thể hoàn tác."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/awards/${awardId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể xóa giải thưởng");
        return;
      }
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi xóa giải thưởng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {status === AwardStatus.DRAFT && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange(AwardStatus.PUBLISHED)}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #86efac",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
          title="Xuất bản lên sảnh giải thưởng"
        >
          {loading ? "..." : "Xuất bản"}
        </button>
      )}

      {status === AwardStatus.PUBLISHED && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange(AwardStatus.DRAFT)}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            background: "#fef3c7",
            color: "#854d0e",
            border: "1px solid #fde047",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
          }}
          title="Hạ về bản nháp"
        >
          {loading ? "..." : "Hạ nháp"}
        </button>
      )}

      {status !== AwardStatus.ARCHIVED && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange(AwardStatus.ARCHIVED)}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            cursor: "pointer",
          }}
          title="Lưu trữ giải thưởng"
        >
          {loading ? "..." : "Lưu trữ"}
        </button>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleDeleteAward}
        style={{
          padding: "4px 8px",
          fontSize: 12,
          background: "#fee2e2",
          color: "#b91c1c",
          border: "1px solid #fca5a5",
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 600,
        }}
        title="Xóa vĩnh viễn giải thưởng này"
      >
        {loading ? "..." : "Xóa"}
      </button>
    </div>
  );
}
