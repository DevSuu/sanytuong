"use client";

import React, { useState } from "react";
import {
  Newspaper,
  Plus,
  Upload,
  Trash2,
  Edit3,
  Pin,
  CheckCircle2,
  EyeOff,
  Save,
  X,
} from "lucide-react";
import type {
  NewsCategory,
  NewsPostItem,
  NewsStatus,
} from "@/lib/domain/news-service";

const CATEGORY_OPTIONS: { value: NewsCategory; label: string; badgeBg: string; badgeColor: string }[] = [
  {
    value: "THONG_BAO",
    label: "Thông Báo BTC",
    badgeBg: "rgba(220, 38, 38, 0.14)",
    badgeColor: "#ef4444",
  },
  {
    value: "SU_KIEN",
    label: "Sự Kiện & Workshop",
    badgeBg: "rgba(37, 99, 235, 0.14)",
    badgeColor: "#3b82f6",
  },
  {
    value: "VINH_DANH",
    label: "Vinh Danh & Cố Vấn",
    badgeBg: "rgba(22, 163, 74, 0.14)",
    badgeColor: "#10b981",
  },
];

async function compressImageFile(file: File, maxWidth = 1000, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Định dạng ảnh không hợp lệ."));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AdminNewsfeedClient({
  initialItems,
}: {
  initialItems: NewsPostItem[];
}) {
  const [items, setItems] = useState<NewsPostItem[]>(initialItems);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [thumbLabel, setThumbLabel] = useState("");
  const [category, setCategory] = useState<NewsCategory>("THONG_BAO");
  const [author, setAuthor] = useState("Quản trị viên BTC");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [status, setStatus] = useState<NewsStatus>("PUBLISHED");
  const [imageDataUrl, setImageDataUrl] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSummary("");
    setThumbLabel("");
    setCategory("THONG_BAO");
    setAuthor("Quản trị viên BTC");
    setContent("");
    setIsPinned(false);
    setStatus("PUBLISHED");
    setImageDataUrl("");
  };

  const handleStartEdit = (post: NewsPostItem) => {
    setEditingId(post.id);
    setTitle(post.title);
    setSummary(post.summary || "");
    setThumbLabel(post.thumbLabel || "");
    setCategory(post.category);
    setAuthor(post.author || "Quản trị viên BTC");
    setContent(post.content);
    setIsPinned(post.isPinned);
    setStatus(post.status);
    setImageDataUrl(post.imageUrl || "");
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setImageDataUrl(compressed);
    } catch (err: unknown) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Không thể xử lý ảnh.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFeedback({
        type: "err",
        text: "Vui lòng nhập đầy đủ tiêu đề và nội dung bản tin.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const url = editingId ? `/api/admin/news/${editingId}` : "/api/admin/news";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          thumbLabel,
          category,
          author,
          content,
          isPinned,
          status,
          imageDataUrl: imageDataUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể lưu bản tin.");
      }

      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
      setFeedback({
        type: "ok",
        text: editingId
          ? "Đã cập nhật bản tin thành công!"
          : "Đã đăng bản tin mới lên Trang chủ!",
      });
      if (!editingId) {
        resetForm();
      }
    } catch (err: unknown) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Đã xảy ra lỗi.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTogglePin = async (post: NewsPostItem) => {
    try {
      const res = await fetch(`/api/admin/news/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !post.isPinned }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      // Ignore
    }
  };

  const handleQuickDelete = async (post: NewsPostItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn bản tin "${post.title}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/news/${post.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
        if (editingId === post.id) resetForm();
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1240, paddingBottom: 48 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Newspaper size={28} style={{ color: "var(--brand-orange)" }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
              Quản trị Bảng Tin &amp; Hoạt Động Sáng Tạo
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Đăng bài viết mới, tải ảnh bìa từ máy tính và ghim bản tin tiêu điểm (👑) hiển thị trực tiếp ngay trên Trang chủ.
          </p>
        </div>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="button button-primary"
            style={{ height: 38, padding: "0 16px", fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} /> Soạn bản tin mới
          </button>
        )}
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${feedback.type === "ok" ? "#10b981" : "#ef4444"}`,
            background:
              feedback.type === "ok"
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
            color: feedback.type === "ok" ? "#10b981" : "#ef4444",
            fontWeight: 700,
            fontSize: 13.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", color: "inherit" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: CREATE / EDIT FORM */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              {editingId ? `✏️ Chỉnh sửa bản tin #${editingId}` : "📝 Đăng bản tin mới"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Hủy sửa
              </button>
            )}
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Tiêu đề bản tin *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Phát động Vòng Sơ khảo Mùa 2..."
              className="form-input"
              style={{ width: "100%", height: 40, fontSize: 13.5 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Chuyên mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory)}
                className="form-input"
                style={{ width: "100%", height: 40, fontSize: 13 }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Trạng thái hiển thị
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NewsStatus)}
                className="form-input"
                style={{ width: "100%", height: 40, fontSize: 13 }}
              >
                <option value="PUBLISHED">Xuất bản công khai</option>
                <option value="DRAFT">Bản nháp (Ẩn)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Phụ đề ngắn (Hiển thị dưới tiêu đề)
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="VD: Sự kiện • 26/10/2026 • Hội trường UTT"
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Nhãn ảnh thu nhỏ
              </label>
              <input
                type="text"
                value={thumbLabel}
                onChange={(e) => setThumbLabel(e.target.value)}
                placeholder="VD: Thể lệ Mùa 2"
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Nội dung chi tiết bản tin * (Mỗi dòng sẽ hiển thị trong khung đọc trực tiếp)
            </label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                'Dòng 1: Tiêu đề mở đầu nổi bật\n• Ý chính thứ nhất...\n• Ý chính thứ hai...'
              }
              className="form-input"
              style={{ width: "100%", padding: 12, fontSize: 13.5, lineHeight: 1.55 }}
            />
          </div>

          {/* Image Upload from Computer */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Ảnh minh họa bản tin (Tải từ máy tính)
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px dashed var(--border)",
                background: "var(--background)",
              }}
            >
              {imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageDataUrl}
                  alt="Preview"
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid var(--border)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--muted)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  Chưa chọn
                </div>
              )}

              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={14} /> Chọn ảnh từ máy tính
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                  Hỗ trợ JPG, PNG, WebP. Tự động tối ưu dung lượng khi tải lên.
                </div>
              </div>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: isPinned ? "rgba(242, 92, 5, 0.1)" : "var(--background)",
              border: `1px solid ${isPinned ? "var(--brand-orange)" : "var(--border)"}`,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>👑 Ghim bản tin này lên vị trí Tiêu điểm số 1 trên Trang chủ</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="button button-primary"
            style={{
              height: 44,
              fontSize: 14,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Save size={17} />
            {submitting
              ? "Đang lưu..."
              : editingId
              ? "Lưu cập nhật bản tin"
              : "Đăng bản tin lên Trang chủ"}
          </button>
        </form>

        {/* RIGHT COLUMN: LIST OF EXISTING POSTS */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              📋 Danh sách bản tin ({items.length})
            </h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Đồng bộ tức thì với Trang chủ
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((post, idx) => {
              const catMeta =
                CATEGORY_OPTIONS.find((c) => c.value === post.category) ||
                CATEGORY_OPTIONS[0];

              return (
                <div
                  key={post.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "var(--background)",
                    border: `1.5px solid ${
                      post.isPinned ? "var(--brand-orange)" : "var(--border)"
                    }`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.imageUrl || "/images/traffic-ai.webp"}
                    alt={post.title}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      objectFit: "cover",
                      flexShrink: 0,
                      border: "1px solid var(--border)",
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      {post.isPinned && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            background: "rgba(242, 92, 5, 0.15)",
                            color: "var(--brand-orange)",
                            padding: "2px 8px",
                            borderRadius: 99,
                          }}
                        >
                          👑 Tin ghim
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: catMeta.badgeBg,
                          color: catMeta.badgeColor,
                          padding: "2px 8px",
                          borderRadius: 99,
                        }}
                      >
                        {catMeta.label}
                      </span>
                      {post.status === "PUBLISHED" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#10b981",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <CheckCircle2 size={12} /> Công khai
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--muted)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <EyeOff size={12} /> Bản nháp
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "var(--foreground)",
                        marginBottom: 2,
                      }}
                    >
                      {idx + 1}. {post.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 8,
                      }}
                    >
                      {post.summary}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(post)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--foreground)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Edit3 size={12} /> Sửa
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickTogglePin(post)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--border)",
                          background: post.isPinned
                            ? "rgba(242, 92, 5, 0.14)"
                            : "var(--surface)",
                          color: post.isPinned
                            ? "var(--brand-orange)"
                            : "var(--foreground)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Pin size={12} /> {post.isPinned ? "Bỏ ghim" : "Ghim 👑"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDelete(post)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 7,
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          background: "rgba(239, 68, 68, 0.08)",
                          color: "#ef4444",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 size={12} /> Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
