import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  History,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  PROFILE_COMPLETED_BADGE,
  PROFILE_APPROVED_BADGE,
  getIdeaDisplayBadge,
} from "@/lib/domain/idea-state-machine";
import {
  MemberType,
  PROFILE_STATUS_LABELS,
  PROFILE_STATUS_BADGES,
} from "@/lib/domain/profile-state-machine";
import { AdminProfileDetailActions } from "@/components/admin-profile-detail-actions";
import {
  resolveHistoryActorDisplay,
  HistoryActorUser,
} from "@/lib/domain/idea-history-actor";
import { AdminIdeaActionPanel } from "@/components/admin-idea-action-panel";

export const metadata = {
  title: "Chi tiết Ý tưởng — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminIdeaDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { id } = await params;
  const db = getDb();

  const idea = await db.idea.findUnique({
    where: { id },
    include: {
      submitter: {
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          className: true,
          email: true,
          phone: true,
          major: true,
          bankAccountNumber: true,
          bankName: true,
          bankBranch: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      projectProfile: {
        include: {
          members: { orderBy: { orderIndex: "asc" } },
          editRequests: { orderBy: { createdAt: "desc" } },
          history: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!idea) {
    notFound();
  }

  // Resolve actors for both Idea status history and Round 2 Profile history entries
  const profileHistoryList = idea.projectProfile?.history ?? [];
  const actorUserIds = Array.from(
    new Set(
      [
        ...idea.statusHistory.map((h) => h.actorId),
        ...profileHistoryList.map((ph) => ph.actorId),
      ].filter((id): id is string => Boolean(id && id.trim() !== ""))
    )
  );

  const actorUsers: HistoryActorUser[] =
    actorUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: actorUserIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

  const actorMap = new Map(actorUsers.map((user) => [user.id, user]));

  const badge = getIdeaDisplayBadge(idea.status, idea.projectProfile?.status);

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Back button and Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/quan-tri/y-tuong"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          <span>Quay lại danh sách ý tưởng</span>
        </Link>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "4px 10px",
                  backgroundColor: "rgba(242, 92, 5, 0.1)",
                  color: "var(--brand-orange)",
                  borderRadius: "var(--radius)",
                }}
              >
                {idea.referenceCode || idea.id.slice(0, 8)}
              </span>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "14px",
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
              {idea.projectProfile && (
                <Link
                  href={`/quan-tri/ho-so/${idea.projectProfile.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: "14px",
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: "rgba(2, 132, 199, 0.1)",
                    color: "#0284c7",
                    border: "1px solid rgba(2, 132, 199, 0.3)",
                    textDecoration: "none",
                  }}
                >
                  <FileText size={13} />
                  <span>Xem Hồ sơ Đề tài (Vòng 2)</span>
                </Link>
              )}
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--foreground)",
                lineHeight: 1.3,
              }}
            >
              {idea.title}
            </h1>
            {idea.field && (
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                Lĩnh vực nghiên cứu:{" "}
                <strong style={{ color: "var(--brand-orange)" }}>
                  {idea.field}
                </strong>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              textAlign: "right",
            }}
          >
            <div>
              Ngày gửi:{" "}
              <strong>
                {new Date(idea.createdAt).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
            <div>
              Cập nhật:{" "}
              <strong>
                {new Date(idea.updatedAt).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Left Column: Idea Content & Submitter Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* Submitter Details */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "clamp(16px, 3.5vw, 22px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <User size={18} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                Thông tin Tác giả / Nhóm trưởng (Người đại diện nhóm)
              </h2>
            </div>

            <div
              className="resp-grid-2"
              style={{
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  HỌ VÀ TÊN
                </div>
                <div style={{ fontWeight: 600 }}>{idea.submitter.fullName}</div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  MÃ CÁN BỘ / SINH VIÊN
                </div>
                <div style={{ fontWeight: 600, fontFamily: "monospace" }}>
                  {idea.submitter.studentCode}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  SỐ ĐIỆN THOẠI
                </div>
                <div style={{ fontWeight: 600 }}>
                  {idea.submitter.phone || "Chưa cập nhật"}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  LỚP SINH HOẠT
                </div>
                <div>{idea.submitter.className || "Không áp dụng (Cán bộ)"}</div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  EMAIL LIÊN HỆ
                </div>
                <div style={{ color: "var(--foreground)", overflowWrap: "anywhere" }}>
                  {idea.submitter.email}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 2 }}>
                  TRẠNG THÁI EMAIL
                </div>
                {idea.submitter.emailVerifiedAt ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#16a34a",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Đã xác minh</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#dc2626",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    <XCircle size={13} />
                    <span>Chưa kích hoạt</span>
                  </span>
                )}
              </div>

              {/* Thông tin tài khoản ngân hàng */}
              <div style={{ gridColumn: "1 / -1", marginTop: 8, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>
                  THÔNG TIN TÀI KHOẢN NGÂN HÀNG THỤ HƯỞNG
                </div>
                <div className="resp-grid-2" style={{ gap: 10 }}>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Ngân hàng: </span>
                    <strong>{idea.submitter.bankName || "Chưa cập nhật"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Số TK: </span>
                    <strong style={{ fontFamily: "monospace" }}>{idea.submitter.bankAccountNumber || "Chưa cập nhật"}</strong>
                  </div>
                  {idea.submitter.bankBranch && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "var(--muted)" }}>Chi nhánh: </span>
                      <span>{idea.submitter.bankBranch}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Round 2 Team Roster Card */}
          {idea.projectProfile && idea.projectProfile.members.length > 0 && (
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "clamp(16px, 3.5vw, 22px)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={18} color="var(--brand-orange)" />
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    Hồ sơ Đội thi &amp; GVHD Vòng 2 ({idea.projectProfile.members.length} thành viên)
                  </h2>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: PROFILE_STATUS_BADGES[idea.projectProfile.status].bg,
                    color: PROFILE_STATUS_BADGES[idea.projectProfile.status].color,
                    border: `1px solid ${PROFILE_STATUS_BADGES[idea.projectProfile.status].border}`,
                  }}
                >
                  Hồ sơ đội: {PROFILE_STATUS_LABELS[idea.projectProfile.status]}
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        textAlign: "left",
                        color: "var(--muted)",
                      }}
                    >
                      <th style={{ padding: "8px 10px" }}>#</th>
                      <th style={{ padding: "8px 10px" }}>Họ và tên</th>
                      <th style={{ padding: "8px 10px" }}>Vai trò</th>
                      <th style={{ padding: "8px 10px" }}>Mã SV / Khoa</th>
                      <th style={{ padding: "8px 10px" }}>Lớp / SĐT</th>
                      <th style={{ padding: "8px 10px" }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idea.projectProfile.members.map((m, idx) => (
                      <tr
                        key={m.id || idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: m.isLeader ? "rgba(242, 92, 5, 0.04)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "9px 10px" }}>{idx + 1}</td>
                        <td style={{ padding: "9px 10px", fontWeight: 600 }}>
                          {m.fullName}
                          {m.isLeader && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "var(--brand-orange)",
                                color: "#fff",
                                fontWeight: 700,
                              }}
                            >
                              Trưởng nhóm
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          {m.memberType === MemberType.ADVISOR ? (
                            <span style={{ color: "#0284c7", fontWeight: 600 }}>GVHD</span>
                          ) : (
                            <span>Sinh viên</span>
                          )}
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          {m.memberType === MemberType.ADVISOR
                            ? m.department || "—"
                            : m.studentCode || "—"}
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          {m.memberType === MemberType.ADVISOR
                            ? m.phone || "—"
                            : m.className || "—"}
                        </td>
                        <td style={{ padding: "9px 10px", color: "var(--muted)" }}>{m.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Proposal Sections */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileText size={18} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Mô tả Ý tưởng & Nội dung Chi tiết Đề tài</h2>
            </div>

            {/* Mô tả chi tiết */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                1. MÔ TẢ CHI TIẾT Ý TƯỞNG
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--foreground)",
                  whiteSpace: "pre-wrap",
                  backgroundColor: "var(--background)",
                  padding: 16,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}
              >
                {idea.description}
              </div>
            </div>

            {/* Sản phẩm dự kiến */}
            {idea.expectedProduct && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  2. SẢN PHẨM DỰ KIẾN
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: "var(--background)",
                    padding: 16,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {idea.expectedProduct}
                </div>
              </div>
            )}

            {/* Tính cấp thiết */}
            {idea.necessity && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  3. TÍNH CẤP THIẾT
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: "var(--background)",
                    padding: 16,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {idea.necessity}
                </div>
              </div>
            )}

            {/* Tính mới & sáng tạo sơ bộ */}
            {idea.innovation && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  4. TÍNH MỚI & SÁNG TẠO SƠ BỘ
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: "var(--background)",
                    padding: 16,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {idea.innovation}
                </div>
              </div>
            )}

            {/* Tính khả thi */}
            {idea.feasibility && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  5. TÍNH KHẢ THI
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: "var(--background)",
                    padding: 16,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {idea.feasibility}
                </div>
              </div>
            )}

            {/* Tiềm năng phát triển */}
            {idea.potential && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  6. TIỀM NĂNG PHÁT TRIỂN
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: "var(--background)",
                    padding: 16,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {idea.potential}
                </div>
              </div>
            )}

            {/* Hỗ trợ thành viên Vòng 2 */}
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: idea.needsMemberSupport ? "rgba(234, 88, 12, 0.08)" : "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Nhu cầu hỗ trợ bổ sung thành viên ở Vòng 2:</span>
              <strong style={{ color: idea.needsMemberSupport ? "var(--brand-orange)" : "var(--foreground)" }}>
                {idea.needsMemberSupport ? "Có nhu cầu hỗ trợ kết nối thêm thành viên" : "Không (Nhóm đã đủ thành viên)"}
              </strong>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Audit History Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Action Panel */}
          <AdminIdeaActionPanel
            ideaId={idea.id}
            currentStatus={idea.status}
          >
            {idea.status === "APPROVED" && idea.projectProfile ? (
              <AdminProfileDetailActions
                profileId={idea.projectProfile.id}
                currentTitle={idea.title}
                status={idea.projectProfile.status}
                currentMembers={idea.projectProfile.members}
                editRequests={idea.projectProfile.editRequests}
              />
            ) : undefined}
          </AdminIdeaActionPanel>

          {/* Audit History Timeline */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <History size={18} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                Nhật ký Xét duyệt & Lịch sử
              </h2>
            </div>

            {idea.statusHistory.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  padding: "16px 0",
                  textAlign: "center",
                }}
              >
                Chưa có thao tác cập nhật trạng thái nào được ghi nhận.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  position: "relative",
                  paddingLeft: 16,
                  borderLeft: "2px solid var(--border)",
                  marginLeft: 8,
                }}
              >
                {[
                  ...idea.statusHistory.map((h) => ({
                    id: h.id,
                    createdAt: h.createdAt,
                    fromLabel: STATUS_LABELS[h.oldStatus],
                    targetBadge: STATUS_BADGE_VARIANTS[h.newStatus],
                    actorDisplay: resolveHistoryActorDisplay(h, actorMap),
                    reason: h.reason,
                  })),
                  ...profileHistoryList
                    .filter((ph) => ph.action !== "PROFILE_CREATED" && ph.action !== "PROFILE_SAVED_DRAFT")
                    .map((ph) => {
                      const adminActor = ph.actorId ? actorMap.get(ph.actorId) : undefined;
                      const actorDisplay =
                        ph.actorRole === "LEADER"
                          ? `${idea.submitter.fullName} (Trưởng nhóm)`
                          : adminActor
                          ? `${adminActor.name} (Quản trị viên)`
                          : "Quản trị viên BTC";

                      let fromLabel = "Đã duyệt";
                      let targetBadge = PROFILE_COMPLETED_BADGE;

                      if (ph.action === "PROFILE_SUBMITTED") {
                        fromLabel = "Đã duyệt";
                        targetBadge = PROFILE_COMPLETED_BADGE;
                      } else if (ph.action === "PROFILE_COMPLETED") {
                        fromLabel = "Đã hoàn thiện hồ sơ";
                        targetBadge = PROFILE_APPROVED_BADGE;
                      } else if (ph.action === "PROFILE_NEEDS_REVISION") {
                        fromLabel = "Đã hoàn thiện hồ sơ";
                        targetBadge = {
                          label: "Yêu cầu bổ sung HS đội",
                          bg: "rgba(217, 119, 6, 0.12)",
                          color: "#d97706",
                          border: "rgba(217, 119, 6, 0.3)",
                        };
                      } else if (ph.action === "ADMIN_EDITED_PROFILE") {
                        fromLabel = "Hồ sơ đội Vòng 2";
                        targetBadge = {
                          label: "Admin chỉnh sửa trực tiếp",
                          bg: "rgba(2, 132, 199, 0.12)",
                          color: "#0284c7",
                          border: "rgba(2, 132, 199, 0.3)",
                        };
                      } else if (ph.action === "PROFILE_EDIT_REQUEST_CREATED") {
                        fromLabel = "Hồ sơ đội Vòng 2";
                        targetBadge = {
                          label: "Xin phép chỉnh sửa HS",
                          bg: "rgba(217, 119, 6, 0.12)",
                          color: "#d97706",
                          border: "rgba(217, 119, 6, 0.3)",
                        };
                      } else if (ph.action === "PROFILE_EDIT_REQUEST_APPROVED") {
                        fromLabel = "Yêu cầu sửa HS";
                        targetBadge = {
                          label: "Chấp thuận cho sửa HS",
                          bg: "rgba(22, 163, 74, 0.12)",
                          color: "#16a34a",
                          border: "rgba(22, 163, 74, 0.3)",
                        };
                      } else if (ph.action === "PROFILE_EDIT_REQUEST_REJECTED") {
                        fromLabel = "Yêu cầu sửa HS";
                        targetBadge = {
                          label: "Từ chối sửa HS",
                          bg: "rgba(220, 38, 38, 0.12)",
                          color: "#dc2626",
                          border: "rgba(220, 38, 38, 0.3)",
                        };
                      }

                      return {
                        id: ph.id,
                        createdAt: ph.createdAt,
                        fromLabel,
                        targetBadge,
                        actorDisplay,
                        reason: ph.reason,
                      };
                    }),
                ]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((history) => {
                    const targetBadge = history.targetBadge;
                    return (
                    <div
                      key={history.id}
                      style={{
                        position: "relative",
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: "absolute",
                          left: -23,
                          top: 4,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: targetBadge.color,
                          border: "2px solid var(--background)",
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {history.fromLabel} →
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: targetBadge.bg,
                            color: targetBadge.color,
                            border: `1px solid ${targetBadge.border}`,
                          }}
                        >
                          {targetBadge.label}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginLeft: "auto",
                          }}
                        >
                          {new Date(history.createdAt).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Người thực hiện:{" "}
                        <strong data-testid={`history-actor-${history.id}`}>
                          {history.actorDisplay}
                        </strong>
                      </div>

                      {history.reason && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: "8px 12px",
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            fontSize: 12,
                            color: "var(--foreground)",
                            fontStyle: "italic",
                          }}
                        >
                          &ldquo;{history.reason}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
