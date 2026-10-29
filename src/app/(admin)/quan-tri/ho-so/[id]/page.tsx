import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Users,
  FileText,
  History,
  User,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  MemberType,
  PROFILE_STATUS_LABELS,
  PROFILE_STATUS_BADGES,
  EDIT_REQUEST_STATUS_LABELS,
  EDIT_REQUEST_STATUS_BADGES,
} from "@/lib/domain/profile-state-machine";
import { AdminProfileDetailActions } from "@/components/admin-profile-detail-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chi tiết Hồ sơ Đề tài — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProfileDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { id } = await params;
  const db = getDb();

  const profile = await db.projectProfile.findUnique({
    where: { id },
    include: {
      idea: {
        include: {
          submitter: true,
        },
      },
      members: { orderBy: { orderIndex: "asc" } },
      editRequests: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!profile) {
    notFound();
  }

  const { idea, members, editRequests, history } = profile;
  const badge = PROFILE_STATUS_BADGES[profile.status];

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Back Link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/quan-tri/ho-so"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} />
          <span>Quay lại danh sách hồ sơ</span>
        </Link>

        {/* Title & Action Bar */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--brand-orange)",
                  background: "rgba(242, 92, 5, 0.1)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                {idea.referenceCode}
              </span>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {PROFILE_STATUS_LABELS[profile.status]}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              {idea.title}
            </h1>
          </div>

          <AdminProfileDetailActions
            profileId={profile.id}
            currentTitle={idea.title}
            status={profile.status}
            currentMembers={members}
            editRequests={editRequests}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        {/* Leader & Idea Information */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {/* Submitter Card */}
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <User size={18} style={{ color: "var(--brand-orange)" }} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Thông tin Người đại diện / Trưởng nhóm
              </h4>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--muted)" }}>Họ và tên:</span>{" "}
                <strong>{idea.submitter.fullName}</strong>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Mã sinh viên:</span>{" "}
                <strong>{idea.submitter.studentCode}</strong>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Lớp:</span>{" "}
                <strong>{idea.submitter.className}</strong>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Email:</span>{" "}
                <strong>{idea.submitter.email}</strong>
              </div>
              {idea.submitter.phone && (
                <div>
                  <span style={{ color: "var(--muted)" }}>SĐT:</span>{" "}
                  <strong>{idea.submitter.phone}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Idea Card */}
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <FileText size={18} style={{ color: "var(--brand-orange)" }} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Thông tin Đề tài
              </h4>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--muted)" }}>Mã hồ sơ:</span>{" "}
                <Link
                  href={`/quan-tri/y-tuong/${idea.id}`}
                  style={{ color: "var(--brand-orange)", fontWeight: 700, textDecoration: "underline" }}
                >
                  {idea.referenceCode} (Xem chi tiết Ý tưởng Vòng 1)
                </Link>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Ngày nộp:</span>{" "}
                {new Date(idea.createdAt).toLocaleDateString("vi-VN")}
              </div>
              {profile.submittedAt && (
                <div>
                  <span style={{ color: "var(--muted)" }}>Ngày gửi hồ sơ đề tài:</span>{" "}
                  {new Date(profile.submittedAt).toLocaleDateString("vi-VN")}
                </div>
              )}
              {profile.completedAt && (
                <div>
                  <span style={{ color: "var(--muted)" }}>Ngày hoàn tất:</span>{" "}
                  {new Date(profile.completedAt).toLocaleDateString("vi-VN")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Member Table */}
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Users size={18} style={{ color: "var(--brand-orange)" }} />
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Danh sách thành viên ({members.length} người)
            </h4>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: "var(--background)",
                    borderBottom: "2px solid var(--border)",
                    textAlign: "left",
                    color: "var(--muted)",
                  }}
                >
                  <th style={{ padding: "10px 12px" }}>#</th>
                  <th style={{ padding: "10px 12px" }}>Họ và tên</th>
                  <th style={{ padding: "10px 12px" }}>Vai trò</th>
                  <th style={{ padding: "10px 12px" }}>MSSV / Khoa</th>
                  <th style={{ padding: "10px 12px" }}>Lớp</th>
                  <th style={{ padding: "10px 12px" }}>Email</th>
                  <th style={{ padding: "10px 12px" }}>Số điện thoại</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: m.isLeader ? "rgba(242, 92, 5, 0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px" }}>{idx + 1}</td>
                    <td style={{ padding: "12px", fontWeight: 600 }}>
                      {m.fullName}
                      {m.isLeader && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--brand-orange)",
                            color: "#fff",
                          }}
                        >
                          Trưởng nhóm
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {m.memberType === MemberType.STUDENT ? "Sinh viên" : "GVHD"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {m.memberType === MemberType.STUDENT ? m.studentCode : m.department || "—"}
                    </td>
                    <td style={{ padding: "12px" }}>{m.className || "—"}</td>
                    <td style={{ padding: "12px" }}>{m.email}</td>
                    <td style={{ padding: "12px" }}>{m.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Requests Section */}
        {editRequests.length > 0 && (
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <h4 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700 }}>
              Yêu cầu chỉnh sửa từ Trưởng nhóm ({editRequests.length})
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {editRequests.map((er) => {
                const reqBadge = EDIT_REQUEST_STATUS_BADGES[er.status];
                return (
                  <div
                    key={er.id}
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        Ngày gửi: {new Date(er.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: 11,
                          fontWeight: 700,
                          background: reqBadge?.bg,
                          color: reqBadge?.color,
                          border: `1px solid ${reqBadge?.border}`,
                        }}
                      >
                        {EDIT_REQUEST_STATUS_LABELS[er.status]}
                      </span>
                    </div>

                    <div style={{ marginBottom: 4 }}>
                      <strong>Lý do xin sửa:</strong> {er.reason}
                    </div>

                    <div style={{ marginBottom: 6 }}>
                      <strong>Trường xin sửa:</strong> {er.requestedFields.join(", ")}
                    </div>

                    {er.rejectionReason && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "rgba(220, 38, 38, 0.08)",
                          color: "#dc2626",
                          fontSize: 12,
                        }}
                      >
                        <strong>Lý do từ chối:</strong> {er.rejectionReason}
                      </div>
                    )}

                    {er.allowedFields && er.allowedFields.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "rgba(22, 163, 74, 0.08)",
                          color: "#16a34a",
                          fontSize: 12,
                        }}
                      >
                        <strong>Trường được phép chỉnh sửa:</strong> {er.allowedFields.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Audit & History Timeline */}
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <History size={18} style={{ color: "var(--brand-orange)" }} />
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Lịch sử nghiệp vụ & Audit Trail
            </h4>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {history.map((h) => {
              interface AuditMetadata {
                changes?: Array<{ field: string; oldValue?: unknown; newValue?: unknown }>;
                [key: string]: unknown;
              }
              const metadata = h.metadata as AuditMetadata | null;
              return (
                <div
                  key={h.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "var(--foreground)" }}>
                      {h.action}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(h.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    Thực hiện bởi: <strong>{h.actorRole}</strong> {h.actorId ? `(${h.actorId})` : ""}
                  </div>

                  {h.reason && (
                    <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--foreground)" }}>
                      &ldquo;{h.reason}&rdquo;
                    </div>
                  )}

                  {/* Render structured changes if Admin directly edited */}
                  {metadata?.changes && Array.isArray(metadata.changes) && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.03)",
                        border: "1px dashed var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        Chi tiết các trường thay đổi:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {metadata.changes.map((c, cIdx: number) => (
                          <li key={cIdx}>
                            <strong>{c.field}</strong>:{" "}
                            <span style={{ color: "#dc2626", textDecoration: "line-through" }}>
                              {String(c.oldValue ?? "trống")}
                            </span>{" "}
                            → <span style={{ color: "#16a34a", fontWeight: 600 }}>{String(c.newValue ?? "trống")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
