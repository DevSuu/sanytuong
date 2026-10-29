"use client";
import React, { useState } from "react";
import { Plus, X, AlertCircle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { AwardImagePicker } from "@/components/award-image-picker";

export function AdminCreateTaskModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [orderingOrganization, setOrderingOrganization] = useState("");
  const [category, setCategory] = useState("");
  const [reward, setReward] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [executionDeadline, setExecutionDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "OPEN">("DRAFT");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title,
        orderingOrganization,
        description,
        requirements: requirements || null,
        reward: reward || null,
        category: category || null,
        imageUrl: imageUrl || null,
        status,
      };

      if (slug.trim()) payload.slug = slug.trim();
      if (applicationDeadline) {
        payload.applicationDeadline = new Date(applicationDeadline).toISOString();
      }
      if (executionDeadline) {
        payload.executionDeadline = new Date(executionDeadline).toISOString();
      }

      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể tạo nhiệm vụ.");
        return;
      }

      setIsOpen(false);
      // Reset form
      setTitle("");
      setSlug("");
      setOrderingOrganization("");
      setCategory("");
      setReward("");
      setApplicationDeadline("");
      setExecutionDeadline("");
      setDescription("");
      setRequirements("");
      setImageUrl("");
      setStatus("DRAFT");

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi mạng khi tạo nhiệm vụ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        style={{
          background: "var(--brand-orange)",
          color: "#fff",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Plus size={16} /> Tạo nhiệm vụ mới
      </Button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 28,
              position: "relative",
            }}
          >
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 16px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Briefcase size={20} style={{ color: "var(--brand-orange)" }} />
              Khởi tạo nhiệm vụ đặt hàng mới
            </h2>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(220, 38, 38, 0.1)",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                  color: "#dc2626",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Tiêu đề nhiệm vụ *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Xây dựng hệ thống giám sát hành trình xe buýt thông minh"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div className="resp-grid-2">
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Đơn vị đặt hàng *
                    </label>
                    <input
                      type="text"
                      required
                      value={orderingOrganization}
                      onChange={(e) => setOrderingOrganization(e.target.value)}
                      placeholder="VD: Công ty Vận tải Hà Nội / Khoa CNTT"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Lĩnh vực / Chuyên đề
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="VD: IoT & Smart City / AI"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                <div className="resp-grid-3">
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Giải thưởng / Tài trợ
                    </label>
                    <input
                      type="text"
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      placeholder="VD: 25.000.000 VNĐ"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Hạn chót đăng ký
                    </label>
                    <input
                      type="date"
                      value={applicationDeadline}
                      onChange={(e) => setApplicationDeadline(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Hạn hoàn thành
                    </label>
                    <input
                      type="date"
                      value={executionDeadline}
                      onChange={(e) => setExecutionDeadline(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                <AwardImagePicker
                  label="Ảnh bìa minh họa Nhiệm vụ đặt hàng"
                  value={imageUrl}
                  onChange={setImageUrl}
                />

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Mô tả bài toán / Mục tiêu *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả chi tiết bài toán thực tế, bối cảnh và mục tiêu cần giải quyết..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Yêu cầu kỹ thuật & Sản phẩm bàn giao
                  </label>
                  <textarea
                    rows={3}
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="Yêu cầu công nghệ, chuẩn dữ liệu, thiết bị phần cứng, tài liệu kỹ thuật..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div className="resp-grid-2">
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Đường dẫn tĩnh (Slug - Để trống sẽ tự sinh)
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="giam-sat-xe-buyt-thong-minh"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Trạng thái ban đầu
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "DRAFT" | "OPEN")}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    >
                      <option value="DRAFT">Bản nháp (DRAFT) — Chưa công bố</option>
                      <option value="OPEN">Mở đăng ký (OPEN) — Hiển thị ngay ở Sảnh nhiệm vụ</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 10,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 16,
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    style={{ background: "var(--brand-orange)", color: "#fff" }}
                  >
                    {loading ? "Đang tạo..." : "Lưu và khởi tạo nhiệm vụ"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
