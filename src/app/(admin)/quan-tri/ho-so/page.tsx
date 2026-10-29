import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, FileText, Search, ArrowRight } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  ProjectProfileStatus,
  PROFILE_STATUS_LABELS,
  PROFILE_STATUS_BADGES,
} from "@/lib/domain/profile-state-machine";
import { AdminExportButton } from "@/components/admin-export-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Hồ sơ Đề tài — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
}

export default async function AdminProfilesPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { status: statusFilter, q: searchQuery } = await searchParams;
  const db = getDb();

  const where: Prisma.ProjectProfileWhereInput = {};
  if (statusFilter && Object.values(ProjectProfileStatus).includes(statusFilter as ProjectProfileStatus)) {
    where.status = statusFilter as ProjectProfileStatus;
  }

  if (searchQuery) {
    where.OR = [
      { idea: { title: { contains: searchQuery, mode: "insensitive" } } },
      { idea: { referenceCode: { contains: searchQuery, mode: "insensitive" } } },
      { idea: { submitter: { fullName: { contains: searchQuery, mode: "insensitive" } } } },
      { idea: { submitter: { studentCode: { contains: searchQuery, mode: "insensitive" } } } },
      { members: { some: { fullName: { contains: searchQuery, mode: "insensitive" } } } },
      { members: { some: { studentCode: { contains: searchQuery, mode: "insensitive" } } } },
    ];
  }

  const [profiles, totalCount, statusCounts] = await Promise.all([
    db.projectProfile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        idea: {
          select: {
            id: true,
            referenceCode: true,
            title: true,
            submitter: {
              select: {
                fullName: true,
                studentCode: true,
                className: true,
                email: true,
              },
            },
          },
        },
        members: {
          select: {
            id: true,
            memberType: true,
            isLeader: true,
            fullName: true,
            studentCode: true,
          },
        },
        editRequests: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
    }),
    db.projectProfile.count(),
    db.projectProfile.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const countMap: Record<string, number> = {};
  statusCounts.forEach((c) => {
    countMap[c.status] = c._count.status;
  });

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Users size={28} style={{ color: "var(--brand-orange)" }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              Quản lý Hồ sơ Đề tài & Thành viên
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Kiểm duyệt thông tin thành viên, Giảng viên hướng dẫn và xét duyệt yêu cầu chỉnh sửa hồ sơ đề tài.
          </p>
        </div>

        <AdminExportButton
          exportUrl="/api/admin/profiles/export"
          queryParams={{
            q: searchQuery,
            status: statusFilter,
          }}
          filenameDefault="project_profiles.xlsx"
        />
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        <Link
          href="/quan-tri/ho-so"
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: 13,
            fontWeight: !statusFilter ? 700 : 500,
            textDecoration: "none",
            background: !statusFilter ? "var(--brand-orange)" : "transparent",
            color: !statusFilter ? "#fff" : "var(--foreground)",
          }}
        >
          Tất cả ({totalCount})
        </Link>

        {Object.values(ProjectProfileStatus).map((st) => {
          const isActive = statusFilter === st;
          const count = countMap[st] || 0;
          return (
            <Link
              key={st}
              href={`/quan-tri/ho-so?status=${st}`}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
                background: isActive ? "var(--brand-orange)" : "transparent",
                color: isActive ? "#fff" : "var(--foreground)",
              }}
            >
              {PROFILE_STATUS_LABELS[st]} ({count})
            </Link>
          );
        })}
      </div>

      {/* Search Bar */}
      <form
        method="GET"
        action="/quan-tri/ho-so"
        style={{ display: "flex", gap: 10, marginBottom: 20 }}
      >
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery || ""}
            placeholder="Tìm theo mã ý tưởng, tên đề tài, họ tên hoặc mã sinh viên..."
            className="form-input"
            style={{ width: "100%", paddingLeft: 38, height: 40, fontSize: 13 }}
          />
        </div>
        <button
          type="submit"
          className="button button-primary"
          style={{ height: 40, padding: "0 18px", fontSize: 13 }}
        >
          Tìm kiếm
        </button>
      </form>

      {/* Profile Table */}
      {profiles.length === 0 ? (
        <div
          className="form-panel"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}
        >
          <FileText size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 15, margin: 0 }}>Không tìm thấy hồ sơ đề tài nào phù hợp.</p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 13 }}>
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
                <th style={{ padding: "12px 16px" }}>Mã đề tài</th>
                <th style={{ padding: "12px 16px" }}>Tên đề tài</th>
                <th style={{ padding: "12px 16px" }}>Trưởng nhóm</th>
                <th style={{ padding: "12px 16px" }}>Số lượng</th>
                <th style={{ padding: "12px 16px" }}>Trạng thái</th>
                <th style={{ padding: "12px 16px" }}>Yêu cầu sửa</th>
                <th style={{ padding: "12px 16px" }}>Cập nhật</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const badge = PROFILE_STATUS_BADGES[p.status];
                const leader =
                  p.members.find((m) => m.isLeader) || p.idea.submitter;
                const pendingRequests = p.editRequests.length;

                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--brand-orange)", whiteSpace: "nowrap" }}>
                      {p.idea.referenceCode}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, maxWidth: 280 }}>
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.idea.title}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>{leader.fullName}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {leader.studentCode || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      >
                        <Users size={12} />
                        {p.members.length} người
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: 11,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {PROFILE_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {pendingRequests > 0 ? (
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(217, 119, 6, 0.15)",
                            color: "#d97706",
                          }}
                        >
                          {pendingRequests} chờ duyệt
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {new Date(p.updatedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`/quan-tri/ho-so/${p.id}`}
                        className="button button-ghost"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                          gap: 4,
                          fontSize: 12,
                          height: 32,
                          padding: "0 10px",
                        }}
                      >
                        <span>Chi tiết</span>
                        <ArrowRight size={13} />
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
  );
}
