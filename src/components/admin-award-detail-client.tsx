"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award as AwardIcon,
  CheckCircle2,
  AlertCircle,
  History,
  Trash2,
  UserPlus,
  ExternalLink,
  Save,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AwardStatus,
  AWARD_STATUS_LABELS,
  AWARD_STATUS_BADGES,
  SEASON_STATUS_BADGES,
} from "@/lib/domain/award-state-machine";
import { AwardImagePicker } from "@/components/award-image-picker";

interface MemberItem {
  id?: string;
  fullName: string;
  role?: string | null;
  studentCode?: string | null;
  className?: string | null;
  displayOrder: number;
}

interface HistoryItem {
  id: string;
  action: string;
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: unknown;
  createdAt: string | Date;
}

interface AwardDetail {
  id: string;
  seasonId: string;
  title: string;
  slug: string;
  awardName: string;
  category?: string | null;
  organization?: string | null;
  shortDescription?: string | null;
  description: string;
  imageUrl?: string | null;
  displayOrder: number;
  status: AwardStatus;
  isDemo: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  season: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  members: MemberItem[];
  history: HistoryItem[];
}

interface AdminAwardDetailClientProps {
  award: AwardDetail;
  seasons: { id: string; name: string; status: string }[];
}

export function AdminAwardDetailClient({ award, seasons }: AdminAwardDetailClientProps) {
  const router = useRouter();

  // Form State
  const [seasonId, setSeasonId] = useState(award.seasonId);
  const [title, setTitle] = useState(award.title);
  const [slug, setSlug] = useState(award.slug);
  const [awardName, setAwardName] = useState(award.awardName);
  const [category, setCategory] = useState(award.category || "");
  const [organization, setOrganization] = useState(award.organization || "");
  const [shortDescription, setShortDescription] = useState(award.shortDescription || "");
  const [description, setDescription] = useState(award.description);
  const [imageUrl, setImageUrl] = useState(award.imageUrl || "");
  const [displayOrder, setDisplayOrder] = useState(award.displayOrder);
  const [isDemo, setIsDemo] = useState(award.isDemo);
  const [members, setMembers] = useState<MemberItem[]>(award.members || []);

  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status Badge
  const statusBadge = AWARD_STATUS_BADGES[award.status] || {
    bg: "#f1f5f9",
    color: "#334155",
    border: "#cbd5e1",
  };
  const seasonBadge = SEASON_STATUS_BADGES[award.season.status as keyof typeof SEASON_STATUS_BADGES] || {
    bg: "#f1f5f9",
    color: "#334155",
    border: "#cbd5e1",
  };

  // Member management
  const addMember = () => {
    setMembers([
      ...members,
      {
        fullName: "",
        role: members.length === 0 ? "Trưởng nhóm" : "Thành viên",
        studentCode: "",
        className: "",
        displayOrder: members.length,
      },
    ]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof MemberItem, val: string | number) => {
    const next = [...members];
    next[index] = { ...next[index], [field]: val };
    setMembers(next);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        seasonId,
        title,
        slug: slug.trim(),
        awardName,
        category: category.trim() || null,
        organization: organization.trim() || null,
        shortDescription,
        description,
        imageUrl: imageUrl.trim() || null,
        displayOrder: Number(displayOrder) || 0,
        isDemo,
        members: members
          .filter((m) => m.fullName.trim().length > 0)
          .map((m, idx) => ({
            fullName: m.fullName.trim(),
            role: m.role?.trim() || null,
            studentCode: m.studentCode?.trim() || null,
            className: m.className?.trim() || null,
            displayOrder: idx,
          })),
      };

      const res = await fetch(`/api/admin/awards/${award.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Không thể cập nhật thông tin giải thưởng." });
        return;
      }

      setMessage({ type: "success", text: "Đã lưu thay đổi thành công!" });
      router.refresh();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi mạng khi lưu thay đổi.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Status transitions
  const handleStatusChange = async (targetStatus: AwardStatus) => {
    if (targetStatus === AwardStatus.PUBLISHED && award.season.status !== "PUBLISHED") {
      alert("Không thể xuất bản giải thưởng vì mùa giải chưa được xuất bản (PUBLISHED)!");
      return;
    }

    const actionText =
      targetStatus === AwardStatus.PUBLISHED
        ? "xuất bản"
        : targetStatus === AwardStatus.DRAFT
        ? "chuyển về bản nháp"
        : "lưu trữ";

    const reason = prompt(`Nhập lý do ${actionText} giải thưởng:`, `Admin chuyển sang ${targetStatus}`);
    if (reason === null) return;

    setStatusChanging(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/awards/${award.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: reason.trim() || `Admin changed status to ${targetStatus}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Không thể đổi trạng thái." });
        return;
      }

      setMessage({ type: "success", text: `Đã chuyển trạng thái sang ${AWARD_STATUS_LABELS[targetStatus]}!` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối khi đổi trạng thái." });
    } finally {
      setStatusChanging(false);
    }
  };

  const handleDeleteAward = async () => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn XÓA VĨNH VIỄN giải thưởng "${award.title}" không?\nThao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }

    setStatusChanging(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/awards/${award.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Không thể xóa giải thưởng." });
        setStatusChanging(false);
        return;
      }

      router.push("/quan-tri/giai-thuong");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối khi xóa giải thưởng." });
      setStatusChanging(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1140, paddingBottom: 60 }}>
      {/* Top navigation */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/quan-tri/giai-thuong"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Quay lại danh sách Giải thưởng
        </Link>
      </div>

      {/* Header Banner */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                background: "rgba(234, 88, 12, 0.12)",
                color: "var(--brand-orange)",
                border: "1px solid rgba(234, 88, 12, 0.25)",
              }}
            >
              {award.awardName}
            </span>

            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: statusBadge.bg,
                color: statusBadge.color,
                border: `1px solid ${statusBadge.border}`,
              }}
            >
              {AWARD_STATUS_LABELS[award.status]}
            </span>

            {award.isDemo ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#fef3c7",
                  color: "#b45309",
                  border: "1px solid #fde047",
                }}
              >
                Demo / Minh họa
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#ecfdf5",
                  color: "#047857",
                  border: "1px solid #a7f3d0",
                }}
              >
                Chính thức
              </span>
            )}

            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                background: seasonBadge.bg,
                color: seasonBadge.color,
                border: `1px solid ${seasonBadge.border}`,
              }}
            >
              Mùa giải: {award.season.name} ({award.season.status})
            </span>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 4px" }}>{award.title}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Slug: <code>{award.slug}</code> • Tạo lúc:{" "}
            {new Date(award.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>

        {/* Quick status transitions & actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {award.status !== AwardStatus.PUBLISHED && (
            <Button
              type="button"
              disabled={statusChanging}
              onClick={() => handleStatusChange(AwardStatus.PUBLISHED)}
              style={{
                background: "#16a34a",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                height: 36,
              }}
            >
              <Globe size={15} style={{ marginRight: 6 }} /> Xuất bản công khai
            </Button>
          )}

          {award.status === AwardStatus.PUBLISHED && (
            <Button
              type="button"
              variant="outline"
              disabled={statusChanging}
              onClick={() => handleStatusChange(AwardStatus.DRAFT)}
              style={{
                fontSize: 13,
                height: 36,
                color: "#854d0e",
                borderColor: "#fde047",
                background: "#fefce8",
              }}
            >
              Hạ về bản nháp
            </Button>
          )}

          {award.status !== AwardStatus.ARCHIVED && (
            <Button
              type="button"
              variant="outline"
              disabled={statusChanging}
              onClick={() => handleStatusChange(AwardStatus.ARCHIVED)}
              style={{
                fontSize: 13,
                height: 36,
                color: "#475569",
              }}
            >
              Lưu trữ
            </Button>
          )}

          {award.status === AwardStatus.PUBLISHED && award.season.status === "PUBLISHED" && (
            <Link
              href={`/san-giai-thuong/${award.slug}`}
              target="_blank"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                color: "var(--foreground)",
                background: "var(--background)",
              }}
            >
              <ExternalLink size={14} /> Xem trang công khai
            </Link>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={statusChanging}
            onClick={handleDeleteAward}
            style={{
              fontSize: 13,
              height: 36,
              color: "#b91c1c",
              borderColor: "#fca5a5",
              background: "#fee2e2",
              fontWeight: 600,
            }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Xóa giải thưởng
          </Button>
        </div>
      </div>

      {/* Notification banner */}
      {message && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Form on Left (8 cols) and Audit History on Right (4 cols) */}
      <div className="resp-admin-split">
        {/* Form Container */}
        <form
          onSubmit={handleSave}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "clamp(16px, 3.5vw, 24px)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <AwardIcon size={18} style={{ color: "var(--brand-orange)" }} /> Chỉnh sửa thông tin giải thưởng
            </h2>
            <Button
              type="submit"
              disabled={saving}
              style={{
                background: "var(--brand-orange)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                height: 36,
              }}
            >
              <Save size={15} style={{ marginRight: 6 }} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>

          {/* Row 1: Season & Award Name */}
          <div className="resp-grid-2" style={{ marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Mùa giải <span style={{ color: "red" }}>*</span>
              </label>
              <select
                required
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Hạng giải / Tên giải thưởng <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={awardName}
                onChange={(e) => setAwardName(e.target.value)}
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Row 2: Title & Slug */}
          <div className="resp-grid-2-unequal" style={{ marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Tên ý tưởng / đề tài đạt giải <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Slug URL <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Row 3: Category & Organization */}
          <div className="resp-grid-2" style={{ marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Lĩnh vực / Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Công nghệ thông tin..."
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Đơn vị / Khoa / Viện
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="VD: Khoa Công nghệ thông tin..."
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Row 4: Short Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Tóm tắt ngắn (shortDescription) <span style={{ color: "red" }}>*</span>
            </label>
            <textarea
              required
              rows={2}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="form-input"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px" }}
            />
          </div>

          {/* Row 5: Detailed Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Mô tả chi tiết giải pháp & thành tích <span style={{ color: "red" }}>*</span>
            </label>
            <textarea
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px" }}
            />
          </div>

          {/* Row 6: Image Picker (Preset Gallery + Upload + URL) */}
          <AwardImagePicker value={imageUrl} onChange={setImageUrl} />

          {/* Row 6b: Display Order */}
          <div style={{ maxWidth: 240, marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
              className="form-input"
              style={{ width: "100%", height: 38, fontSize: 13 }}
            />
          </div>

          {/* Row 7: Demo Data Flag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "rgba(245, 158, 11, 0.1)",
              borderRadius: "8px",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              marginBottom: 20,
            }}
          >
            <input
              type="checkbox"
              id="detailAwardIsDemo"
              checked={isDemo}
              onChange={(e) => setIsDemo(e.target.checked)}
            />
            <label htmlFor="detailAwardIsDemo" style={{ fontSize: 13, fontWeight: 600, color: "#b45309", cursor: "pointer" }}>
              Đánh dấu là Dữ liệu minh họa / Demo (isDemo = true)
            </label>
          </div>

          {/* Row 8: Dynamic Member Roster */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <UserPlus size={16} /> Danh sách tác giả / thành viên ({members.length})
              </h3>
              <button
                type="button"
                onClick={addMember}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                + Thêm thành viên
              </button>
            </div>

            {members.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
                Chưa có thông tin tác giả.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((member, idx) => (
                  <div
                    key={idx}
                    className="resp-member-row"
                    style={{
                      background: "var(--background)",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Họ và tên *"
                      value={member.fullName}
                      onChange={(e) => updateMember(idx, "fullName", e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12, height: 32 }}
                    />
                    <input
                      type="text"
                      placeholder="Vai trò"
                      value={member.role || ""}
                      onChange={(e) => updateMember(idx, "role", e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12, height: 32 }}
                    />
                    <input
                      type="text"
                      placeholder="Mã SV"
                      value={member.studentCode || ""}
                      onChange={(e) => updateMember(idx, "studentCode", e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12, height: 32 }}
                    />
                    <input
                      type="text"
                      placeholder="Lớp"
                      value={member.className || ""}
                      onChange={(e) => updateMember(idx, "className", e.target.value)}
                      className="form-input"
                      style={{ fontSize: 12, height: 32 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, textAlign: "right" }}>
            <Button
              type="submit"
              disabled={saving}
              style={{
                background: "var(--brand-orange)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                height: 38,
                padding: "0 24px",
              }}
            >
              <Save size={15} style={{ marginRight: 6 }} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>

        {/* Audit Log Timeline Container */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 12,
            }}
          >
            <History size={18} style={{ color: "var(--brand-orange)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              Lịch sử thao tác & Audit Log ({award.history.length})
            </h3>
          </div>

          {award.history.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Chưa có bản ghi audit nào.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {award.history.map((h) => {
                const meta = (h.metadata as Record<string, unknown>) || {};
                const fromSt = (meta.fromStatus as string) || h.fromStatus;
                const toSt = (meta.toStatus as string) || h.toStatus;

                return (
                  <div
                    key={h.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--brand-orange)",
                          textTransform: "uppercase",
                          fontSize: 11,
                        }}
                      >
                        {h.action}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>
                        {new Date(h.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>

                    {fromSt && toSt && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)" }}>Trạng thái: </span>
                        <strong>{fromSt}</strong> → <strong>{toSt}</strong>
                      </div>
                    )}

                  {h.reason && (
                    <div style={{ color: "var(--foreground)", fontStyle: "italic", marginBottom: 4 }}>
                      &ldquo;{h.reason}&rdquo;
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Admin: <code>{h.actorId}</code>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
