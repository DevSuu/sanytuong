"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Trophy,
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  AlertCircle,
  Sparkles,
  GraduationCap,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AwardDetailData {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  description: string;
  awardName: string;
  category?: string | null;
  organization?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  displayOrder: number;
  status: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  season: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    status: string;
    year?: number | null;
    isDemo: boolean;
  };
  members: Array<{
    id: string;
    fullName: string;
    studentCode?: string | null;
    className?: string | null;
    role?: string | null;
    department?: string | null;
    isDemo: boolean;
  }>;
}

export function AwardDetailView({ slug }: { slug: string }) {
  const [award, setAward] = useState<AwardDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadAward() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/awards/${slug}`);
        const data = await res.json();

        if (ignore) return;
        if (!res.ok) {
          setError(data.error || "Không tìm thấy thông tin giải thưởng.");
          return;
        }

        setAward(data.award);
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Lỗi mạng khi tải giải thưởng.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAward();
    return () => {
      ignore = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="container page-shell" style={{ textAlign: "center", padding: "80px 0" }}>
        <p className="page-intro">Đang tải thông tin giải thưởng...</p>
      </div>
    );
  }

  if (error || !award) {
    return (
      <div className="container page-shell">
        <Button asChild variant="ghost" size="sm" style={{ marginBottom: 20 }}>
          <Link href="/san-giai-thuong">
            <ArrowLeft size={16} /> Quay lại Sảnh giải thưởng
          </Link>
        </Button>
        <div className="form-panel" style={{ textAlign: "center", padding: "56px 24px", marginTop: 20 }}>
          <AlertCircle size={48} style={{ color: "#dc2626", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Không tìm thấy giải thưởng</h2>
          <p className="page-intro" style={{ marginBottom: 24 }}>
            {error || "Giải thưởng này không tồn tại hoặc chưa được công bố công khai."}
          </p>
          <Button asChild>
            <Link href="/san-giai-thuong">Về danh sách giải thưởng</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isFirstPrize = /Nhất|Vàng|Gold|Champion/i.test(award.awardName);
  const isSecondPrize = /Nhì|Bạc|Silver/i.test(award.awardName);
  const isThirdPrize = /Ba|Đồng|Bronze/i.test(award.awardName);

  const prizeBadge = isFirstPrize
    ? { bg: "#fef3c7", color: "#b45309", border: "#fde68a" }
    : isSecondPrize
    ? { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" }
    : isThirdPrize
    ? { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" }
    : { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };

  return (
    <div className="container page-shell" style={{ maxWidth: 960 }}>
      {/* BACK NAVIGATION */}
      <Button asChild variant="ghost" size="sm" style={{ marginBottom: 24 }}>
        <Link href="/san-giai-thuong">
          <ArrowLeft size={16} /> Quay lại Sảnh giải thưởng
        </Link>
      </Button>

      {/* DEMO NOTICE BANNER (IF DEMO) */}
      {award.isDemo && (
        <div
          className="notice"
          style={{
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(234, 88, 12, 0.08)",
            border: "1px solid rgba(234, 88, 12, 0.25)",
            color: "var(--foreground)",
          }}
        >
          <Info size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>Hồ sơ minh họa (Demo):</strong> Bản ghi này thuộc tập dữ liệu minh họa nhằm kiểm thử giao diện vinh danh. Chưa phải xác nhận giải thưởng chính thức từ Hội đồng nghiệm thu.
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {/* PRIZE BADGE */}
          <span
            style={{
              padding: "5px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: prizeBadge.bg,
              color: prizeBadge.color,
              border: `1px solid ${prizeBadge.border}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trophy size={15} />
            {award.awardName}
          </span>

          {/* CATEGORY BADGE */}
          {award.category && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: "rgba(0,0,0,0.05)",
                color: "var(--muted)",
              }}
            >
              {award.category}
            </span>
          )}

          {/* SEASON NAME */}
          <span style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Calendar size={14} />
            {award.season.name} {award.season.year ? `(${award.season.year})` : ""}
          </span>
        </div>

        {/* MAIN TITLE */}
        <h1 style={{ fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 800, margin: "8px 0 16px 0", lineHeight: 1.3 }}>
          {award.title}
        </h1>

        {/* ORGANIZATION / KHOA VIEN */}
        {award.organization && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 15, flexWrap: "wrap" }}>
            <Building2 size={18} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
            <span>Đơn vị / Khoa chuyên môn: <strong>{award.organization}</strong></span>
          </div>
        )}
      </div>

      {/* MAIN MEDIA BANNER */}
      {award.imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "clamp(200px, 46vw, 380px)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 32,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <Image
            src={award.imageUrl}
            alt={award.title}
            fill
            sizes="(max-width: 960px) 100vw, 960px"
            unoptimized
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
      )}

      {/* CONTENT GRID: DETAILS & TEAM */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 28,
        }}
      >
        {/* DESCRIPTION CARD */}
        <div
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
            Mô tả giải pháp & Đóng góp nổi bật
          </h2>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--foreground)",
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
            }}
          >
            {award.description}
          </div>

          {award.videoUrl && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <Button asChild variant="outline" size="sm">
                <a href={award.videoUrl} target="_blank" rel="noopener noreferrer">
                  <span>Xem video giới thiệu giải pháp</span>
                  <ExternalLink size={14} style={{ marginLeft: 6 }} />
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* TEAM MEMBERS CARD */}
        {award.members && award.members.length > 0 && (
          <div
            className="form-panel"
            style={{
              width: "100%",
              padding: "clamp(18px, 4vw, 32px)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
              Đội ngũ tác giả & Giảng viên hướng dẫn ({award.members.length})
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))",
                gap: 16,
              }}
            >
              {award.members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 10,
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>
                      {member.fullName}
                    </div>
                    {member.role && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: /GVHD|Cố vấn/i.test(member.role)
                            ? "rgba(37, 99, 235, 0.12)"
                            : "rgba(234, 88, 12, 0.12)",
                          color: /GVHD|Cố vấn/i.test(member.role) ? "#2563eb" : "var(--brand-orange)",
                        }}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>

                  {(member.studentCode || member.className) && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {member.studentCode ? `MSSV: ${member.studentCode}` : ""}
                      {member.studentCode && member.className ? " · " : ""}
                      {member.className ? `Lớp: ${member.className}` : ""}
                    </div>
                  )}

                  {member.department && (
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <GraduationCap size={13} />
                      <span>{member.department}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
