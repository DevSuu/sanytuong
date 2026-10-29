"use client";
import React, { useState } from "react";
import { Plus, X, AlertCircle, Award as AwardIcon, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { AwardStatus } from "@/lib/domain/award-state-machine";
import { AwardImagePicker } from "@/components/award-image-picker";

interface SeasonOption {
  id: string;
  name: string;
  status: string;
}

interface MemberInput {
  fullName: string;
  role: string;
  studentCode: string;
  className: string;
}

interface AdminCreateAwardModalProps {
  seasons: SeasonOption[];
}

export function AdminCreateAwardModal({ seasons }: AdminCreateAwardModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [awardName, setAwardName] = useState("Giải Nhất");
  const [category, setCategory] = useState("Công nghệ thông tin");
  const [organization, setOrganization] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState<AwardStatus>(AwardStatus.DRAFT);
  const [isDemo, setIsDemo] = useState(false);

  // Members dynamic list
  const [members, setMembers] = useState<MemberInput[]>([]);

  const addMember = () => {
    setMembers([
      ...members,
      { fullName: "", role: members.length === 0 ? "Trưởng nhóm" : "Thành viên", studentCode: "", className: "" },
    ]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof MemberInput, val: string) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: val };
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonId) {
      setError("Vui lòng chọn mùa giải.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        seasonId,
        title,
        awardName,
        category: category || null,
        organization: organization || null,
        shortDescription,
        description,
        imageUrl: imageUrl || null,
        displayOrder: Number(displayOrder) || 0,
        status,
        isDemo,
        members: members
          .filter((m) => m.fullName.trim().length > 0)
          .map((m, idx) => ({
            fullName: m.fullName.trim(),
            role: m.role.trim() || null,
            studentCode: m.studentCode.trim() || null,
            className: m.className.trim() || null,
            displayOrder: idx,
          })),
      };

      if (slug.trim()) payload.slug = slug.trim();

      const res = await fetch("/api/admin/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể tạo giải thưởng.");
        return;
      }

      setIsOpen(false);
      // Reset form
      setTitle("");
      setSlug("");
      setAwardName("Giải Nhất");
      setOrganization("");
      setShortDescription("");
      setDescription("");
      setImageUrl("");
      setDisplayOrder(0);
      setStatus(AwardStatus.DRAFT);
      setIsDemo(false);
      setMembers([]);

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi mạng khi tạo giải thưởng.");
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
        <Plus size={16} /> Thêm giải thưởng mới
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
              maxWidth: 800,
              maxHeight: "92vh",
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AwardIcon size={24} style={{ color: "var(--brand-orange)" }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Thêm Giải thưởng / Đề tài đạt giải mới
                </h2>
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

            <form onSubmit={handleSubmit}>
              {/* Row 1: Season & Award Name */}
              <div className="resp-grid-2" style={{ marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Mùa giải <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    required
                    value={seasonId}
                    onChange={(e) => setSeasonId(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  >
                    <option value="">-- Chọn mùa giải --</option>
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Hạng giải / Tên giải thưởng <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={awardName}
                    onChange={(e) => setAwardName(e.target.value)}
                    placeholder="VD: Giải Nhất, Giải Nhì, Giải Tiềm năng..."
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Row 2: Title & Slug */}
              <div className="resp-grid-2-unequal" style={{ marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Tên ý tưởng / đề tài đạt giải <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Hệ thống giám sát giao thông thông minh UTT Traffic AI"
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Slug URL (để trống tự sinh)
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="VD: utt-traffic-ai-giai-nhat"
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Row 3: Category & Organization */}
              <div className="resp-grid-2" style={{ marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Lĩnh vực / Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="VD: Công nghệ thông tin, Logistics, Giao thông thông minh..."
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Đơn vị / Khoa / Viện
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="VD: Khoa Công nghệ thông tin"
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Row 4: Short Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Tóm tắt ngắn (shortDescription) <span style={{ color: "red" }}>*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Mô tả tóm tắt nội dung và điểm nổi bật của ý tưởng/đề tài..."
                  className="form-input"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px" }}
                />
              </div>

              {/* Row 5: Detailed Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Mô tả chi tiết giải pháp & thành tích <span style={{ color: "red" }}>*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả chi tiết giải pháp, công nghệ sử dụng, tác động thực tế, thành tích đạt được..."
                  className="form-input"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px" }}
                />
              </div>

              {/* Row 6: Image Picker (Preset Gallery + Upload + URL) */}
              <AwardImagePicker value={imageUrl} onChange={setImageUrl} />

              {/* Row 6b: Display Order & Status */}
              <div className="resp-grid-2" style={{ marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
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

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Trạng thái xuất bản
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AwardStatus)}
                    className="form-input"
                    style={{ width: "100%", height: 38, fontSize: 13 }}
                  >
                    <option value={AwardStatus.DRAFT}>Bản nháp (DRAFT)</option>
                    <option value={AwardStatus.PUBLISHED}>Công bố (PUBLISHED)</option>
                  </select>
                </div>
              </div>

              {/* Row 7: Demo Data Flag */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(245, 158, 11, 0.1)", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.3)", marginBottom: 18 }}>
                <input
                  type="checkbox"
                  id="awardIsDemo"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                />
                <label htmlFor="awardIsDemo" style={{ fontSize: 13, fontWeight: 600, color: "#b45309", cursor: "pointer" }}>
                  Đánh dấu đây là Dữ liệu minh họa / Demo (isDemo = true)
                </label>
              </div>

              {/* Row 8: Dynamic Member Roster */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserPlus size={16} /> Danh sách thành viên tác giả ({members.length})
                  </h4>
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
                    Chưa thêm thành viên nào. Bấm &quot;+ Thêm thành viên&quot; nếu cần vinh danh tác giả đề tài.
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
                          placeholder="Vai trò (Trưởng nhóm...)"
                          value={member.role}
                          onChange={(e) => updateMember(idx, "role", e.target.value)}
                          className="form-input"
                          style={{ fontSize: 12, height: 32 }}
                        />
                        <input
                          type="text"
                          placeholder="Mã SV (nếu có)"
                          value={member.studentCode}
                          onChange={(e) => updateMember(idx, "studentCode", e.target.value)}
                          className="form-input"
                          style={{ fontSize: 12, height: 32 }}
                        />
                        <input
                          type="text"
                          placeholder="Lớp (nếu có)"
                          value={member.className}
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

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
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
                  style={{
                    background: "var(--brand-orange)",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                >
                  {loading ? "Đang lưu..." : "Lưu giải thưởng"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
