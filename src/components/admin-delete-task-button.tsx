"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface AdminDeleteTaskButtonProps {
  taskId: string;
  taskTitle: string;
  applicationsCount: number;
}

export function AdminDeleteTaskButton({
  taskId,
  taskTitle,
  applicationsCount,
}: AdminDeleteTaskButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const msg =
      applicationsCount > 0
        ? `Nhiệm vụ "${taskTitle}" đang có ${applicationsCount} đơn đăng ký.\nBạn có chắc chắn muốn XÓA VĨNH VIỄN nhiệm vụ này cùng các đơn đăng ký liên quan không?`
        : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN nhiệm vụ "${taskTitle}" không?`;
    if (!confirm(`${msg}\nThao tác này không thể hoàn tác.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể xóa nhiệm vụ.");
        return;
      }
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi xóa nhiệm vụ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDelete}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 10px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        border: "1px solid #fca5a5",
        background: "#fee2e2",
        color: "#b91c1c",
        cursor: loading ? "wait" : "pointer",
      }}
      title="Xóa vĩnh viễn nhiệm vụ này"
    >
      <Trash2 size={13} />
      <span>{loading ? "..." : "Xóa"}</span>
    </button>
  );
}
