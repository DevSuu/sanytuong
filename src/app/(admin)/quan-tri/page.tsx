import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Lightbulb,
  Clock,
  Inbox,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  ArrowRight,
  Eye,
  Sparkles,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { IdeaStatus, EmailJobStatus, EmailJobType } from "@/generated/prisma/client";
import { STATUS_BADGE_VARIANTS } from "@/lib/domain/idea-state-machine";
import { getEmailJobPriority } from "@/lib/email/queue";
import { getGoogleSheetsConfig } from "@/lib/google-sheets/sync-service";
import { AdminGoogleSheetsPanel } from "@/components/admin-google-sheets-panel";

const EMAIL_JOB_TYPE_LABELS: Record<EmailJobType, string> = {
  VERIFY_EMAIL: "Xác minh email gửi ý tưởng",
  LOOKUP_LINK: "Liên kết tra cứu ý tưởng",
  IDEA_APPROVED: "Thông báo duyệt ý tưởng",
  IDEA_REJECTED: "Thông báo từ chối ý tưởng",
  IDEA_REVISION_REQUESTED: "Yêu cầu chỉnh sửa ý tưởng",
  EDIT_REQUEST_REJECTED: "Từ chối yêu cầu sửa hồ sơ",
  EDIT_REQUEST_APPROVED: "Chấp thuận yêu cầu sửa hồ sơ",
  PROFILE_REVISION_REQUESTED: "Yêu cầu bổ sung hồ sơ đề tài",
  PROFILE_COMPLETED: "Xác nhận hoàn tất hồ sơ đề tài",
  TASK_APPLICATION_SUBMITTED: "Thông báo nộp đơn nhiệm vụ",
  TASK_APPLICATION_SELECTED: "Thông báo trúng tuyển nhiệm vụ",
  TASK_APPLICATION_NOT_SELECTED: "Thông báo kết quả nhiệm vụ",
  TASK_ASSIGNED: "Giao nhiệm vụ đặt hàng",
  TASK_COMPLETED: "Xác nhận hoàn thành nhiệm vụ",
  VERIFY_TASK_APPLICATION: "Mã OTP ứng tuyển nhiệm vụ",
  RECRUITMENT_APPLICATION_OTP: "Mã OTP ứng tuyển nhóm",
  RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE: "Thông báo có ứng viên vào nhóm",
  RECRUITMENT_APPLICATION_ACCEPTED: "Chấp nhận thành viên vào nhóm",
  RECRUITMENT_APPLICATION_REJECTED: "Từ chối ứng viên vào nhóm",
};

