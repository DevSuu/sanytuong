"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Gift,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  History,
  X,
  Edit,
  Play,
  Ban,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AwardImagePicker } from "@/components/award-image-picker";
import {
  TaskStatus,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGES,
  TaskApplicationStatus,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_BADGES,
} from "@/lib/domain/task-state-machine";

export interface TaskMemberAdmin {
  id: string;
  memberType: "STUDENT" | "ADVISOR";
  isLeader: boolean;
  fullName: string;
  studentCode?: string | null;
  className?: string | null;
  email: string;
  phone?: string | null;
  department?: string | null;
  orderIndex: number;
}

export interface TaskApplicationAdmin {
  id: string;
  taskId: string;
  proposal: string;
  status: TaskApplicationStatus;
  submittedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  submitter: {
    id: string;
    fullName: string;
    studentCode?: string | null;
    className?: string | null;
    email: string;
    phone?: string | null;
    department?: string | null;
  };
  members?: TaskMemberAdmin[];
}

export interface TaskHistoryItem {
  id: string;
  action: string;
  actor?: string | null;
  actorRole?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  createdAt: string | Date;
}

export interface TaskAdminDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements?: string | null;
  orderingOrganization: string;
  reward?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  applicationDeadline?: string | Date | null;
  executionDeadline?: string | Date | null;
  status: TaskStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  applications?: TaskApplicationAdmin[];
  history?: TaskHistoryItem[];
}

export interface TaskDetailClientProps {
  task: TaskAdminDetail;
}

