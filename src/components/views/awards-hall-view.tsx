"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Trophy,
  Search,
  Users,
  Building2,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AwardSeasonItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  year?: number | null;
  isDemo: boolean;
}

interface AwardMemberItem {
  id: string;
  fullName: string;
  role?: string | null;
  className?: string | null;
  department?: string | null;
  isDemo: boolean;
}

interface AwardItem {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  awardName: string;
  category?: string | null;
  organization?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  displayOrder: number;
  isDemo: boolean;
  createdAt: string;
  season: {
    id: string;
    name: string;
    slug: string;
    year?: number | null;
    isDemo: boolean;
  };
  members: AwardMemberItem[];
}

export function AwardsHallView() {
  const [awards, setAwards] = useState<AwardItem[]>([]);
  const [seasons, setSeasons] = useState<AwardSeasonItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [selectedSeasonSlug, setSelectedSeasonSlug] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedPrize, setSelectedPrize] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    let ignore = false;
    async function fetchAwards() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedSeasonSlug !== "ALL") params.set("season", selectedSeasonSlug);
        if (selectedCategory !== "ALL") params.set("category", selectedCategory);
        if (selectedPrize !== "ALL") params.set("prize", selectedPrize);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/awards?${params.toString()}`);
        const data = await res.json();

        if (ignore) return;
        if (data.success) {
          setAwards(data.awards || []);
          setTotalCount(data.total || 0);
          if (data.seasons && Array.isArray(data.seasons) && seasons.length === 0) {
            setSeasons(data.seasons);
          }
          if (data.categories && Array.isArray(data.categories)) {
            setCategories(data.categories);
          }
          if (data.prizes && Array.isArray(data.prizes)) {
            setPrizes(data.prizes);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error("Lỗi khi tải danh sách giải thưởng:", err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchAwards, 200);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [selectedSeasonSlug, selectedCategory, selectedPrize, search, seasons.length]);

  useEffect(() => {
    let ignore = false;
    const handleSilentRefresh = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedSeasonSlug !== "ALL") params.set("season", selectedSeasonSlug);
        if (selectedCategory !== "ALL") params.set("category", selectedCategory);
        if (selectedPrize !== "ALL") params.set("prize", selectedPrize);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/awards?${params.toString()}`);
        const data = await res.json();
        if (!ignore && data.success) {
          setAwards(data.awards || []);
          setTotalCount(data.total || 0);
          if (data.seasons && Array.isArray(data.seasons)) {
            setSeasons(data.seasons);
          }
          if (data.categories && Array.isArray(data.categories)) {
            setCategories(data.categories);
          }
          if (data.prizes && Array.isArray(data.prizes)) {
            setPrizes(data.prizes);
          }
        }
      } catch {
        // Silent ignore on background refresh
      }
    };

    window.addEventListener("utt:auto-refresh", handleSilentRefresh);
    return () => {
      ignore = true;
      window.removeEventListener("utt:auto-refresh", handleSilentRefresh);
    };
  }, [selectedSeasonSlug, selectedCategory, selectedPrize, search]);

  const hasDemoAwards = awards.some((a) => a.isDemo);

  return (
    <div className="container page-shell">
      {/* HERO SECTION */}
      <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px auto" }}>
        <p className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} style={{ color: "var(--brand-orange)" }} />
          TÔN VINH ĐỔI MỚI SÁNG TẠO UTT
        </p>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 36px)", fontWeight: 800, margin: "10px 0 14px 0", lineHeight: 1.25 }}>
          Sảnh giải thưởng – Dấu ấn sáng tạo
        </h1>
        <p className="page-intro" style={{ fontSize: 16, margin: 0, color: "var(--muted)" }}>
          Không gian ghi nhận và vinh danh các ý tưởng, giải pháp công nghệ tiêu biểu
          đoạt giải qua các mùa Thử thách sáng tạo 4.0 Trường ĐH Công nghệ Giao thông vận tải.
        </p>
      </div>

      {/* DEMO NOTICE BANNER (IF ANY DEMO AWARDS PRESENT) */}
      {hasDemoAwards && (
        <div
          className="notice"
          style={{
            marginBottom: 28,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            background: "rgba(234, 88, 12, 0.08)",
            border: "1px solid rgba(234, 88, 12, 0.25)",
            color: "var(--foreground)",
          }}
        >
          <Info size={20} style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>Thông báo về Dữ liệu minh họa:</strong> Một số bản ghi mang nhãn{" "}
            <span
              style={{
                display: "inline-block",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(234, 88, 12, 0.15)",
                color: "var(--brand-orange)",
              }}
            >
              Demo / Dữ liệu minh họa
            </span>{" "}
            được thiết lập nhằm phục vụ kiểm thử bố cục giao diện. Danh mục chính thức 120 ý tưởng đoạt giải Season 1 sẽ được công bố sau khi Hội đồng nghiệm thu hoàn tất xét duyệt.
          </div>
        </div>
      )}

      {/* FILTER & SEARCH CONTROLS */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 0, width: "100%" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            />
            <input
              id="awardSearchInput"
              type="text"
              placeholder="Tìm theo tên ý tưởng, giải pháp, đơn vị..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 14px 9px 38px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
                fontSize: 14,
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* SEASON SELECTOR DROPDOWN */}
          {seasons.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
                Mùa giải:
              </span>
              <select
                value={selectedSeasonSlug}
                onChange={(e) => setSelectedSeasonSlug(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  maxWidth: "100%",
                }}
              >
                <option value="ALL">Tất cả các mùa</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name} {s.year ? `(${s.year})` : ""} {s.isDemo ? "[Demo]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* PILLS FILTERS: CATEGORY & PRIZE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          {/* CATEGORIES */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginRight: 2 }}>
              LĨNH VỰC:
            </span>
            <button
              onClick={() => setSelectedCategory("ALL")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid var(--border)",
                background: selectedCategory === "ALL" ? "var(--brand-orange)" : "var(--background)",
                color: selectedCategory === "ALL" ? "#fff" : "var(--foreground)",
                cursor: "pointer",
              }}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  background: selectedCategory === cat ? "var(--brand-orange)" : "var(--background)",
                  color: selectedCategory === cat ? "#fff" : "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* PRIZES */}
          {prizes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginRight: 2 }}>
                GIẢI THƯỞNG:
              </span>
              <button
                onClick={() => setSelectedPrize("ALL")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  background: selectedPrize === "ALL" ? "var(--brand-navy, #1e3a8a)" : "var(--background)",
                  color: selectedPrize === "ALL" ? "#fff" : "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                Tất cả
              </button>
              {prizes.map((pz) => (
                <button
                  key={pz}
                  onClick={() => setSelectedPrize(pz)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid var(--border)",
                    background: selectedPrize === pz ? "var(--brand-navy, #1e3a8a)" : "var(--background)",
                    color: selectedPrize === pz ? "#fff" : "var(--foreground)",
                    cursor: "pointer",
                  }}
                >
                  {pz}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AWARDS COUNT BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <div>
          Hiển thị <strong>{awards.length}</strong> / <strong>{totalCount}</strong> giải thưởng vinh danh
        </div>
      </div>

      {/* AWARDS LIST / GRID */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p className="page-intro">Đang tải dữ liệu giải thưởng...</p>
        </div>
      ) : awards.length === 0 ? (
        <div className="form-panel" style={{ textAlign: "center", padding: 56 }}>
          <Trophy size={48} style={{ margin: "0 auto 16px", color: "var(--muted)", opacity: 0.6 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Không tìm thấy giải thưởng phù hợp</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 440, margin: "0 auto 20px auto" }}>
            Không có sản phẩm hoặc ý tưởng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedSeasonSlug("ALL");
              setSelectedCategory("ALL");
              setSelectedPrize("ALL");
              setSearch("");
            }}
          >
            Xóa bộ lọc tìm kiếm
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
            gap: 24,
          }}
        >
          {awards.map((award) => {
            const isFirstPrize = /Nhất|Vàng|Gold|Champion/i.test(award.awardName);
            const isSecondPrize = /Nhì|Bạc|Silver/i.test(award.awardName);
            const isThirdPrize = /Ba|Đồng|Bronze/i.test(award.awardName);

            const prizeColor = isFirstPrize
              ? { bg: "#fef3c7", color: "#b45309", border: "#fde68a" }
              : isSecondPrize
              ? { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" }
              : isThirdPrize
              ? { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" }
              : { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };

            return (
              <article
                key={award.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* THUMBNAIL IMAGE (OR FALLBACK BANNER) */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 180,
                    background: "linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(30, 58, 138, 0.15) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {award.imageUrl ? (
                    <Image
                      src={award.imageUrl}
                      alt={award.title}
                      fill
                      sizes="(max-width: 700px) 100vw, 33vw"
                      unoptimized
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <Trophy size={48} style={{ color: "var(--brand-orange)", opacity: 0.8 }} />
                  )}

                  {/* PRIZE BADGE OVERLAY */}
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      background: prizeColor.bg,
                      color: prizeColor.color,
                      border: `1px solid ${prizeColor.border}`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Trophy size={13} />
                    {award.awardName}
                  </div>

                  {/* DEMO BADGE OVERLAY */}
                  {award.isDemo && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "rgba(0, 0, 0, 0.65)",
                        color: "#fff",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      Dữ liệu minh họa
                    </div>
                  )}
                </div>

                {/* CARD BODY */}
                <div style={{ padding: "20px 20px 16px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  {/* CATEGORY & SEASON */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {award.category && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--brand-orange)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {award.category}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>· {award.season.name}</span>
                  </div>

                  {/* TITLE */}
                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      margin: "0 0 8px 0",
                      lineHeight: 1.4,
                      color: "var(--foreground)",
                    }}
                  >
                    <Link
                      href={`/san-giai-thuong/${award.slug}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {award.title}
                    </Link>
                  </h3>

                  {/* SHORT DESCRIPTION */}
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      lineHeight: 1.5,
                      margin: "0 0 16px 0",
                      flex: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {award.shortDescription || "Không gian vinh danh giải pháp xuất sắc tại Thử thách sáng tạo 4.0."}
                  </p>

                  {/* ORGANIZATION / UNIT */}
                  {award.organization && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 10,
                      }}
                    >
                      <Building2 size={14} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {award.organization}
                      </span>
                    </div>
                  )}

                  {/* MEMBERS PREVIEW */}
                  {award.members && award.members.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 16,
                      }}
                    >
                      <Users size={14} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {award.members.map((m) => m.fullName).join(", ")}
                      </span>
                    </div>
                  )}

                  {/* CTA BUTTON */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      marginTop: "auto",
                      fontWeight: 600,
                    }}
                  >
                    <Link href={`/san-giai-thuong/${award.slug}`}>
                      <span>Xem hồ sơ giải thưởng</span>
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
