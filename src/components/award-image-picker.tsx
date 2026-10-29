"use client";
import React, { useRef, useState } from "react";
import { Image as ImageIcon, Upload, Trash2, Check, Sparkles } from "lucide-react";

export interface AwardImagePreset {
  id: string;
  label: string;
  url: string;
  tag: string;
}

export const AWARD_IMAGE_PRESETS: AwardImagePreset[] = [
  {
    id: "traffic-smart-city",
    label: "Giao thông & Đô thị thông minh",
    url: "/images/parking.webp",
    tag: "Giao thông / IoT",
  },
  {
    id: "robotics-automation",
    label: "Robot & Tự động hóa",
    url: "/images/robot.webp",
    tag: "Cơ điện tử / Robot",
  },
  {
    id: "ai-vr-digital",
    label: "AI, VR & Công nghệ thông tin",
    url: "/images/vr.webp",
    tag: "AI / Phần mềm",
  },
  {
    id: "green-energy",
    label: "Năng lượng xanh & Môi trường",
    url: "/images/solar.webp",
    tag: "Năng lượng / Xanh",
  },
  {
    id: "smart-infrastructure",
    label: "Công trình & Hạ tầng số",
    url: "/images/awards/smart-infrastructure.svg",
    tag: "Xây dựng / Cầu đường",
  },
  {
    id: "digital-logistics",
    label: "Kinh tế số & Logistics",
    url: "/images/awards/digital-logistics.svg",
    tag: "Kinh tế / Vận tải",
  },
  {
    id: "award-champion",
    label: "Cúp Vàng — Giải Nhất 4.0",
    url: "/images/awards/award-champion.svg",
    tag: "Vinh danh Giải Nhất",
  },
  {
    id: "award-medal",
    label: "Huy chương Vinh danh Sáng tạo",
    url: "/images/awards/award-medal.svg",
    tag: "Vinh danh Chung",
  },
];

interface AwardImagePickerProps {
  value: string;
  onChange: (newUrl: string) => void;
  label?: string;
}

/**
 * Resize and compress an uploaded image file to WebP/JPEG data URL
 * so it is lightweight (< 120KB) and backed up automatically in PostgreSQL.
 */
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Định dạng ảnh không hợp lệ."));
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 675;
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
        let dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AwardImagePicker({ value, onChange, label }: AwardImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isDataUrl = value.startsWith("data:image/");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Vui lòng chọn file hình ảnh (.jpg, .png, .webp, .svg).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Kích thước ảnh gốc không được vượt quá 15MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const compressedDataUrl = await compressImageFile(file);
      onChange(compressedDataUrl);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Lỗi khi xử lý ảnh tải lên.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        background: "var(--background)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <ImageIcon size={16} style={{ color: "var(--brand-orange)" }} />
          {label || "Ảnh minh họa sản phẩm / Giải thưởng"}
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid var(--brand-orange)",
              background: "rgba(234, 88, 12, 0.08)",
              color: "var(--brand-orange)",
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            <Upload size={13} />
            {uploading ? "Đang xử lý ảnh..." : "Tải ảnh từ máy tính"}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid rgba(239, 68, 68, 0.3)",
                background: "rgba(239, 68, 68, 0.08)",
                color: "#dc2626",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              Xóa ảnh
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div
          style={{
            fontSize: 12,
            color: "#dc2626",
            background: "#fee2e2",
            padding: "6px 10px",
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          {uploadError}
        </div>
      )}

      {/* Preview + URL Input Row */}
      <div
        className="resp-image-picker-row"
        style={{
          marginBottom: 12,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 150,
            height: 86,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(30, 58, 138, 0.15) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Xem trước ảnh giải thưởng"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: 6 }}>
              Chưa chọn ảnh
              <br />
              (Hiện Cúp mặc định)
            </span>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            Hoặc dán đường dẫn ảnh (URL ngoài `https://...` hoặc đường dẫn nội bộ `/images/...`):
          </div>
          <input
            type="text"
            value={isDataUrl ? "[Ảnh đã tải lên từ máy tính]" : value}
            onChange={(e) => {
              if (!isDataUrl) {
                onChange(e.target.value);
              }
            }}
            readOnly={isDataUrl}
            placeholder="VD: /images/robot.jpg hoặc https://..."
            className="form-input"
            style={{
              width: "100%",
              height: 36,
              fontSize: 12,
              background: isDataUrl ? "rgba(22, 163, 74, 0.06)" : "var(--surface)",
              color: isDataUrl ? "#15803d" : "var(--foreground)",
              fontWeight: isDataUrl ? 600 : 400,
            }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Gợi ý: Bạn có thể bấm chọn nhanh 1 trong 8 ảnh minh họa theo chủ đề bên dưới.
          </div>
        </div>
      </div>

      {/* Preset Illustration Gallery */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          <Sparkles size={12} style={{ color: "var(--brand-orange)" }} />
          Kho ảnh minh họa mẫu có sẵn (Click để chọn nhanh):
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap: 8,
          }}
        >
          {AWARD_IMAGE_PRESETS.map((preset) => {
            const isSelected = value === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.url)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                  padding: 5,
                  borderRadius: 8,
                  border: isSelected
                    ? "2px solid var(--brand-orange)"
                    : "1px solid var(--border)",
                  background: isSelected ? "rgba(234, 88, 12, 0.08)" : "var(--surface)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 58,
                    borderRadius: 5,
                    overflow: "hidden",
                    marginBottom: 5,
                    position: "relative",
                    background: "#0f172a",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.url}
                    alt={preset.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--brand-orange)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={11} />
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isSelected ? "var(--brand-orange)" : "var(--foreground)",
                    lineHeight: 1.25,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {preset.label}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{preset.tag}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
