"use client";
import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Gift,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_BADGES,
  TaskStatus,
  TaskApplicationStatus,
} from "@/lib/domain/task-state-machine";
import { TaskApplicationModal } from "@/components/task-application-modal";
import Link from "next/link";

interface TaskDetailData {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements?: string | null;
  orderingOrganization: string;
  reward?: string | null;
  category?: string | null;
  applicationDeadline?: string | null;
  executionDeadline?: string | null;
  status: TaskStatus;
  submittedCount: number;
}

interface ApplicationMemberView {
  id?: string;
  memberType: "STUDENT" | "ADVISOR";
  isLeader: boolean;
  fullName: string;
  studentCode?: string | null;
  className?: string | null;
  email: string;
  phone?: string | null;
  department?: string | null;
}

interface MyApplicationView {
  id: string;
  taskId: string;
  proposal: string;
  status: TaskApplicationStatus;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  members: ApplicationMemberView[];
}

interface SubmitterView {
  fullName: string;
  email: string;
  studentCode?: string | null;
  className?: string | null;
  phone?: string | null;
}

export function TaskDetailView({ slug }: { slug: string }) {
  const { goBackToTasks } = useAppNavigation();

  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myApplication, setMyApplication] = useState<MyApplicationView | null>(null);
  const [submitter, setSubmitter] = useState<SubmitterView | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [successInfo, setSuccessInfo] = useState<{
    applicationId: string;
    lookupToken?: string | null;
    lookupUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadTask() {
      try {
        setLoading(true);
        setError(null);
        const storedToken =
          typeof window !== "undefined"
            ? localStorage.getItem("utt_lookup_token") || ""
            : "";
        const tokenQuery = storedToken
          ? `?token=${encodeURIComponent(storedToken)}`
          : "";
        const res = await fetch(`/api/tasks/${slug}${tokenQuery}`);
        const data = await res.json();

        if (ignore) return;
        if (!res.ok) {
          setError(data.error || "Không tìm thấy nhiệm vụ.");
          return;
        }

        setTask(data.task);
        if (data.myApplication || storedToken) {
          setMyApplication(data.myApplication);
        }
        if (data.submitter || storedToken) {
          setSubmitter(data.submitter);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Lỗi tải thông tin nhiệm vụ."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadTask();
    return () => {
      ignore = true;
    };
  }, [slug, refreshKey]);

  const handleApplicationSuccess = (result: {
    applicationId: string;
    application?: unknown;
    lookupToken?: string | null;
    lookupUrl?: string | null;
  }) => {
    if (typeof window !== "undefined" && result.lookupToken) {
      localStorage.setItem("utt_lookup_token", result.lookupToken);
    }
    if (result.application) {
      setMyApplication(result.application as MyApplicationView);
    }
    setSuccessInfo(result);
    setIsModalOpen(false);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="container page-shell" style={{ textAlign: "center", padding: "60px 0" }}>
        <p className="page-intro">Đang tải thông tin nhiệm vụ...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container page-shell">
        <button onClick={goBackToTasks} className="back-link" style={backBtnStyle}>
          <ArrowLeft size={16} /> Quay lại Sảnh nhiệm vụ
        </button>
        <div className="form-panel" style={{ textAlign: "center", padding: "48px 24px", marginTop: 20 }}>
          <AlertCircle size={48} style={{ color: "#dc2626", margin: "0 auto 16px" }} />
          <h2>Không tìm thấy nhiệm vụ</h2>
          <p className="page-intro">{error || "Nhiệm vụ này không tồn tại hoặc chưa được công bố."}</p>
          <Button onClick={goBackToTasks} style={{ marginTop: 20 }}>
            Quay về danh sách
          </Button>
        </div>
      </div>
    );
  }

  const isDeadlinePassed =
    task.applicationDeadline && new Date() > new Date(task.applicationDeadline);
  const isOpenForApply = task.status === "OPEN" && !isDeadlinePassed;
  const statusBadge = TASK_STATUS_BADGES[task.status] || {
    bg: "#f1f5f9",
    color: "#334155",
    border: "#cbd5e1",
  };

  return (
    <div className="container page-shell" style={{ maxWidth: 960 }}>
      <button onClick={goBackToTasks} className="back-link" style={backBtnStyle}>
        <ArrowLeft size={16} /> Quay lại Sảnh nhiệm vụ
      </button>

      {/* HEADER SECTION */}
      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: statusBadge.bg,
              color: statusBadge.color,
              border: `1px solid ${statusBadge.border}`,
            }}
          >
            {TASK_STATUS_LABELS[task.status] || task.status}
          </span>
          {task.category && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--muted)",
                background: "rgba(0,0,0,0.05)",
                padding: "4px 10px",
                borderRadius: 6,
              }}
            >
              {task.category}
            </span>
          )}
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            · {task.submittedCount} nhóm đã đăng ký
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(22px, 5vw, 28px)", fontWeight: 800, margin: "8px 0 12px 0", lineHeight: 1.3 }}>
          {task.title}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 14, flexWrap: "wrap" }}>
          <Building2 size={16} style={{ flexShrink: 0 }} />
          <span>Đơn vị đặt hàng: <strong>{task.orderingOrganization}</strong></span>
        </div>
      </div>

      {/* SUCCESS BANNER AFTER SUBMISSION */}
      {successInfo && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.25)",
            color: "#166534",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={24} style={{ color: "#16a34a", flexShrink: 0 }} />
            <div>
              <strong>Đăng ký thành công!</strong> Hồ sơ của bạn đã được chuyển tới Ban tổ chức và lưu trữ vào mã tra cứu.
            </div>
          </div>
          {successInfo.lookupUrl ? (
            <Button asChild size="sm" style={{ background: "#16a34a", color: "#fff" }}>
              <Link href={successInfo.lookupUrl}>Xem trang tra cứu cá nhân</Link>
            </Button>
          ) : null}
        </div>
      )}

      {/* EXISTING APPLICATION NOTICE */}
      {myApplication && (
        <div
          className="form-panel"
          style={{
            width: "100%",
            marginBottom: 28,
            padding: "clamp(16px, 4vw, 24px)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} style={{ color: "var(--brand-orange)" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Hồ sơ đăng ký của nhóm bạn
              </h3>
            </div>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background:
                  APPLICATION_STATUS_BADGES[
                    myApplication.status as TaskApplicationStatus
                  ]?.bg || "#f1f5f9",
                color:
                  APPLICATION_STATUS_BADGES[
                    myApplication.status as TaskApplicationStatus
                  ]?.color || "#334155",
                border: `1px solid ${
                  APPLICATION_STATUS_BADGES[
                    myApplication.status as TaskApplicationStatus
                  ]?.border || "#cbd5e1"
                }`,
              }}
            >
              {APPLICATION_STATUS_LABELS[
                myApplication.status as TaskApplicationStatus
              ] || myApplication.status}
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 14px 0", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            <strong>Đề xuất giải pháp:</strong> {myApplication.proposal}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={14} />
              Đội ngũ: <strong>{myApplication.members?.length || 0} thành viên</strong> (
              {myApplication.members?.filter((m: ApplicationMemberView) => m.memberType === "STUDENT").length || 0} SV,{" "}
              {myApplication.members?.filter((m: ApplicationMemberView) => m.memberType === "ADVISOR").length || 0} GVHD)
            </span>

            {task.status === "OPEN" && myApplication.status !== "SELECTED" && (
              <Button size="sm" variant="outline" onClick={() => setIsModalOpen(true)}>
                Chỉnh sửa đơn đăng ký
              </Button>
            )}
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="detail-grid">
        {/* LEFT COLUMN: DESCRIPTION & REQUIREMENTS */}
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Mô tả bài toán / Nhiệm vụ
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--foreground)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {task.description}
            </p>
          </div>

          {task.requirements && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                Yêu cầu kỹ thuật & Kết quả mong đợi
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--muted)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {task.requirements}
              </p>
            </div>
          )}

          {/* CTA SECTION */}
          <div style={{ marginTop: 32, padding: "clamp(16px, 4vw, 24px)", borderRadius: 12, background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)" }}>
            {isOpenForApply ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>
                    Sẵn sàng giải quyết bài toán này?
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Đăng ký nhóm sinh viên và giảng viên hướng dẫn để nhận nhiệm vụ.
                  </p>
                </div>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  style={{ background: "var(--brand-orange)", color: "#fff", fontWeight: 700, padding: "10px 24px" }}
                >
                  <Send size={16} />{" "}
                  {myApplication ? "Cập nhật hồ sơ đăng ký" : "Đăng ký thực hiện"}
                </Button>
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
                  {task.status !== "OPEN"
                    ? `Nhiệm vụ hiện ở trạng thái "${TASK_STATUS_LABELS[task.status]}", không nhận thêm đăng ký mới.`
                    : "Đã hết thời hạn đăng ký thực hiện nhiệm vụ này."}
                </p>
                <Button disabled style={{ marginTop: 12 }}>
                  Đã đóng đăng ký
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: METADATA PANEL */}
        <div style={{ minWidth: 0 }}>
          <div
            className="form-panel"
            style={{
              width: "100%",
              padding: "clamp(18px, 4vw, 24px)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px 0", color: "var(--brand-orange)" }}>
              THÔNG TIN ĐẶT HÀNG
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Đơn vị đặt hàng
                </span>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "2px 0 0 0" }}>
                  {task.orderingOrganization}
                </p>
              </div>

              {task.reward && (
                <div>
                  <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Giải thưởng / Hỗ trợ
                  </span>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#16a34a", margin: "2px 0 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <Gift size={16} />
                    {task.reward}
                  </p>
                </div>
              )}

              {task.applicationDeadline && (
                <div>
                  <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Hạn chót nộp hồ sơ
                  </span>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={15} style={{ color: "var(--brand-orange)" }} />
                    {new Date(task.applicationDeadline).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}

              {task.executionDeadline && (
                <div>
                  <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Thời hạn hoàn thành
                  </span>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={15} style={{ color: "#0ea5e9" }} />
                    {new Date(task.executionDeadline).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}

              <div>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Quy định đội ngũ
                </span>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                  Mỗi nhóm từ <strong>2 đến 10 người</strong>, bắt buộc có ít nhất <strong>1 Sinh viên (Trưởng nhóm)</strong> và ít nhất <strong>1 Giảng viên hướng dẫn (GVHD)</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL FORM */}
      <TaskApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={task}
        initialSubmitter={submitter}
        existingApplication={myApplication}
        lookupToken={typeof window !== "undefined" ? localStorage.getItem("utt_lookup_token") : null}
        onSuccess={handleApplicationSuccess}
      />
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--muted)",
  fontSize: 14,
  fontWeight: 600,
};