export function AdminTaskDetailClient({ task }: TaskDetailClientProps) {
  const router = useRouter();

  // Selection modal state
  const [selectedApp, setSelectedApp] = useState<TaskApplicationAdmin | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [selectLoading, setSelectLoading] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  // Status transition modal state
  const [targetStatus, setTargetStatus] = useState<TaskStatus | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // View member modal state
  const [viewingMembersApp, setViewingMembersApp] = useState<TaskApplicationAdmin | null>(null);

  // Edit task modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editOrg, setEditOrg] = useState(task.orderingOrganization);
  const [editReward, setEditReward] = useState(task.reward || "");
  const [editCategory, setEditCategory] = useState(task.category || "");
  const [editImageUrl, setEditImageUrl] = useState(task.imageUrl || "");
  const [editDesc, setEditDesc] = useState(task.description);
  const [editReqs, setEditReqs] = useState(task.requirements || "");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const statusBadge = TASK_STATUS_BADGES[task.status as TaskStatus] || {
    bg: "#f1f5f9",
    color: "#334155",
    border: "#cbd5e1",
  };

  const applications: TaskApplicationAdmin[] = task.applications || [];
  const history: TaskHistoryItem[] = task.history || [];

  // Atomic Selection handler
  const handleConfirmSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSelectLoading(true);
    setSelectError(null);

    try {
      const res = await fetch(
        `/api/admin/tasks/${task.id}/applications/${selectedApp.id}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNote: adminNote.trim() || undefined }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setSelectError(data.error || "Không thể chọn nhóm thực hiện nhiệm vụ.");
        return;
      }

      setSelectedApp(null);
      setAdminNote("");
      router.refresh();
    } catch (err: unknown) {
      setSelectError(err instanceof Error ? err.message : "Lỗi kết nối khi chọn nhóm.");
    } finally {
      setSelectLoading(false);
    }
  };

  // State Transition handler
  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    setStatusLoading(true);
    setStatusError(null);

    try {
      const res = await fetch(`/api/admin/tasks/${task.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || "Không thể chuyển trạng thái.");
        return;
      }

      setTargetStatus(null);
      setStatusReason("");
      router.refresh();
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : "Lỗi mạng khi chuyển trạng thái.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Edit Task handler
  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          orderingOrganization: editOrg.trim(),
          reward: editReward.trim() || null,
          category: editCategory.trim() || null,
          imageUrl: editImageUrl.trim() || null,
          description: editDesc.trim(),
          requirements: editReqs.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Không thể cập nhật.");
        return;
      }

      setIsEditOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Lỗi mạng khi cập nhật.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    const appWarning =
      applications.length > 0
        ? `Nhiệm vụ này đang có ${applications.length} đơn đăng ký. Bạn có chắc chắn muốn XÓA VĨNH VIỄN nhiệm vụ "${task.title}" cùng toàn bộ đơn đăng ký liên quan không?`
        : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN nhiệm vụ "${task.title}" không?`;
    if (!confirm(`${appWarning}\nThao tác này không thể hoàn tác.`)) {
      return;
    }

    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể xóa nhiệm vụ.");
        setStatusLoading(false);
        return;
      }
      router.push("/quan-tri/nhiem-vu");
      router.refresh();
    } catch {
      alert("Lỗi kết nối khi xóa nhiệm vụ.");
      setStatusLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/quan-tri/nhiem-vu"
          className="button button-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Quay lại danh sách nhiệm vụ
        </Link>
      </div>

      {/* HEADER CARD */}
      <div
        className="form-panel"
        style={{
          padding: 24,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
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
                {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Mã đường dẫn: <strong>/{task.slug}</strong>
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0" }}>
              {task.title}
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={16} style={{ color: "var(--brand-orange)" }} />
                Đơn vị đặt hàng: <strong>{task.orderingOrganization}</strong>
              </span>

              {task.reward && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontWeight: 700 }}>
                  <Gift size={16} />
                  Giải thưởng: {task.reward}
                </span>
              )}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Edit size={14} /> Sửa nhiệm vụ
            </Button>

            {task.status === "DRAFT" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setTargetStatus(TaskStatus.OPEN);
                    setStatusReason("Ban tổ chức phê duyệt mở đăng ký nhiệm vụ.");
                  }}
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  <Play size={14} /> Mở đăng ký (OPEN)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetStatus(TaskStatus.CANCELLED);
                    setStatusReason("");
                  }}
                  style={{ color: "#dc2626" }}
                >
                  <Ban size={14} /> Hủy nhiệm vụ
                </Button>
              </>
            )}

            {task.status === "OPEN" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetStatus(TaskStatus.CLOSED);
                    setStatusReason("Đóng nhận thêm hồ sơ.");
                  }}
                >
                  Đóng đăng ký (CLOSED)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetStatus(TaskStatus.CANCELLED);
                    setStatusReason("");
                  }}
                  style={{ color: "#dc2626" }}
                >
                  <Ban size={14} /> Hủy nhiệm vụ
                </Button>
              </>
            )}

            {task.status === "CLOSED" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setTargetStatus(TaskStatus.OPEN);
                    setStatusReason("Mở lại nhận hồ sơ đăng ký.");
                  }}
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  <RotateCcw size={14} /> Mở lại (OPEN)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetStatus(TaskStatus.CANCELLED);
                    setStatusReason("");
                  }}
                  style={{ color: "#dc2626" }}
                >
                  <Ban size={14} /> Hủy nhiệm vụ
                </Button>
              </>
            )}

            {task.status === "ASSIGNED" && (
              <Button
                size="sm"
                onClick={() => {
                  setTargetStatus(TaskStatus.IN_PROGRESS);
                  setStatusReason("Nhóm bắt đầu triển khai nhiệm vụ.");
                }}
                style={{ background: "#d97706", color: "#fff" }}
              >
                Bắt đầu thực hiện (IN_PROGRESS)
              </Button>
            )}

            {task.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                onClick={() => {
                  setTargetStatus(TaskStatus.COMPLETED);
                  setStatusReason("Nhiệm vụ đã hoàn thành xuất sắc.");
                }}
                style={{ background: "#16a34a", color: "#fff" }}
              >
                <CheckCircle2 size={14} /> Nghiệm thu (COMPLETED)
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={statusLoading}
              onClick={handleDeleteTask}
              style={{
                color: "#b91c1c",
                borderColor: "#fca5a5",
                background: "#fee2e2",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} /> Xóa nhiệm vụ
            </Button>
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px 0" }}>
            Mô tả nhiệm vụ:
          </h4>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--foreground)", whiteSpace: "pre-wrap", margin: "0 0 16px 0" }}>
            {task.description}
          </p>

          {task.requirements && (
            <>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px 0" }}>
                Yêu cầu kỹ thuật:
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)", whiteSpace: "pre-wrap", margin: 0 }}>
                {task.requirements}
              </p>
            </>
          )}
        </div>
      </div>

      {/* APPLICATIONS SECTION */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={22} style={{ color: "var(--brand-orange)" }} />
            Danh sách hồ sơ đăng ký ({applications.length})
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Quy tắc: Admin chọn 1 nhóm duy nhất · Giao dịch nguyên tử Concurrency-safe
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="form-panel" style={{ textAlign: "center", padding: "40px 20px" }}>
            <FileText size={40} style={{ margin: "0 auto 10px", color: "var(--muted)" }} />
            <p style={{ margin: 0, color: "var(--muted)" }}>Chưa có nhóm nào nộp đơn đăng ký cho nhiệm vụ này.</p>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", minWidth: 740, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: "var(--background)",
                    borderBottom: "1px solid var(--border)",
                    textAlign: "left",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Trưởng nhóm</th>
                  <th style={{ padding: "12px 16px" }}>Quy mô nhóm</th>
                  <th style={{ padding: "12px 16px" }}>Đề xuất giải pháp</th>
                  <th style={{ padding: "12px 16px" }}>Trạng thái</th>
                  <th style={{ padding: "12px 16px" }}>Thời gian nộp</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const badge = APPLICATION_STATUS_BADGES[app.status as TaskApplicationStatus] || {
                    bg: "#f1f5f9",
                    color: "#334155",
                    border: "#cbd5e1",
                  };
                  const svCount = app.members?.filter((m: TaskMemberAdmin) => m.memberType === "STUDENT").length || 0;
                  const gvCount = app.members?.filter((m: TaskMemberAdmin) => m.memberType === "ADVISOR").length || 0;

                  return (
                    <tr key={app.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700 }}>{app.submitter.fullName}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          MSSV: {app.submitter.studentCode} · {app.submitter.className}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {app.submitter.email}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => setViewingMembersApp(app)}
                          style={{
                            background: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            gap: 4,
                          }}
                        >
                          <Users size={12} />
                          {app.members?.length || 0} người ({svCount} SV, {gvCount} GVHD)
                        </button>
                      </td>

                      <td style={{ padding: "14px 16px", maxWidth: 280 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--foreground)",
                            lineHeight: 1.4,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {app.proposal}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {APPLICATION_STATUS_LABELS[app.status as TaskApplicationStatus] || app.status}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {new Date(app.createdAt).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {app.status === "SELECTED" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              whiteSpace: "nowrap",
                              gap: 4,
                              color: "#16a34a",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            <CheckCircle2 size={16} /> Nhóm được chọn
                          </span>
                        ) : task.status === "OPEN" && app.status === "SUBMITTED" ? (
                          <Button
                            size="sm"
                            onClick={() => setSelectedApp(app)}
                            style={{
                              background: "#16a34a",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: 12,
                              height: 32,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <CheckCircle2 size={14} /> Chọn nhóm này
                          </Button>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AUDIT / HISTORY TIMELINE */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <History size={20} style={{ color: "var(--brand-orange)" }} />
          Nhật ký thay đổi & Truy vết ({history.length})
        </h2>

        {history.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Chưa có bản ghi nhật ký.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: "var(--brand-orange)", marginRight: 8 }}>
                    {h.action}
                  </span>
                  <span>{h.reason || "Cập nhật hệ thống"}</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {new Date(h.createdAt).toLocaleDateString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: VIEW MEMBERS BREAKDOWN */}
      {viewingMembersApp && (
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
          }}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 24,
              position: "relative",
            }}
          >
            <button
              onClick={() => setViewingMembersApp(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0" }}>
              Danh sách thành viên nhóm: {viewingMembersApp.submitter.fullName}
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Tổng số: <strong>{viewingMembersApp.members?.length || 0} thành viên</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {viewingMembersApp.members?.map((m: TaskMemberAdmin, idx: number) => (
                <div
                  key={m.id || idx}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: m.isLeader
                      ? "rgba(242, 92, 5, 0.05)"
                      : m.memberType === "ADVISOR"
                      ? "rgba(14, 165, 233, 0.05)"
                      : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      {m.fullName}
                      {m.isLeader && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "var(--brand-orange)",
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        >
                          TRƯỞNG NHÓM
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: m.memberType === "ADVISOR" ? "#e0f2fe" : "#f1f5f9",
                          color: m.memberType === "ADVISOR" ? "#0369a1" : "#334155",
                          fontWeight: 600,
                        }}
                      >
                        {m.memberType === "ADVISOR" ? "GVHD" : "SINH VIÊN"}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {m.memberType === "STUDENT"
                        ? `MSSV: ${m.studentCode || "—"} · Lớp: ${m.className || "—"}`
                        : `Khoa / Bộ môn: ${m.department || "—"}`}
                      {m.phone ? ` · SĐT: ${m.phone}` : ""}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {m.email}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM SELECTION WITH ADVISORY LOCK */}
      {selectedApp && (
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
          }}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: 580,
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 24,
              position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedApp(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#16a34a",
              }}
            >
              <ShieldCheck size={22} />
              Xác nhận chọn nhóm thực hiện nhiệm vụ
            </h3>

            <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Bạn đang chọn nhóm của <strong>{selectedApp.submitter.fullName}</strong> (MSSV:{" "}
              {selectedApp.submitter.studentCode}) để thực hiện nhiệm vụ{" "}
              <strong>"{task.title}"</strong>.
            </p>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "rgba(242, 92, 5, 0.06)",
                border: "1px solid rgba(242, 92, 5, 0.2)",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <strong>Cam kết Invariant Concurrency:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                <li>Nhiệm vụ chuyển sang trạng thái <strong>ASSIGNED</strong> (Đã giao nhóm).</li>
                <li>Đơn này trở thành <strong>SELECTED</strong>.</li>
                <li>Mọi đơn khác chuyển sang <strong>NOT_SELECTED</strong>.</li>
                <li>Khóa giao dịch DB PostgreSQL ngăn chặn tranh chấp cùng lúc.</li>
              </ul>
            </div>

            {selectError && (
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
                <span>{selectError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSelect}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Ghi chú / Nhắn gửi tới nhóm (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ghi chú phản hồi gửi kèm qua email..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedApp(null)}
                  disabled={selectLoading}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={selectLoading}
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  {selectLoading ? "Đang xử lý..." : "Xác nhận chọn nhóm này"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STATE TRANSITION */}
      {targetStatus && (
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
          }}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 24,
              position: "relative",
            }}
          >
            <button
              onClick={() => setTargetStatus(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px 0" }}>
              Chuyển trạng thái sang "{TASK_STATUS_LABELS[targetStatus]}"
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px 0" }}>
              Trạng thái hiện tại: <strong>{TASK_STATUS_LABELS[task.status as TaskStatus]}</strong>.
            </p>

            {statusError && (
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
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleStatusTransition}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Lý do / Ghi chú {targetStatus === TaskStatus.CANCELLED ? "*" : "(tùy chọn)"}
                </label>
                <textarea
                  required={targetStatus === TaskStatus.CANCELLED}
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={
                    targetStatus === TaskStatus.CANCELLED
                      ? "Bắt buộc nhập lý do hủy nhiệm vụ..."
                      : "Ghi chú lý do chuyển trạng thái..."
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTargetStatus(null)}
                  disabled={statusLoading}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={statusLoading}
                  style={{
                    background:
                      targetStatus === TaskStatus.CANCELLED
                        ? "#dc2626"
                        : "var(--brand-orange)",
                    color: "#fff",
                  }}
                >
                  {statusLoading ? "Đang xử lý..." : "Xác nhận chuyển trạng thái"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TASK */}
      {isEditOpen && (
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
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 24,
              position: "relative",
            }}
          >
            <button
              onClick={() => setIsEditOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0" }}>
              Cập nhật thông tin nhiệm vụ
            </h3>

            {editError && (
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
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditTask}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Tiêu đề nhiệm vụ *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
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
                      value={editOrg}
                      onChange={(e) => setEditOrg(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Giải thưởng / Tài trợ
                    </label>
                    <input
                      type="text"
                      value={editReward}
                      onChange={(e) => setEditReward(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Lĩnh vực / Chuyên ngành
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="VD: CNTT, Logistics, IoT..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <AwardImagePicker
                  label="Ảnh bìa minh họa Nhiệm vụ đặt hàng"
                  value={editImageUrl}
                  onChange={setEditImageUrl}
                />

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Mô tả bài toán *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Yêu cầu kỹ thuật
                  </label>
                  <textarea
                    rows={3}
                    value={editReqs}
                    onChange={(e) => setEditReqs(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    disabled={editLoading}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={editLoading}
                    style={{ background: "var(--brand-orange)", color: "#fff" }}
                  >
                    {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