export const metadata = {
  title: "Bảng điều khiển Quản trị — Thử thách sáng tạo 4.0 UTT",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const db = getDb();

  // Fetch real statistics in parallel
  const [
    totalIdeas,
    groupedStatus,
    totalSubmitters,
    totalEmailJobs,
    groupedEmailStatus,
    recentEmailJobs,
    totalRecruitmentPosts,
    recentIdeas,
    googleSheetsConfig,
  ] = await Promise.all([
    db.idea.count(),
    db.idea.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.submitter.count(),
    db.emailJob.count(),
    db.emailJob.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.emailJob.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        recipient: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
        processedAt: true,
        lastError: true,
      },
    }),
    db.ideaRecruitmentPost.count(),
    db.idea.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        submitter: {
          select: {
            fullName: true,
            email: true,
            studentCode: true,
            className: true,
          },
        },
      },
    }),
    getGoogleSheetsConfig(),
  ]);

  const emailStatusCounts: Record<EmailJobStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
  };

  for (const eg of groupedEmailStatus) {
    emailStatusCounts[eg.status] = eg._count.id;
  }

  const statusCounts: Record<IdeaStatus, number> = {
    PENDING_VERIFICATION: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    NEEDS_REVISION: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  for (const group of groupedStatus) {
    statusCounts[group.status] = group._count.id;
  }

  const statCards = [
    {
      title: "Tổng ý tưởng",
      count: totalIdeas,
      href: "/quan-tri/y-tuong",
      icon: Lightbulb,
      color: "var(--brand-orange)",
      bg: "rgba(242, 92, 5, 0.08)",
      desc: "Tất cả hồ sơ trong hệ thống",
    },
    {
      title: "Chờ xác minh email",
      count: statusCounts.PENDING_VERIFICATION,
      href: "/quan-tri/y-tuong?status=PENDING_VERIFICATION",
      icon: Clock,
      color: "#64748b",
      bg: "rgba(100, 116, 139, 0.08)",
      desc: "Chưa kích hoạt qua email",
    },
    {
      title: "Đã gửi hợp lệ",
      count: statusCounts.SUBMITTED,
      href: "/quan-tri/y-tuong?status=SUBMITTED",
      icon: Inbox,
      color: "#0284c7",
      bg: "rgba(2, 132, 199, 0.08)",
      desc: "Chờ ban giám khảo tiếp nhận",
    },
    {
      title: "Đang xét duyệt",
      count: statusCounts.UNDER_REVIEW,
      href: "/quan-tri/y-tuong?status=UNDER_REVIEW",
      icon: Search,
      color: "#ea580c",
      bg: "rgba(234, 88, 12, 0.08)",
      desc: "Đang được ban giám khảo đánh giá",
    },
    {
      title: "Cần chỉnh sửa",
      count: statusCounts.NEEDS_REVISION,
      href: "/quan-tri/y-tuong?status=NEEDS_REVISION",
      icon: AlertTriangle,
      color: "#d97706",
      bg: "rgba(217, 119, 6, 0.08)",
      desc: "Yêu cầu thí sinh bổ sung hồ sơ",
    },
    {
      title: "Đã duyệt vào vòng trong",
      count: statusCounts.APPROVED,
      href: "/quan-tri/y-tuong?status=APPROVED",
      icon: CheckCircle2,
      color: "#16a34a",
      bg: "rgba(22, 163, 74, 0.08)",
      desc: "Đạt tiêu chuẩn đánh giá",
    },
    {
      title: "Đã từ chối",
      count: statusCounts.REJECTED,
      href: "/quan-tri/y-tuong?status=REJECTED",
      icon: XCircle,
      color: "#dc2626",
      bg: "rgba(220, 38, 38, 0.08)",
      desc: "Không phù hợp tiêu chí",
    },
    {
      title: "Người gửi (Tác giả)",
      count: totalSubmitters,
      href: "/quan-tri/y-tuong",
      icon: Users,
      color: "#6366f1",
      bg: "rgba(99, 102, 241, 0.08)",
      desc: `Đã gửi ${emailStatusCounts.SENT}/${totalEmailJobs} email • Chờ: ${emailStatusCounts.PENDING + emailStatusCounts.PROCESSING}`,
    },
    {
      title: "Hội chợ ý tưởng",
      count: totalRecruitmentPosts,
      href: "/quan-tri/hoi-cho-y-tuong",
      icon: Sparkles,
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.08)",
      desc: "Tin tuyển thành viên nghiên cứu",
    },
  ];

  return (
    <div className="container">
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: 6,
            }}
          >
            Tổng quan Hệ thống Quản trị
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Dữ liệu trực tiếp từ PostgreSQL • Phiên làm việc: {session.user.name}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AdminGoogleSheetsPanel initialConfig={googleSheetsConfig} />
          <Link
            href="/quan-tri/y-tuong"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "var(--brand-orange)",
              color: "#fff",
              padding: "9px 18px",
              borderRadius: "var(--radius)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span>Danh sách Ý tưởng</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "20px 18px",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--muted)",
                    }}
                  >
                    {card.title}
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      backgroundColor: card.bg,
                      color: card.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--foreground)",
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}
                >
                  {card.count.toLocaleString("vi-VN")}
                </div>

                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {card.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Submissions Section */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>
              Hồ sơ mới gửi gần đây
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Cập nhật thời gian thực từ cơ sở dữ liệu
            </p>
          </div>

          <Link
            href="/quan-tri/y-tuong"
            style={{
              fontSize: 13,
              color: "var(--brand-orange)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Xem tất cả <ArrowRight size={14} />
          </Link>
        </div>

        {recentIdeas.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            Chưa có hồ sơ ý tưởng nào trong hệ thống.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <th style={{ padding: "10px 12px" }}>Mã hồ sơ</th>
                  <th style={{ padding: "10px 12px" }}>Tên ý tưởng</th>
                  <th style={{ padding: "10px 12px" }}>Người gửi</th>
                  <th style={{ padding: "10px 12px" }}>Trạng thái</th>
                  <th style={{ padding: "10px 12px" }}>Thời gian</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentIdeas.map((idea) => {
                  const badge = STATUS_BADGE_VARIANTS[idea.status];
                  return (
                    <tr
                      key={idea.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 600,
                          fontFamily: "monospace",
                          color: "var(--brand-orange)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {idea.referenceCode || idea.id.slice(0, 8)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 600,
                          maxWidth: 280,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {idea.title}
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div>{idea.submitter.fullName}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {idea.submitter.studentCode} • {idea.submitter.className}
                        </div>
                      </td>
                      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "3px 10px",
                            borderRadius: "12px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "var(--muted)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(idea.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          href={`/quan-tri/y-tuong/${idea.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            gap: 4,
                            padding: "4px 10px",
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--foreground)",
                            textDecoration: "none",
                          }}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Outbox Queue Monitor Section */}
      <div
        style={{
          marginTop: 28,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              Giám sát Hàng đợi Email (Transactional Outbox & Priority Queue)
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Ưu tiên 1: OTP & Xác minh • Ưu tiên 2: Ứng tuyển • Ưu tiên 3: Thông báo xét duyệt (Giãn cách thích ứng SMTP Pool)
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: "rgba(22, 163, 74, 0.1)",
                color: "#16a34a",
                border: "1px solid rgba(22, 163, 74, 0.25)",
              }}
            >
              Đã gửi (SENT): {emailStatusCounts.SENT}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: "rgba(2, 132, 199, 0.1)",
                color: "#0284c7",
                border: "1px solid rgba(2, 132, 199, 0.25)",
              }}
            >
              Đang chờ / Xử lý: {emailStatusCounts.PENDING + emailStatusCounts.PROCESSING}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor:
                  emailStatusCounts.FAILED > 0
                    ? "rgba(220, 38, 38, 0.1)"
                    : "rgba(100, 116, 139, 0.1)",
                color: emailStatusCounts.FAILED > 0 ? "#dc2626" : "#64748b",
                border:
                  emailStatusCounts.FAILED > 0
                    ? "1px solid rgba(220, 38, 38, 0.25)"
                    : "1px solid rgba(100, 116, 139, 0.25)",
              }}
            >
              Lỗi (FAILED): {emailStatusCounts.FAILED}
            </span>
          </div>
        </div>

        {recentEmailJobs.length === 0 ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            Chưa có tác vụ email nào trong hàng đợi.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <th style={{ padding: "10px 12px" }}>Loại tác vụ Email</th>
                  <th style={{ padding: "10px 12px" }}>Mức ưu tiên</th>
                  <th style={{ padding: "10px 12px" }}>Người nhận</th>
                  <th style={{ padding: "10px 12px" }}>Trạng thái</th>
                  <th style={{ padding: "10px 12px" }}>Số lần thử</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {recentEmailJobs.map((job) => {
                  const priority = getEmailJobPriority(job.type);
                  const priorityLabel =
                    priority === 1
                      ? "Ưu tiên 1 (Tức thì)"
                      : priority === 2
                        ? "Ưu tiên 2 (Trung bình)"
                        : "Ưu tiên 3 (Cuối hàng)";
                  const priorityColor =
                    priority === 1 ? "#ea580c" : priority === 2 ? "#0284c7" : "#64748b";

                  const statusStyle =
                    job.status === "SENT"
                      ? { label: "Đã gửi", color: "#16a34a", bg: "rgba(22, 163, 74, 0.1)" }
                      : job.status === "FAILED"
                        ? { label: "Thất bại", color: "#dc2626", bg: "rgba(220, 38, 38, 0.1)" }
                        : job.status === "PROCESSING"
                          ? { label: "Đang gửi", color: "#d97706", bg: "rgba(217, 119, 6, 0.1)" }
                          : { label: "Chờ gửi", color: "#0284c7", bg: "rgba(2, 132, 199, 0.1)" };

                  return (
                    <tr key={job.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "11px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {EMAIL_JOB_TYPE_LABELS[job.type] || job.type}
                      </td>
                      <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: priorityColor,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {priorityLabel}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                        {job.recipient}
                      </td>
                      <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "2px 9px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            color: statusStyle.color,
                            backgroundColor: statusStyle.bg,
                          }}
                          title={job.lastError || undefined}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td
                        style={{
                          padding: "11px 12px",
                          textAlign: "right",
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(job.processedAt || job.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
