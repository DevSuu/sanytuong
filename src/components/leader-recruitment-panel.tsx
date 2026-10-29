"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Sparkles,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApplicationItem {
  id: string;
  fullName: string;
  studentCode: string;
  email: string;
  className: string | null;
  phone: string | null;
  specialty: string;
  motivation: string;
  contribution: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface PostData {
  id: string;
  title: string;
  description: string;
  targetMemberCount: number;
  requiredSkills: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  publishedAt: string | null;
  closedAt: string | null;
  applications: ApplicationItem[];
}

export function LeaderRecruitmentPanel({
  ideaId,
  lookupToken,
  onMemberAdded,
}: {
  ideaId: string;
  lookupToken: string;
  onMemberAdded?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<PostData | null>(null);
  const [capacity, setCapacity] = useState<{
    currentMemberCount: number;
    maxAllowedRecruits: number;
  }>({ currentMemberCount: 1, maxAllowedRecruits: 9 });

  // Post form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    targetMemberCount: 1,
    requiredSkills: "",
  });
  const [savingPost, setSavingPost] = useState(false);
  const [postFeedback, setPostFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Review modal/dialog state
  const [reviewingApp, setReviewingApp] = useState<ApplicationItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"ACCEPT" | "REJECT">("ACCEPT");
  const [reviewNote, setReviewNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/ideas/${ideaId}/recruitment`, {
      headers: { "x-lookup-token": lookupToken },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          setPost(json.data.post);
          setCapacity(json.data.capacity);
          if (json.data.post) {
            setForm({
              title: json.data.post.title,
              description: json.data.post.description,
              targetMemberCount: json.data.post.targetMemberCount,
              requiredSkills: json.data.post.requiredSkills,
            });
          }
          setError(null);
        } else {
          setError(json.error || "Không thể tải dữ liệu tuyển dụng.");
        }
      })
      .catch(() => {
        setError("Lỗi kết nối khi tải dữ liệu tuyển dụng.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ideaId, lookupToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPost(true);
    setPostFeedback(null);

    try {
      const res = await fetch(`/api/ideas/${ideaId}/recruitment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify({
          ...form,
          targetMemberCount: Number(form.targetMemberCount),
          lookupToken,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setPostFeedback({ type: "success", text: "Lưu tin tuyển dụng thành công!" });
        fetchData();
      } else {
        setPostFeedback({ type: "error", text: json.error || "Không thể lưu tin tuyển dụng." });
      }
    } catch {
      setPostFeedback({ type: "error", text: "Lỗi kết nối khi lưu tin tuyển dụng." });
    } finally {
      setSavingPost(false);
    }
  };

  const handleStatusChange = async (newStatus: "PUBLISHED" | "PAUSED" | "CLOSED" | "DRAFT") => {
    setSavingPost(true);
    setPostFeedback(null);

    try {
      const res = await fetch(`/api/ideas/${ideaId}/recruitment/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify({
          status: newStatus,
          lookupToken,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setPostFeedback({
          type: "success",
          text: `Cập nhật trạng thái thành "${newStatus}" thành công.`,
        });
        fetchData();
      } else {
        setPostFeedback({
          type: "error",
          text: json.error || "Không thể đổi trạng thái tin tuyển dụng.",
        });
      }
    } catch {
      setPostFeedback({ type: "error", text: "Lỗi kết nối khi đổi trạng thái." });
    } finally {
      setSavingPost(false);
    }
  };

  const handleOpenReview = (app: ApplicationItem, action: "ACCEPT" | "REJECT") => {
    setReviewingApp(app);
    setReviewAction(action);
    setReviewNote("");
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewingApp) return;

    setSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await fetch(
        `/api/ideas/${ideaId}/recruitment/apps/${reviewingApp.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-lookup-token": lookupToken,
          },
          body: JSON.stringify({
            action: reviewAction,
            reviewNote,
            lookupToken,
          }),
        },
      );

      const json = await res.json();
      if (json.ok) {
        setReviewingApp(null);
        fetchData();
        if (reviewAction === "ACCEPT" && onMemberAdded) {
          onMemberAdded();
        }
      } else {
        setReviewError(json.error || "Đã xảy ra lỗi khi xét duyệt ứng viên.");
      }
    } catch {
      setReviewError("Lỗi kết nối khi gửi xét duyệt.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px 0", color: "var(--muted)", textAlign: "center" }}>
        Đang tải thông tin tuyển thành viên...
      </div>
    );
  }

  if (error) {
    return (
      <div className="notice" style={{ borderLeft: "4px solid #ef4444", color: "#ef4444" }}>
        {error}
      </div>
    );
  }

  const applications = post?.applications || [];
  const pendingApps = applications.filter((a) => a.status === "PENDING");
  const reviewedApps = applications.filter((a) => a.status !== "PENDING");

  const getStatusBadge = (status: PostData["status"] | undefined) => {
    if (!status) {
      return (
        <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "rgba(100, 116, 139, 0.1)", color: "#64748b" }}>
          Chưa tạo tin
        </span>
      );
    }
    switch (status) {
      case "PUBLISHED":
        return (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(22, 163, 74, 0.1)", color: "#16a34a", border: "1px solid rgba(22, 163, 74, 0.2)" }}>
            ● ĐANG MỞ TUYỂN (PUBLISHED)
          </span>
        );
      case "PAUSED":
        return (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(234, 179, 8, 0.1)", color: "#ca8a04", border: "1px solid rgba(234, 179, 8, 0.2)" }}>
            ⏸ TẠM DỪNG (PAUSED)
          </span>
        );
      case "CLOSED":
        return (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", border: "1px solid rgba(220, 38, 38, 0.2)" }}>
            ✕ ĐÃ ĐÓNG (CLOSED)
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(100, 116, 139, 0.1)", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.2)" }}>
            ✎ BẢN NHÁP (DRAFT)
          </span>
        );
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: "24px",
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--background)",
      }}
    >
      {/* Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={18} style={{ color: "var(--brand-orange)" }} />
            <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
              Tuyển Thành Viên Tại Hội Chợ Ý Tưởng
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
            Mở tin tuyển cộng sự bổ sung cho đề tài. Nhóm hiện có <strong>{capacity.currentMemberCount}/10</strong> thành viên. (Chỉ tiêu tuyển tối đa còn lại: <strong>{capacity.maxAllowedRecruits}</strong> người).
          </p>
        </div>

        <div>{getStatusBadge(post?.status)}</div>
      </div>

      {postFeedback && (
        <div
          className="notice"
          style={{
            marginBottom: 16,
            borderLeft: `4px solid ${postFeedback.type === "success" ? "#16a34a" : "#ef4444"}`,
            color: postFeedback.type === "success" ? "#16a34a" : "#ef4444",
          }}
        >
          {postFeedback.text}
        </div>
      )}

      {/* RECRUITMENT POST FORM */}
      <form
        onSubmit={handleSavePost}
        style={{
          background: "var(--surface)",
          padding: "20px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          marginBottom: 24,
        }}
      >
        <div className="resp-grid-3-1" style={{ marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Tiêu đề tin tuyển dụng <span style={{ color: "red" }}>*</span>
            </label>
            <Input
              required
              value={form.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })}
              placeholder="Ví dụ: Tuyển 2 thành viên Lập trình Frontend & Thiết kế UI/UX"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Chỉ tiêu tuyển (1 - {Math.max(1, capacity.maxAllowedRecruits)}) <span style={{ color: "red" }}>*</span>
            </label>
            <Input
              required
              type="number"
              min={1}
              max={Math.max(1, capacity.maxAllowedRecruits)}
              value={form.targetMemberCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, targetMemberCount: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Kỹ năng / Chuyên môn mong muốn <span style={{ color: "red" }}>*</span>
          </label>
          <Input
            required
            value={form.requiredSkills}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, requiredSkills: e.target.value })}
            placeholder="Ví dụ: React, TypeScript, Figma, Python Machine Learning, BIM Revit..."
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Mô tả công việc & Yêu cầu cụ thể <span style={{ color: "red" }}>*</span>
          </label>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Mô tả cụ thể phân công công việc, định hướng nghiên cứu và mong đợi đối với ứng viên..."
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Button type="submit" disabled={savingPost}>
            {savingPost ? "Đang lưu..." : post ? "Cập nhật nội dung tin" : "Tạo tin tuyển dụng"}
          </Button>

          {post && (
            <div style={{ display: "flex", gap: 8 }}>
              {post.status !== "PUBLISHED" && capacity.maxAllowedRecruits > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStatusChange("PUBLISHED")}
                  style={{ color: "#16a34a", borderColor: "rgba(22, 163, 74, 0.4)" }}
                >
                  <PlayCircle size={15} /> Công khai đăng tin
                </Button>
              )}
              {post.status === "PUBLISHED" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStatusChange("PAUSED")}
                  style={{ color: "#ca8a04", borderColor: "rgba(234, 179, 8, 0.4)" }}
                >
                  <PauseCircle size={15} /> Tạm dừng nhận hồ sơ
                </Button>
              )}
              {post.status !== "CLOSED" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStatusChange("CLOSED")}
                  style={{ color: "#dc2626", borderColor: "rgba(220, 38, 38, 0.4)" }}
                >
                  <Lock size={15} /> Đóng tuyển dụng
                </Button>
              )}
            </div>
          )}
        </div>
      </form>

      {/* CANDIDATES LIST */}
      <div>
        <h5 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} style={{ color: "var(--brand-orange)" }} />
          Hồ Sơ Ứng Tuyển Nhận Được ({applications.length})
        </h5>

        {applications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px dashed var(--border)",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Chưa có ứng viên nào nộp hồ sơ hoặc xác thực email cho tin tuyển dụng này.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Pending Applications First */}
            {pendingApps.map((app) => (
              <div
                key={app.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  borderLeft: "4px solid #f97316",
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                      {app.fullName}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>
                      MSSV: <strong>{app.studentCode}</strong> {app.className ? `· Lớp: ${app.className}` : ""}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "rgba(249, 115, 22, 0.1)",
                      color: "#ea580c",
                    }}
                  >
                    Chờ xét duyệt
                  </span>
                </div>

                <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 8 }}>
                  Email: <strong>{app.email}</strong> {app.phone ? `· SĐT: ${app.phone}` : ""} · Nộp ngày: {new Date(app.createdAt).toLocaleDateString("vi-VN")}
                </div>

                <div style={{ fontSize: "0.88rem", marginBottom: 6 }}>
                  <strong>Chuyên môn:</strong> {app.specialty}
                </div>
                <div style={{ fontSize: "0.88rem", marginBottom: 6 }}>
                  <strong>Lý do tham gia:</strong> {app.motivation}
                </div>
                <div style={{ fontSize: "0.88rem", marginBottom: 14 }}>
                  <strong>Đóng góp dự kiến:</strong> {app.contribution}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button
                    size="sm"
                    disabled={post?.status !== "PUBLISHED"}
                    onClick={() => handleOpenReview(app, "ACCEPT")}
                    style={{ background: "#16a34a", color: "#fff" }}
                  >
                    <CheckCircle2 size={14} /> Tiếp nhận vào nhóm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenReview(app, "REJECT")}
                    style={{ color: "#dc2626", borderColor: "rgba(220, 38, 38, 0.3)" }}
                  >
                    <XCircle size={14} /> Từ chối
                  </Button>
                </div>
                {post?.status !== "PUBLISHED" && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>
                    * Chỉ có thể tiếp nhận ứng viên khi tin tuyển dụng đang ở trạng thái PUBLISHED (Đang mở tuyển).
                  </div>
                )}
              </div>
            ))}

            {/* Reviewed Applications */}
            {reviewedApps.map((app) => (
              <div
                key={app.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${app.status === "ACCEPTED" ? "#16a34a" : "#94a3b8"}`,
                  padding: "16px 20px",
                  opacity: 0.85,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{app.fullName}</strong> ({app.studentCode})
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: app.status === "ACCEPTED" ? "rgba(22, 163, 74, 0.1)" : "rgba(100, 116, 139, 0.1)",
                      color: app.status === "ACCEPTED" ? "#16a34a" : "#64748b",
                    }}
                  >
                    {app.status === "ACCEPTED" ? "✓ Đã tiếp nhận" : "✕ Đã từ chối"}
                  </span>
                </div>
                {app.reviewNote && (
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>
                    Ghi chú xét duyệt: "{app.reviewNote}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REVIEW CONFIRMATION MODAL */}
      {reviewingApp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setReviewingApp(null)}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: 500,
              background: "var(--surface)",
              borderRadius: 16,
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 10px 0" }}>
              {reviewAction === "ACCEPT" ? "Xác nhận tiếp nhận ứng viên" : "Xác nhận từ chối ứng viên"}
            </h4>

            <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              {reviewAction === "ACCEPT"
                ? `Bạn đang chuẩn bị tiếp nhận ứng viên "${reviewingApp.fullName}" (${reviewingApp.studentCode}) vào danh sách thành viên đề tài.`
                : `Bạn đang chuẩn bị từ chối hồ sơ của ứng viên "${reviewingApp.fullName}".`}
            </p>

            {reviewError && (
              <div className="notice" style={{ borderLeft: "4px solid #ef4444", color: "#ef4444", marginBottom: 14 }}>
                {reviewError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Lời nhắn / Ghi chú cho ứng viên (tùy chọn)
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  reviewAction === "ACCEPT"
                    ? "Chào mừng bạn gia nhập nhóm! Hãy chủ động nhắn tin Zalo/Email cho mình..."
                    : "Cảm ơn bạn đã quan tâm, hiện nhóm đã đủ vị trí phù hợp..."
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button variant="outline" onClick={() => setReviewingApp(null)} disabled={submittingReview}>
                Hủy
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                style={{
                  background: reviewAction === "ACCEPT" ? "#16a34a" : "#dc2626",
                  color: "#fff",
                }}
              >
                {submittingReview
                  ? "Đang xử lý..."
                  : reviewAction === "ACCEPT"
                  ? "Tiếp nhận vào nhóm"
                  : "Xác nhận từ chối"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
