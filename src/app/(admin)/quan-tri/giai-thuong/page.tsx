import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award as AwardIcon, Search, Eye, ExternalLink } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  AwardStatus,
  AWARD_STATUS_LABELS,
  AWARD_STATUS_BADGES,
  SEASON_STATUS_BADGES,
} from "@/lib/domain/award-state-machine";
import { AdminCreateAwardModal } from "@/components/admin-create-award-modal";
import { AdminSeasonModal } from "@/components/admin-season-modal";
import { AdminHighlightsModal } from "@/components/admin-highlights-modal";
import { AdminAwardActions } from "@/components/admin-award-actions";
import { AdminExportButton } from "@/components/admin-export-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Giải thưởng & Sảnh vinh danh — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    seasonId?: string;
    isDemo?: string;
    q?: string;
  }>;
}

export default async function AdminAwardsPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { status: statusFilter, seasonId: seasonFilter, isDemo: demoFilter, q: searchQuery } =
    await searchParams;
  const db = getDb();

  const where: Prisma.AwardWhereInput = {};
  if (statusFilter && Object.values(AwardStatus).includes(statusFilter as AwardStatus)) {
    where.status = statusFilter as AwardStatus;
  }
  if (seasonFilter) {
    where.seasonId = seasonFilter;
  }
  if (demoFilter === "true") {
    where.isDemo = true;
  } else if (demoFilter === "false") {
    where.isDemo = false;
  }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { awardName: { contains: searchQuery, mode: "insensitive" } },
      { category: { contains: searchQuery, mode: "insensitive" } },
      { organization: { contains: searchQuery, mode: "insensitive" } },
      { shortDescription: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  // Load seasons, awards list, counts
  const [seasons, awards, totalCount, statusCounts] = await Promise.all([
    db.awardSeason.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { awards: true },
        },
      },
    }),
    db.award.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        _count: {
          select: {
            members: true,
            history: true,
          },
        },
      },
    }),
    db.award.count(),
    db.award.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const countMap: Record<string, number> = {};
  statusCounts.forEach((c) => {
    countMap[c.status] = c._count.status;
  });

  return (
    <div className="container" style={{ maxWidth: 1240 }}>
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
            <AwardIcon size={28} style={{ color: "var(--brand-orange)" }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              Quản lý Giải thưởng & Sảnh vinh danh
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Quản trị vòng đời giải thưởng theo mùa giải, phê duyệt xuất bản công khai lên Sảnh Giải thưởng.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <AdminExportButton
            exportUrl="/api/admin/awards/export"
            queryParams={{
              q: searchQuery,
              status: statusFilter,
              seasonId: seasonFilter,
              isDemo: demoFilter,
            }}
            filenameDefault="awards.xlsx"
          />
          <AdminHighlightsModal />
          <AdminSeasonModal
            seasons={seasons.map((s) => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
              status: s.status,
              isDemo: s.isDemo,
              description: s.description,
              startDate: s.startDate ? s.startDate.toISOString() : null,
              endDate: s.endDate ? s.endDate.toISOString() : null,
              _count: s._count,
            }))}
          />
          <AdminCreateAwardModal
            seasons={seasons.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
            }))}
          />
        </div>
      </div>

      {/* Filter Tabs by Status */}
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
          href="/quan-tri/giai-thuong"
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

        {Object.values(AwardStatus).map((st) => {
          const isActive = statusFilter === st;
          const count = countMap[st] || 0;
          return (
            <Link
              key={st}
              href={`/quan-tri/giai-thuong?status=${st}${seasonFilter ? `&seasonId=${seasonFilter}` : ""}${demoFilter ? `&isDemo=${demoFilter}` : ""}`}
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
              {AWARD_STATUS_LABELS[st]} ({count})
            </Link>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <form
        method="GET"
        action="/quan-tri/giai-thuong"
        className="resp-filter-bar"
        style={{
          marginBottom: 20,
        }}
      >
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

        <div style={{ position: "relative" }}>
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
            placeholder="Tìm theo tên ý tưởng, hạng giải, lĩnh vực, khoa..."
            className="form-input"
            style={{ width: "100%", paddingLeft: 38, height: 38, fontSize: 13 }}
          />
        </div>

        <select
          name="seasonId"
          defaultValue={seasonFilter || ""}
          className="form-input"
          style={{ height: 38, fontSize: 13 }}
        >
          <option value="">-- Mọi mùa giải --</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          name="isDemo"
          defaultValue={demoFilter || ""}
          className="form-input"
          style={{ height: 38, fontSize: 13 }}
        >
          <option value="">-- Mọi loại dữ liệu --</option>
          <option value="false">Dữ liệu chính thức</option>
          <option value="true">Dữ liệu Demo / Minh họa</option>
        </select>

        <button
          type="submit"
          className="button button-primary"
          style={{ height: 38, padding: "0 18px", fontSize: 13 }}
        >
          Lọc
        </button>
      </form>

      {/* Awards Table */}
      {awards.length === 0 ? (
        <div
          className="form-panel"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}
        >
          <AwardIcon size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 15, margin: 0 }}>Không tìm thấy giải thưởng nào phù hợp bộ lọc.</p>
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
                <th style={{ padding: "12px 14px", width: 60, textAlign: "center" }}>STT</th>
                <th style={{ padding: "12px 14px" }}>Hạng giải</th>
                <th style={{ padding: "12px 14px" }}>Tên ý tưởng / Đề tài</th>
                <th style={{ padding: "12px 14px" }}>Mùa giải</th>
                <th style={{ padding: "12px 14px" }}>Phân loại</th>
                <th style={{ padding: "12px 14px" }}>Trạng thái</th>
                <th style={{ padding: "12px 14px" }}>Thành viên</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {awards.map((award) => {
                const statusBadge = AWARD_STATUS_BADGES[award.status] || {
                  bg: "#f1f5f9",
                  color: "#334155",
                  border: "#cbd5e1",
                };
                const seasonBadge = SEASON_STATUS_BADGES[award.season.status] || {
                  bg: "#f1f5f9",
                  color: "#334155",
                  border: "#cbd5e1",
                };

                return (
                  <tr key={award.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {/* Display Order */}
                    <td style={{ padding: "12px 14px", textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>
                      {award.displayOrder}
                    </td>

                    {/* Prize Name */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: 12,
                          fontWeight: 700,
                          background: "rgba(234, 88, 12, 0.12)",
                          color: "var(--brand-orange)",
                          border: "1px solid rgba(234, 88, 12, 0.25)",
                        }}
                      >
                        {award.awardName}
                      </span>
                    </td>

                    {/* Title & Organization */}
                    <td style={{ padding: "12px 14px", maxWidth: 360 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 52,
                            height: 34,
                            borderRadius: 6,
                            overflow: "hidden",
                            flexShrink: 0,
                            border: "1px solid var(--border)",
                            background:
                              "linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(30, 58, 138, 0.15) 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {award.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={award.imageUrl}
                              alt={award.title}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <AwardIcon size={16} style={{ color: "var(--brand-orange)", opacity: 0.7 }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Link
                            href={`/quan-tri/giai-thuong/${award.id}`}
                            style={{
                              fontWeight: 600,
                              color: "var(--foreground)",
                              textDecoration: "none",
                            }}
                          >
                            {award.title}
                          </Link>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                            {award.category && <span>{award.category}</span>}
                            {award.organization && (
                              <>
                                <span>•</span>
                                <span>{award.organization}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Season */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 500 }}>{award.season.name}</div>
                      <span
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: seasonBadge.bg,
                          color: seasonBadge.color,
                          border: `1px solid ${seasonBadge.border}`,
                          fontWeight: 600,
                        }}
                      >
                        {award.season.status}
                      </span>
                    </td>

                    {/* Demo / Official */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {award.isDemo ? (
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#fef3c7",
                            color: "#b45309",
                            border: "1px solid #fde047",
                          }}
                        >
                          Demo / Minh họa
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          Chính thức
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background: statusBadge.bg,
                          color: statusBadge.color,
                          border: `1px solid ${statusBadge.border}`,
                        }}
                      >
                        {AWARD_STATUS_LABELS[award.status]}
                      </span>
                    </td>

                    {/* Members Count */}
                    <td style={{ padding: "12px 14px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {award._count.members} thành viên
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                        <AdminAwardActions
                          awardId={award.id}
                          status={award.status}
                          seasonStatus={award.season.status}
                        />

                        {award.status === "PUBLISHED" && award.season.status === "PUBLISHED" && (
                          <Link
                            href={`/san-giai-thuong/${award.slug}`}
                            target="_blank"
                            title="Xem trang công khai"
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <ExternalLink size={13} />
                          </Link>
                        )}

                        <Link
                          href={`/quan-tri/giai-thuong/${award.id}`}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 4,
                            background: "var(--background)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye size={12} /> Chi tiết
                        </Link>
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
