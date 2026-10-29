"use client";
import React, { useState } from "react";
import { Plus, X, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { AwardSeasonStatus } from "@/lib/domain/award-state-machine";

interface SeasonItem {
  id: string;
  name: string;
  slug: string;
  status: AwardSeasonStatus;
  isDemo: boolean;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  _count?: { awards: number };
}

interface AdminSeasonModalProps {
  seasons: SeasonItem[];
}

export function AdminSeasonModal({ seasons }: AdminSeasonModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New season form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<AwardSeasonStatus>(AwardSeasonStatus.DRAFT);
  const [isDemo, setIsDemo] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name,
        description: description || null,
        status,
        isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();

      const res = await fetch("/api/admin/award-seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể tạo mùa giải.");
        return;
      }

      // Reset
      setName("");
      setSlug("");
      setDescription("");
      setStatus(AwardSeasonStatus.DRAFT);
      setIsDemo(false);
      setStartDate("");
      setEndDate("");

      router.refresh();
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối khi tạo mùa giải.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (seasonId: string, newStatus: AwardSeasonStatus) => {
    if (!confirm(`Bạn có chắc muốn chuyển trạng thái mùa giải sang "${newStatus}"?`)) return;
    try {
      const res = await fetch(`/api/admin/award-seasons/${seasonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Lỗi cập nhật trạng thái mùa giải");
        return;
      }
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi cập nhật");
    }
  };

  const handleDeleteSeason = async (seasonId: string, seasonName: string, awardsCount: number) => {
    const warning =
      awardsCount > 0
        ? `Bạn có chắc chắn muốn XÓA VĨNH VIỄN mùa giải "${seasonName}" cùng toàn bộ ${awardsCount} giải thưởng thuộc mùa giải này không?\nThao tác này không thể hoàn tác.`
        : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN mùa giải "${seasonName}" không?`;
    if (!confirm(warning)) return;

    try {
      const res = await fetch(`/api/admin/award-seasons/${seasonId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Lỗi khi xóa mùa giải");
        return;
      }
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi xóa mùa giải");
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        style={{
          border: "1px solid var(--border)",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Calendar size={16} /> Quản lý Mùa giải ({seasons.length})
      </Button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 12,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Quản lý Mùa giải (Award Seasons)
                </h2>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Danh sách mùa giải và tạo mới mùa giải phục vụ vinh danh giải thưởng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Existing Seasons List */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                Các mùa giải hiện có:
              </h3>
              {seasons.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Chưa có mùa giải nào.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {seasons.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{s.name}</span>
                          <code style={{ fontSize: 11, background: "var(--surface)", padding: "2px 6px", borderRadius: 4, color: "var(--muted)" }}>
                            {s.slug}
                          </code>
                          {s.isDemo && (
                            <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              Demo
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {s._count?.awards || 0} giải thưởng • Trạng thái:{" "}
                          <strong style={{ color: s.status === "PUBLISHED" ? "#16a34a" : "#ca8a04" }}>
                            {s.status}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        {s.status !== "PUBLISHED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(s.id, AwardSeasonStatus.PUBLISHED)}
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
                          >
                            Xuất bản
                          </button>
                        )}
                        {s.status === "PUBLISHED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(s.id, AwardSeasonStatus.DRAFT)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              background: "#fef3c7",
                              color: "#854d0e",
                              border: "1px solid #fde047",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Hạ nháp
                          </button>
                        )}
                        {s.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(s.id, AwardSeasonStatus.ARCHIVED)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Lưu trữ
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSeason(s.id, s.name, s._count?.awards || 0)}
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
                          title="Xóa mùa giải này"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Season Form */}
            <form onSubmit={handleCreateSeason} style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={16} /> Thêm mùa giải mới:
              </h3>

              <div className="resp-grid-2" style={{ marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Tên mùa giải <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Season 1 — Thử thách sáng tạo 4.0"
                    className="form-input"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Slug URL (để trống sẽ tự sinh)
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="VD: season-1"
                    className="form-input"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Mô tả mùa giải
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Giới thiệu sơ lược về mùa giải..."
                  className="form-input"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px" }}
                />
              </div>

              <div className="resp-grid-3" style={{ marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Trạng thái khởi tạo
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AwardSeasonStatus)}
                    className="form-input"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  >
                    <option value={AwardSeasonStatus.DRAFT}>Bản nháp (DRAFT)</option>
                    <option value={AwardSeasonStatus.PUBLISHED}>Công bố (PUBLISHED)</option>
                    <option value={AwardSeasonStatus.ARCHIVED}>Lưu trữ (ARCHIVED)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  id="seasonIsDemo"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                />
                <label htmlFor="seasonIsDemo" style={{ fontSize: 13, cursor: "pointer" }}>
                  Đánh dấu là dữ liệu Demo / Dữ liệu minh họa (isDemo = true)
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "var(--brand-orange)",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                >
                  {loading ? "Đang tạo..." : "Lưu mùa giải"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
