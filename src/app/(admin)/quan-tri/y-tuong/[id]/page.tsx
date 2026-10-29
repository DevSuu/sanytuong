import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  History,
  User,
  XCircle,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
} from "@/lib/domain/idea-state-machine";
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
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!idea) {
    notFound();
  }

  // Resolve actors for status history entries
  const actorUserIds = Array.from(
    new Set(
      idea.statusHistory
        .map((h) => h.actorId)
        .filter((id): id is string => Boolean(id && id.trim() !== ""))
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

  const badge = STATUS_BADGE_VARIANTS[idea.status];

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
          />

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
                {idea.statusHistory.map((history) => {
                  const targetBadge = STATUS_BADGE_VARIANTS[history.newStatus];
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
                          {STATUS_LABELS[history.oldStatus]} →
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
                          {resolveHistoryActorDisplay(history, actorMap)}
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
