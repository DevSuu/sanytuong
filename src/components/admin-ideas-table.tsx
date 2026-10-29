"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  IdeaStatus,
  STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
} from "@/lib/domain/idea-state-machine";
import { AdminExportButton } from "./admin-export-button";

export interface IdeaTableRow {
  id: string;
  referenceCode: string | null;
  title: string;
  field?: string | null;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  submitter: {
    fullName: string;
    studentCode: string;
    className: string | null;
    email: string;
  };
}

interface AdminIdeasTableProps {
  data: IdeaTableRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  currentSearch: string;
  currentStatus: string;
  currentSort: string;
  currentOrder: string;
}

const columnHelper = createColumnHelper<IdeaTableRow>();

export function AdminIdeasTable({
  data,
  totalCount,
  page,
  pageSize,
  currentSearch,
  currentStatus,
  currentSort,
  currentOrder,
}: AdminIdeasTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(currentSearch);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`/quan-tri/y-tuong?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ search: searchInput.trim(), page: "1" });
  };

  const handleStatusChange = (newStatus: string) => {
    updateQueryParams({ status: newStatus || null, page: "1" });
  };

  const handleSortToggle = (field: string) => {
    if (currentSort === field) {
      const nextOrder = currentOrder === "asc" ? "desc" : "asc";
      updateQueryParams({ order: nextOrder });
    } else {
      updateQueryParams({ sort: field, order: "desc" });
    }
  };

  const columns = [
    columnHelper.accessor("referenceCode", {
      header: "Mã hồ sơ",
      cell: (info) => (
        <span
          style={{
            fontFamily: "monospace",
            fontWeight: 600,
            color: "var(--brand-orange)",
          }}
        >
          {info.getValue() || info.row.original.id.slice(0, 8)}
        </span>
      ),
    }),
    columnHelper.accessor("title", {
      header: "Tên ý tưởng",
      cell: (info) => (
        <div style={{ maxWidth: 280 }}>
          <div
            style={{
              fontWeight: 600,
              color: "var(--foreground)",
              lineHeight: 1.3,
            }}
          >
            {info.getValue()}
          </div>
          {info.row.original.field && (
            <div style={{ fontSize: 11, color: "var(--brand-orange)", marginTop: 3 }}>
              {info.row.original.field}
            </div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("submitter.fullName", {
      header: "Người gửi",
      cell: (info) => (
        <div>
          <div style={{ fontWeight: 500 }}>{info.getValue()}</div>
        </div>
      ),
    }),
    columnHelper.accessor("submitter.studentCode", {
      header: "Mã SV",
      cell: (info) => (
        <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("submitter.className", {
      header: "Lớp",
      cell: (info) => <span>{info.getValue()}</span>,
    }),
    columnHelper.accessor("submitter.email", {
      header: "Email",
      cell: (info) => (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Trạng thái",
      cell: (info) => {
        const val = info.getValue();
        const badge = STATUS_BADGE_VARIANTS[val];
        return (
          <span
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: "12px",
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
              whiteSpace: "nowrap",
            }}
          >
            {badge.label}
          </span>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: () => (
        <button
          type="button"
          onClick={() => handleSortToggle("createdAt")}
          style={{
            background: "none",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            font: "inherit",
            color: "inherit",
            padding: 0,
          }}
        >
          <span>Ngày gửi</span>
          <ArrowUpDown size={12} />
        </button>
      ),
      cell: (info) => (
        <span
          style={{
            color: "var(--muted)",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          {new Date(info.getValue()).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div style={{ textAlign: "right" }}>Thao tác</div>,
      cell: (info) => (
        <div style={{ textAlign: "right", display: "inline-flex", gap: 6, justifyContent: "flex-end", width: "100%" }}>
          <Link
            href={`/quan-tri/y-tuong/${info.row.original.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 12px",
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
          <button
            type="button"
            onClick={async () => {
              const row = info.row.original;
              if (
                !confirm(
                  `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ý tưởng "${row.referenceCode || row.title}" cùng toàn bộ hồ sơ Vòng 2 và tin tuyển dụng liên quan không?\nThao tác này không thể hoàn tác.`
                )
              ) {
                return;
              }
              try {
                const res = await fetch(`/api/admin/ideas/${row.id}/status`, {
                  method: "DELETE",
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error || "Không thể xóa ý tưởng.");
                  return;
                }
                router.refresh();
              } catch {
                alert("Lỗi kết nối khi xóa ý tưởng.");
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              backgroundColor: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "var(--radius)",
              fontSize: 12,
              fontWeight: 600,
              color: "#b91c1c",
              cursor: "pointer",
            }}
            title="Xóa vĩnh viễn ý tưởng này"
          >
            <Trash2 size={13} />
            <span>Xóa</span>
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 14,
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 300px",
          }}
        >
          <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
            <Search
              size={15}
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
              placeholder="Tìm theo tên ý tưởng, mã hồ sơ, tên SV, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                padding: "0 12px 0 36px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                fontSize: 13,
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              height: 38,
              padding: "0 14px",
              backgroundColor: "var(--brand-orange)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tìm kiếm
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={15} style={{ color: "var(--muted)" }} />
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                height: 38,
                padding: "0 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                fontSize: 13,
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {(currentSearch || currentStatus) && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                router.push("/quan-tri/y-tuong");
              }}
              style={{
                height: 38,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 12px",
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}

          <AdminExportButton
            exportUrl="/api/admin/ideas/export"
            queryParams={{
              search: currentSearch,
              status: currentStatus,
              sort: currentSort,
              order: currentOrder,
            }}
            filenameDefault="ideas.xlsx"
          />
        </div>
      </div>

      {/* TanStack Table Element */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
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
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                        padding: "12px 14px",
                        color: "var(--muted)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: "48px 16px",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: 14,
                    }}
                  >
                    Không tìm thấy ý tưởng nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          padding: "12px 14px",
                          verticalAlign: "middle",
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Hiển thị{" "}
            <strong>
              {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
            </strong>{" "}
            - <strong>{Math.min(page * pageSize, totalCount)}</strong> trong tổng
            số <strong>{totalCount}</strong> hồ sơ
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateQueryParams({ page: String(page - 1) })}
              style={{
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "0 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: page <= 1 ? "var(--muted)" : "var(--foreground)",
                fontSize: 12,
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            <span style={{ fontSize: 12, color: "var(--muted)", padding: "0 6px" }}>
              Trang {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateQueryParams({ page: String(page + 1) })}
              style={{
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "0 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: page >= totalPages ? "var(--muted)" : "var(--foreground)",
                fontSize: 12,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              <span>Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
