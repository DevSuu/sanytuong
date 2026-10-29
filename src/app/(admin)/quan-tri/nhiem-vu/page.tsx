import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Search, ArrowRight, Users, CheckCircle2 } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  TaskStatus,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGES,
} from "@/lib/domain/task-state-machine";
import { AdminCreateTaskModal } from "@/components/admin-create-task-modal";
import { AdminExportButton } from "@/components/admin-export-button";
import { AdminDeleteTaskButton } from "@/components/admin-delete-task-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Nhiệm vụ đặt hàng — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
}

export default async function AdminTasksPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { status: statusFilter, q: searchQuery } = await searchParams;
  const db = getDb();

  const where: Prisma.TaskWhereInput = {};
  if (statusFilter && Object.values(TaskStatus).includes(statusFilter as TaskStatus)) {
    where.status = statusFilter as TaskStatus;
  }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { orderingOrganization: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const [tasks, totalCount, statusCounts] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
        applications: {
          where: { status: "SELECTED" },
          take: 1,
          include: {
            submitter: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
              },
            },
          },
        },
      },
    }),
    db.task.count(),
    db.task.groupBy({
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
            <Briefcase size={28} style={{ color: "var(--brand-orange)" }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              Quản lý Nhiệm vụ đặt hàng & Xét chọn nhóm
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Quản trị vòng đời nhiệm vụ, theo dõi hồ sơ đăng ký của sinh viên và phân bổ giao việc cho nhóm phù hợp.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AdminExportButton
            exportUrl="/api/admin/tasks/export"
            queryParams={{
              q: searchQuery,
              status: statusFilter,
            }}
            filenameDefault="tasks.xlsx"
          />
          <AdminCreateTaskModal />
        </div>
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
          href="/quan-tri/nhiem-vu"
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

        {Object.values(TaskStatus).map((st) => {
          const isActive = statusFilter === st;
          const count = countMap[st] || 0;
          return (
            <Link
              key={st}
              href={`/quan-tri/nhiem-vu?status=${st}`}
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
              {TASK_STATUS_LABELS[st]} ({count})
            </Link>
          );
        })}
      </div>

      {/* Search Bar */}
      <form
        method="GET"
        action="/quan-tri/nhiem-vu"
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
            placeholder="Tìm theo tiêu đề nhiệm vụ, đơn vị đặt hàng..."
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

      {/* Tasks Table */}
      {tasks.length === 0 ? (
        <div
          className="form-panel"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}
        >
          <Briefcase size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 15, margin: 0 }}>Không tìm thấy nhiệm vụ nào phù hợp.</p>
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
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 13 }}>
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
                <th style={{ padding: "12px 16px" }}>Tiêu đề nhiệm vụ</th>
                <th style={{ padding: "12px 16px" }}>Đơn vị đặt hàng</th>
                <th style={{ padding: "12px 16px" }}>Trạng thái</th>
                <th style={{ padding: "12px 16px" }}>Đơn đăng ký</th>
                <th style={{ padding: "12px 16px" }}>Nhóm được chọn</th>
                <th style={{ padding: "12px 16px" }}>Hạn đăng ký</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const badge = TASK_STATUS_BADGES[task.status] || {
                  bg: "#f1f5f9",
                  color: "#334155",
                  border: "#cbd5e1",
                };
                const selectedApp = task.applications[0];

                return (
                  <tr key={task.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 600, maxWidth: 280 }}>
                      <Link
                        href={`/quan-tri/nhiem-vu/${task.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                        className="hover:underline"
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {task.title}
                        </div>
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        /{task.slug}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 600 }}>{task.orderingOrganization}</span>
                      {task.reward && (
                        <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {task.reward}
                        </div>
                      )}
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
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
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
                          fontWeight: 600,
                        }}
                      >
                        <Users size={12} />
                        {task._count.applications} đơn
                      </span>
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {selectedApp ? (
                        <div>
                          <div style={{ fontWeight: 600, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                            <span>{selectedApp.submitter.fullName}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            MSSV: {selectedApp.submitter.studentCode}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Chưa giao</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {task.applicationDeadline
                        ? new Date(task.applicationDeadline).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Link
                          href={`/quan-tri/nhiem-vu/${task.id}`}
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
                          <span>Chi tiết & Duyệt</span>
                          <ArrowRight size={13} />
                        </Link>
                        <AdminDeleteTaskButton
                          taskId={task.id}
                          taskTitle={task.title}
                          applicationsCount={task._count.applications}
                        />
                      </div>
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
