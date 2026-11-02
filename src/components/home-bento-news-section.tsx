"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, User, Newspaper } from "lucide-react";
import { useAppNavigation } from "@/context/navigation-context";
import type { NewsCategory, NewsPostItem } from "@/lib/domain/news-service";

function formatViDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getCategorySubColor(category: NewsCategory, isPinned: boolean): string {
  if (isPinned) return "#fb923c";
  if (category === "SU_KIEN") return "#0284c7";
  if (category === "VINH_DANH") return "#059669";
  return "#ea580c";
}

export function HomeBentoNewsSection() {
  const { goToTab } = useAppNavigation();
  const [posts, setPosts] = useState<NewsPostItem[]>([]);
  const [newsLoaded, setNewsLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"ALL" | NewsCategory>("ALL");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [thumbStartIdx, setThumbStartIdx] = useState(0);
  const [modalPost, setModalPost] = useState<NewsPostItem | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (modalPost && modalCardRef.current) {
      modalCardRef.current.scrollTop = 0;
    }
  }, [modalPost]);

  useEffect(() => {
    let ignore = false;
    const loadNews = async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.items)) {
          const nextItems: NewsPostItem[] = data.items;
          setPosts(nextItems);
          setSelectedPostId((prev) => {
            if (nextItems.length === 0) return null;
            return prev !== null && nextItems.some((item) => item.id === prev)
              ? prev
              : nextItems[0].id;
          });
          setThumbStartIdx((prev) =>
            nextItems.length > 0 ? prev % nextItems.length : 0
          );
          setModalPost((prev) =>
            prev && nextItems.some((item) => item.id === prev.id) ? prev : null
          );
        }
      } catch {
        // Ignore transient network errors
      } finally {
        if (!ignore) setNewsLoaded(true);
      }
    };
    loadNews();
    window.addEventListener("focus", loadNews);
    window.addEventListener("utt:auto-refresh", loadNews);
    return () => {
      ignore = true;
      window.removeEventListener("focus", loadNews);
      window.removeEventListener("utt:auto-refresh", loadNews);
    };
  }, []);

  const filteredPosts = useMemo(() => {
    if (activeCategory === "ALL") return posts;
    return posts.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  const activePost = useMemo<NewsPostItem | null>(() => {
    if (filteredPosts.length === 0) return null;
    return (
      filteredPosts.find((p) => p.id === selectedPostId) ??
      filteredPosts[0] ??
      null
    );
  }, [filteredPosts, selectedPostId]);

  const topThreePosts = useMemo(() => {
    return filteredPosts.slice(0, 3);
  }, [filteredPosts]);

  const visibleThumbs = useMemo(() => {
    if (filteredPosts.length === 0) return [];
    const count = Math.min(4, filteredPosts.length);
    const result: NewsPostItem[] = [];
    for (let i = 0; i < count; i++) {
      result.push(filteredPosts[(thumbStartIdx + i) % filteredPosts.length]);
    }
    return result;
  }, [filteredPosts, thumbStartIdx]);

  const handleSelectCategory = (cat: "ALL" | NewsCategory) => {
    setActiveCategory(cat);
    setThumbStartIdx(0);
    const list = cat === "ALL" ? posts : posts.filter((p) => p.category === cat);
    setSelectedPostId(list[0]?.id ?? null);
  };

  const handleCycleThumb = (delta: number) => {
    const len = filteredPosts.length;
    if (len === 0) return;
    const nextIdx = (thumbStartIdx + delta + len) % len;
    setThumbStartIdx(nextIdx);
    const target = filteredPosts[nextIdx];
    if (target) {
      setSelectedPostId(target.id);
    }
  };

  const contentLines = useMemo(() => {
    if (!activePost) {
      return { headline: "", body: "" };
    }
    const lines = (activePost.content || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      return {
        headline: lines[0],
        body: lines.slice(1).join("\n"),
      };
    }
    return {
      headline: activePost.title,
      body: activePost.content,
    };
  }, [activePost]);

  return (
    <section
      className="container bento-news-wrapper"
      aria-label="Khám phá cuộc thi và Bảng tin hoạt động sáng tạo"
    >
      <div className="bento-news-layout">
        {/* LEFT SIDE: 4 RICH BENTO NAVIGATION CARDS */}
        <div className="bento-left-grid">
          {/* CARD 1: GỬI Ý TƯỞNG SÁNG TẠO */}
          <button
            type="button"
            onClick={() => goToTab("gui-y-tuong")}
            className="bento-card-hero"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/solar.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="bento-hero-bg-img"
            />
            <div className="bento-hero-orb" />

            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #f25c05 0%, #f59e0b 100%)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 8px 20px rgba(242, 92, 5, 0.35)",
                    border: "1.5px solid rgba(255, 255, 255, 0.35)",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <span className="bento-hero-badge">🔥 MÙA 2 • THỬ THÁCH SÁNG TẠO 4.0</span>
              </div>

              <h2 className="bento-hero-title">Gửi ý tưởng sáng tạo</h2>
              <p className="bento-hero-desc">
                Đề xuất giải pháp mới cho cá nhân hoặc nhóm nghiên cứu tại UTT.
              </p>

              {/* 3-line benefit checklist */}
              <div className="bento-hero-checklist">
                <div className="bento-hero-check-item">
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 99,
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#10b981",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span>Thưởng ý tưởng được duyệt</span>
                </div>
                <div className="bento-hero-check-item">
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 99,
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#0ea5e9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span>Cố vấn Khoa/Viện</span>
                </div>
                <div className="bento-hero-check-item">
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 99,
                      background: "rgba(245, 158, 11, 0.2)",
                      color: "#f59e0b",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span>Hỗ trợ kinh phí,...</span>
                </div>
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #c2410c 0%, #9a3412 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 13.5,
                  padding: "11px 16px",
                  borderRadius: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 6px 18px rgba(194, 65, 12, 0.32)",
                }}
              >
                <span>Nộp đề xuất ngay</span>
                <span>&rarr;</span>
              </div>
            </div>
          </button>

          {/* RIGHT STACK OF 3 RICH VISUAL BENTO CARDS */}
          <div className="bento-right-stack">
            {/* CARD 2: KHÁM PHÁ DỰ ÁN TIÊU BIỂU */}
            <button
              type="button"
              onClick={() => goToTab("giai-thuong")}
              className="bento-card-sub gold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/traffic-ai.webp"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="bento-sub-bg-img"
              />
              <div className="bento-sub-dark-overlay" />

              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div>
                  <span className="bento-sub-pill gold">🏆 SẢNH GIẢI THƯỞNG</span>
                  <div className="bento-sub-title">Khám phá dự án tiêu biểu</div>
                  <div className="bento-sub-desc">
                    Vinh danh các công trình &amp; giải pháp xuất sắc
                  </div>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    boxShadow: "0 6px 14px rgba(245, 158, 11, 0.32)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                  >
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                </div>
              </div>

              <div className="bento-sub-footer gold" style={{ justifyContent: "flex-end" }}>
                <span className="sub-cta">Xem sảnh &rarr;</span>
              </div>
            </button>

            {/* CARD 3: SẢNH NHIỆM VỤ – GIẢI PHÁP */}
            <button
              type="button"
              onClick={() => goToTab("nhiem-vu")}
              className="bento-card-sub blue"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/robot.webp"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="bento-sub-bg-img"
              />
              <div className="bento-sub-dark-overlay" />

              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div>
                  <span className="bento-sub-pill blue">🎯 ĐẶT HÀNG THỰC TẾ</span>
                  <div className="bento-sub-title">Sảnh nhiệm vụ – Giải pháp</div>
                  <div className="bento-sub-desc">
                    Giải bài toán từ Doanh nghiệp, Khoa &amp; Viện
                  </div>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #0284c7, #2563eb)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    boxShadow: "0 6px 14px rgba(37, 99, 235, 0.32)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
              </div>

              <div className="bento-sub-footer blue" style={{ justifyContent: "flex-end" }}>
                <span className="sub-cta">Nhận nhiệm vụ &rarr;</span>
              </div>
            </button>

            {/* CARD 4: HỘI CHỢ Ý TƯỞNG */}
            <button
              type="button"
              onClick={() => goToTab("hoi-cho-y-tuong")}
              className="bento-card-sub emerald"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/vr.webp"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="bento-sub-bg-img"
              />
              <div className="bento-sub-dark-overlay" />

              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div>
                  <span className="bento-sub-pill emerald">🤝 KẾT NỐI ĐỘI NHÓM</span>
                  <div className="bento-sub-title">Hội chợ ý tưởng</div>
                  <div className="bento-sub-desc">
                    Tìm cộng sự lập trình, cơ khí, kinh tế vận tải
                  </div>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #059669, #10b981)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    boxShadow: "0 6px 14px rgba(16, 185, 129, 0.32)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>

              <div className="bento-sub-footer emerald" style={{ justifyContent: "flex-end" }}>
                <span className="sub-cta">Tham gia ngay &rarr;</span>
              </div>
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: BẢNG TIN & HOẠT ĐỘNG SÁNG TẠO */}
        <div className="news-hub-card">
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <h2 className="news-hub-title">Bảng Tin &amp; Hoạt Động Sáng Tạo</h2>
            </div>

            {/* Category Filter Tabs */}
            <div className="news-hub-tabs">
              <button
                type="button"
                onClick={() => handleSelectCategory("ALL")}
                className={`news-hub-tab tab-all ${activeCategory === "ALL" ? "active" : ""}`}
              >
                Tất Cả Bản Tin
              </button>
              <button
                type="button"
                onClick={() => handleSelectCategory("THONG_BAO")}
                className={`news-hub-tab tab-thong-bao ${
                  activeCategory === "THONG_BAO" ? "active" : ""
                }`}
              >
                Thông Báo BTC
              </button>
              <button
                type="button"
                onClick={() => handleSelectCategory("SU_KIEN")}
                className={`news-hub-tab tab-su-kien ${
                  activeCategory === "SU_KIEN" ? "active" : ""
                }`}
              >
                Sự Kiện &amp; Workshop
              </button>
              <button
                type="button"
                onClick={() => handleSelectCategory("VINH_DANH")}
                className={`news-hub-tab tab-vinh-danh ${
                  activeCategory === "VINH_DANH" ? "active" : ""
                }`}
              >
                Vinh Danh &amp; Cố Vấn
              </button>
            </div>

            {!newsLoaded ? (
              <div
                className="news-reader-panel"
                style={{
                  flex: 1,
                  minHeight: 240,
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "28px 20px",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                  Đang tải bản tin &amp; hoạt động sáng tạo...
                </span>
              </div>
            ) : !activePost ? (
              <div
                className="news-reader-panel"
                style={{
                  flex: 1,
                  minHeight: 240,
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 10,
                  padding: "28px 20px",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: "rgba(242, 92, 5, 0.12)",
                    color: "var(--brand-orange)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Newspaper size={22} />
                </div>
                <div
                  className="news-reader-heading"
                  style={{ marginBottom: 0, fontSize: 15 }}
                >
                  {posts.length === 0
                    ? "Hiện chưa có bản tin hoặc hoạt động mới"
                    : "Chưa có bản tin trong chuyên mục này"}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--muted)",
                    maxWidth: 380,
                    lineHeight: 1.55,
                  }}
                >
                  {posts.length === 0
                    ? "Các thông báo chính thức, lịch sự kiện đồng hành và thông tin vinh danh từ Ban Tổ chức sẽ được cập nhật tại đây."
                    : "Hiện chưa có bài đăng nào thuộc chuyên mục đang chọn."}
                </div>
                {posts.length > 0 && activeCategory !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("ALL")}
                    style={{
                      marginTop: 4,
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 9,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--brand-orange)",
                    }}
                  >
                    Xem tất cả bản tin
                  </button>
                )}
              </div>
            ) : (
              /* Split: Left Top 3 News List + Right Direct Article Reader */
              <div className="news-hub-split">
                {/* Left: Top 3 Featured / Pinned News */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topThreePosts.map((post, idx) => {
                    const isSelected = post.id === activePost.id;
                    const subColor = getCategorySubColor(post.category, post.isPinned || idx === 0);
                    return (
                      <button
                        type="button"
                        key={post.id}
                        onClick={() => setSelectedPostId(post.id)}
                        className={`news-item-btn ${isSelected ? "selected" : ""}`}
                      >
                        {post.isPinned || idx === 0 ? (
                          <span
                            style={{
                              fontSize: 18,
                              width: 26,
                              textAlign: "center",
                              flexShrink: 0,
                            }}
                          >
                            👑
                          </span>
                        ) : (
                          <span
                            className={`news-rank-badge ${
                              idx === 1 ? "rank-2" : "rank-3"
                            }`}
                          >
                            {idx + 1}.
                          </span>
                        )}

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.imageUrl || "/images/traffic-ai.webp"}
                          alt={post.title}
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 10,
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="news-item-title">{post.title}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: subColor,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              marginTop: 2,
                            }}
                          >
                            {post.isPinned ? `📌 Tin ghim • ${post.summary}` : post.summary}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Direct Article Reader */}
                <div className="news-reader-panel">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "var(--brand-orange)",
                        }}
                      >
                        📖 Nội Dung Bản Tin Đang Xem
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>
                        {formatViDate(activePost.createdAt)}
                      </span>
                    </div>

                    <div className="news-reader-heading">{contentLines.headline}</div>
                    <div className="news-reader-body">{contentLines.body}</div>
                  </div>

                  <div className="news-reader-footer">
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                      Đăng bởi: {activePost.author || "Quản trị viên BTC"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalPost(activePost)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "var(--brand-orange)",
                        fontWeight: 800,
                        fontSize: 11.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Xem chi tiết / Phóng to &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Thumbnail Carousel Strip */}
          {newsLoaded && activePost && visibleThumbs.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={() => handleCycleThumb(-1)}
                aria-label="Bản tin trước"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 22,
                  fontWeight: 900,
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                &lsaquo;
              </button>

              <div className="news-thumb-grid">
                {visibleThumbs.map((thumb) => {
                  const isActive = thumb.id === activePost.id;
                  return (
                    <button
                      type="button"
                      key={thumb.id}
                      onClick={() => setSelectedPostId(thumb.id)}
                      className={`news-thumb-card ${isActive ? "active" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb.imageUrl || "/images/traffic-ai.webp"}
                        alt={thumb.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.85) 100%)",
                          display: "flex",
                          alignItems: "flex-end",
                          padding: "5px 7px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ffffff",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {thumb.thumbLabel || thumb.title}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleCycleThumb(1)}
                aria-label="Bản tin tiếp theo"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 22,
                  fontWeight: 900,
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                &rsaquo;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EXPANDED ARTICLE MODAL (Rendered via Portal on document.body to escape ancestor transforms) */}
      {modalPost &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setModalPost(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(9, 13, 22, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px",
            }}
          >
            <div
              ref={modalCardRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(680px, 100%)",
                maxHeight: "calc(100% - 24px)",
                overflowY: "auto",
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 20,
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
                padding: "clamp(16px, 4vw, 24px)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#ffffff",
                      background: "var(--brand-orange)",
                      padding: "4px 10px",
                      borderRadius: 99,
                      marginBottom: 8,
                    }}
                  >
                    {modalPost.isPinned ? "👑 BẢN TIN TIÊU ĐIỂM" : "📢 BẢN TIN SÁNG TẠO UTT"}
                  </span>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "var(--foreground)",
                      lineHeight: 1.35,
                    }}
                  >
                    {modalPost.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setModalPost(null)}
                  aria-label="Đóng bản tin"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 99,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {modalPost.imageUrl && (
                <div
                  style={{
                    width: "100%",
                    height: "clamp(180px, 45vw, 260px)",
                    borderRadius: 14,
                    overflow: "hidden",
                    marginBottom: 16,
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modalPost.imageUrl}
                    alt={modalPost.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  fontSize: 12.5,
                  color: "var(--muted)",
                  marginBottom: 14,
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} /> {formatViDate(modalPost.createdAt)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <User size={14} /> {modalPost.author || "Quản trị viên BTC"}
                </span>
                {modalPost.summary && <span>• {modalPost.summary}</span>}
              </div>

              <div
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.75,
                  color: "var(--foreground)",
                  whiteSpace: "pre-line",
                  overflowWrap: "anywhere",
                }}
              >
                {modalPost.content}
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setModalPost(null);
                    goToTab("gui-y-tuong");
                  }}
                  className="button button-primary"
                  style={{ height: 38, padding: "0 16px", fontSize: 13, fontWeight: 700 }}
                >
                  Gửi ý tưởng ngay &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setModalPost(null)}
                  className="button button-ghost"
                  style={{
                    height: 38,
                    padding: "0 16px",
                    fontSize: 13,
                    border: "1px solid var(--border)",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
