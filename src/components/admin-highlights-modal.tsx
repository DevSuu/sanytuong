"use client";
import React, { useState, useRef } from "react";
import { Images, Upload, Trash2, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface HighlightItem {
  id: number;
  title?: string;
  createdAt: string;
  imageUrl: string;
}

async function compressFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Không thể đọc file "${file.name}".`));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error(`Định dạng ảnh "${file.name}" không hợp lệ.`));
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 800;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Trình duyệt không hỗ trợ xử lý ảnh."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL("image/webp", 0.84);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AdminHighlightsModal() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<HighlightItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadHighlights = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/highlights");
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.items || []);
      }
    } catch {
      // Ignore initial load error
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const compressedList: { dataUrl: string; title?: string }[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`File "${file.name}" không phải là hình ảnh.`);
        }
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`Ảnh "${file.name}" vượt quá giới hạn 20MB.`);
        }
        const dataUrl = await compressFileToDataUrl(file);
        compressedList.push({
          dataUrl,
          title: file.name.replace(/\.[^/.]+$/, ""),
        });
      }

      const res = await fetch("/api/admin/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressedList }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không thể tải ảnh lên.");
        return;
      }

      setItems(data.items || []);
      setSuccessMsg(data.message || `Đã tải lên ${compressedList.length} ảnh thành công!`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải ảnh lên.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xóa bức ảnh này khỏi băng chuyền Dấu ấn mùa 1 trên trang chủ?")) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/highlights/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể xóa ảnh.");
        return;
      }
      setItems(data.items || []);
      setSuccessMsg("Đã xóa ảnh thành công.");
      router.refresh();
    } catch {
      setError("Lỗi kết nối khi xóa ảnh.");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setSuccessMsg(null);
          void loadHighlights();
        }}
        style={{
          border: "1px solid var(--brand-orange)",
          color: "var(--brand-orange)",
          background: "rgba(234, 88, 12, 0.08)",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Images size={16} /> Ảnh chạy ngang Dấu ấn mùa 1
      </Button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
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
              borderRadius: 14,
              width: "100%",
              maxWidth: 820,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 14,
                marginBottom: 18,
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Images size={20} style={{ color: "var(--brand-orange)" }} />
                  Quản lý Ảnh chạy ngang &ldquo;Dấu ấn mùa 1&rdquo; (Trang chủ)
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  Tải lên các bức ảnh sự kiện, lễ trao giải hoặc khoảnh khắc đáng nhớ của Mùa 1. Các ảnh này hoàn toàn độc lập
                  với ảnh của từng Giải thưởng và chỉ hiển thị riêng trên dải chạy ngang <strong>Dấu ấn mùa 1</strong> ở Trang chủ.
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
                  padding: 4,
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
                  borderRadius: 8,
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

            {successMsg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#dcfce7",
                  color: "#166534",
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Upload Dropzone / Button */}
            <div
              style={{
                border: "2px dashed var(--brand-orange)",
                borderRadius: 12,
                padding: "20px",
                textAlign: "center",
                background: "rgba(234, 88, 12, 0.05)",
                marginBottom: 22,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                style={{ display: "none" }}
              />
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "var(--brand-orange)",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "10px 20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Upload size={16} />
                {uploading ? "Đang nén & tải ảnh lên..." : "Chọn ảnh từ máy tính (có thể chọn nhiều ảnh cùng lúc)"}
              </Button>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Hỗ trợ JPG, PNG, WebP. Hệ thống tự động tối ưu dung lượng để băng chuyền trang chủ lướt mượt mà.
              </p>
            </div>

            {/* Uploaded Photos Grid */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Danh sách ảnh đã tải lên ({items.length} ảnh):
              </h3>

              {loading ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Đang tải danh sách ảnh...</p>
              ) : items.length === 0 ? (
                <div
                  style={{
                    padding: "24px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: 13,
                  }}
                >
                  Chưa có ảnh riêng nào được tải lên tại đây. Bấm nút <strong>Chọn ảnh từ máy tính</strong> ở trên để tải lên
                  các bức ảnh bạn muốn chạy ngang trên Trang chủ.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                    gap: 14,
                  }}
                >
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                      }}
                    >
                      <div style={{ position: "relative", width: "100%", height: 130, background: "#0f172a" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title || `Ảnh #${idx + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            background: "rgba(15, 23, 42, 0.78)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          #{idx + 1}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: "8px 10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid #fca5a5",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
