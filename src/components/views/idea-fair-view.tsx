"use client";

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import {
  Sparkles,
  Search,
  Users,
  CheckCircle2,
  X,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Car,
  Wrench,
  Leaf,
  Briefcase,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailTypoSuggestion } from "@/components/ui/email-typo-suggestion";
import { PublicRecruitmentPostListItem } from "@/lib/domain/recruitment-service";
import { RESEARCH_FIELDS } from "@/lib/validation/idea-schema";
import { getClientCache, setClientCache } from "@/lib/cache/client-cache";
import { createPortal } from "react-dom";

const PAGE_SIZE = 8;

const QUICK_CATEGORY_CHIPS = [
  { label: "AI & Dữ liệu", value: "Trí tuệ nhân tạo", badge: "AI" },
  { label: "Giao thông thông minh", value: "Giao thông", badge: "GIAO THÔNG" },
  { label: "Cơ khí", value: "Cơ khí", badge: "CƠ KHÍ" },
  { label: "Môi trường", value: "Môi trường", badge: "MÔI TRƯỜNG" },
  { label: "Kinh tế - Quản trị", value: "Kinh tế", badge: "KINH TẾ" },
];

const SIDEBAR_QUICK_SKILLS = [
  "AI/ML",
  "Python",
  "Computer Vision",
  "Cơ khí",
  "UI/UX",
  "Kinh tế",
];

function formatRelativeTime(dateString?: string | Date): string {
  if (!dateString) return "Vừa đăng";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffInSeconds < 3600) {
    const mins = Math.max(1, Math.floor(diffInSeconds / 60));
    return `Đăng ${mins} phút trước`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Đăng ${hours} giờ trước`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  if (days < 30) {
    return `Đăng ${days} ngày trước`;
  }
  return `Đăng ${date.toLocaleDateString("vi-VN")}`;
}

function getFieldInfo(field?: string | null) {
  const f = field || "";
  if (f.includes("Trí tuệ nhân tạo") || f.includes("Công nghệ") || f.includes("AI")) {
    return { label: "AI & Dữ liệu", icon: Cpu, badge: "AI", color: "#38bdf8" };
  }
  if (f.includes("Giao thông") || f.includes("Xây dựng")) {
    return { label: "Giao thông thông minh", icon: Car, badge: "GIAO THÔNG", color: "#60a5fa" };
  }
  if (f.includes("Cơ khí") || f.includes("Cơ điện")) {
    return { label: "Cơ khí", icon: Wrench, badge: "CƠ KHÍ", color: "#94a3b8" };
  }
  if (f.includes("Môi trường") || f.includes("Năng lượng")) {
    return { label: "Môi trường", icon: Leaf, badge: "MÔI TRƯỜNG", color: "#34d399" };
  }
  if (f.includes("Kinh tế") || f.includes("Thương mại") || f.includes("Logistics")) {
    return { label: "Kinh tế – Quản trị", icon: Briefcase, badge: "KINH TẾ", color: "#a78bfa" };
  }
  return { label: field || "Đổi mới sáng tạo", icon: Layers, badge: "SÁNG TẠO", color: "#f59e0b" };
}

function getInitials(name: string): string {
  if (!name) return "TN";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function IdeaFairCardSkeleton() {
  return (
    <article className="idea-card" style={{ opacity: 0.8, pointerEvents: "none" }} aria-hidden="true">
      <div className="idea-card-thumbnail" style={{ background: "rgba(148, 163, 184, 0.1)" }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(148, 163, 184, 0.2)", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <div className="idea-card-body">
        <div>
          <div className="idea-card-header">
            <div style={{ width: "65%", height: 20, borderRadius: 6, background: "rgba(148, 163, 184, 0.2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 80, height: 22, borderRadius: 20, background: "rgba(148, 163, 184, 0.15)" }} />
          </div>
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <div style={{ width: 120, height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)" }} />
          </div>
          <div style={{ width: "100%", height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.12)", marginBottom: 6 }} />
          <div style={{ width: "85%", height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.12)", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 60, height: 20, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)" }} />
            <div style={{ width: 70, height: 20, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)" }} />
          </div>
        </div>
      </div>
      <div className="idea-card-meta">
        <div style={{ width: "100%", height: 48, borderRadius: 8, background: "rgba(148, 163, 184, 0.1)", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(148, 163, 184, 0.2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 80, height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.2)", marginBottom: 4 }} />
            <div style={{ width: 50, height: 12, borderRadius: 4, background: "rgba(148, 163, 184, 0.12)" }} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function IdeaFairView() {
  const isClient = useIsClient();

  // Search, filter, and sort state
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState("");
  const [inputSkill, setInputSkill] = useState("");
  const [checkedSkills, setCheckedSkills] = useState<string[]>([]);
  const [sort, setSort] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize with cached items if available for instant render
  const initialCache = getClientCache<{ items: PublicRecruitmentPostListItem[]; total: number }>(
    "idea-fair:::::newest:1"
  );
  const [posts, setPosts] = useState<PublicRecruitmentPostListItem[]>(() => initialCache.data?.items || []);
  const [totalPosts, setTotalPosts] = useState(() => initialCache.data?.total || 0);
  const [loading, setLoading] = useState(() => !initialCache.data);
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = React.useRef(true);

  // Modal states
  const [selectedDetailPost, setSelectedDetailPost] = useState<PublicRecruitmentPostListItem | null>(null);
  const [selectedPost, setSelectedPost] = useState<PublicRecruitmentPostListItem | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Application form state
  const [formData, setFormData] = useState({
    fullName: "",
    studentCode: "",
    email: "",
    className: "",
    phone: "",
    specialty: "",
    motivation: "",
    contribution: "",
    consentAccepted: false,
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [inputOtp, setInputOtp] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Combined skill query (comma separated)
  const effectiveSkillQuery = useMemo(() => {
    const skills = new Set<string>();
    if (inputSkill.trim()) {
      inputSkill.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => skills.add(s));
    }
    checkedSkills.forEach((s) => skills.add(s));
    return Array.from(skills).join(",");
  }, [inputSkill, checkedSkills]);

  // Load posts with SWR cache
  const fetchPosts = useCallback((immediate = false) => {
    const key = `idea-fair:${search.trim()}:${selectedField.trim()}:${effectiveSkillQuery}:${sort}:${currentPage}`;
    const cached = getClientCache<{ items: PublicRecruitmentPostListItem[]; total: number }>(key);

    if (cached.data && !cached.isStale && !immediate && !isFirstMount.current) {
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedField.trim() && selectedField !== "all") params.set("field", selectedField.trim());
    if (effectiveSkillQuery) params.set("skill", effectiveSkillQuery);
    if (sort) params.set("sort", sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((currentPage - 1) * PAGE_SIZE));

    fetch(`/api/recruitment-posts?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          const items = json.data || [];
          const total = typeof json.total === "number" ? json.total : items.length;
          setPosts(items);
          setTotalPosts(total);
          setClientCache(key, { items, total });
          setError(null);
        } else {
          setError(json.error || "Không thể tải danh sách tin tuyển dụng.");
        }
      })
      .catch(() => {
        setError("Lỗi kết nối khi tải dữ liệu Hội chợ ý tưởng.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [search, selectedField, effectiveSkillQuery, sort, currentPage]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchPosts(true);
      return;
    }

    // Only debounce if search or inputSkill has value (user typing in input)
    const isTyping = search.trim().length > 0 || inputSkill.trim().length > 0;
    if (isTyping) {
      const timer = setTimeout(() => {
        fetchPosts(false);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      fetchPosts(true);
    }
  }, [fetchPosts, search, inputSkill]);

  useEffect(() => {
    const handleSilentRefresh = () => {
      fetchPosts(true);
    };
    window.addEventListener("utt:auto-refresh", handleSilentRefresh);
    return () => {
      window.removeEventListener("utt:auto-refresh", handleSilentRefresh);
    };
  }, [fetchPosts]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedField("");
    setInputSkill("");
    setCheckedSkills([]);
    setSort("newest");
    setCurrentPage(1);
  };

  const handleToggleSkillCheckbox = (skill: string) => {
    setCurrentPage(1);
    setCheckedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleChipSelect = (value: string) => {
    setCurrentPage(1);
    if (selectedField === value) {
      setSelectedField("");
    } else {
      setSelectedField(value);
    }
  };

  const handleOpenDetail = (post: PublicRecruitmentPostListItem) => {
    setSelectedDetailPost(post);
  };

  const handleOpenApply = (post: PublicRecruitmentPostListItem) => {
    setSelectedPost(post);
    setFormError(null);
    setOtpStep(false);
    setOtpSuccess(false);
    setInputOtp("");
    setShowApplyModal(true);
  };

  const handleCloseModal = () => {
    setShowApplyModal(false);
    setSelectedPost(null);
    setOtpStep(false);
    setOtpSuccess(false);
    setInputOtp("");
    setFormError(null);
    setOtpError(null);
  };

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost) return;

    if (!formData.consentAccepted) {
      setFormError("Bạn phải tích chọn đồng ý chia sẻ thông tin với Trưởng nhóm đề tài.");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/recruitment-posts/${selectedPost.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.ok) {
        setApplicationId(json.data.applicationId);
        setMaskedEmail(json.data.maskedEmail);
        setOtpStep(true);
        setResendCooldown(60);
      } else {
        setFormError(json.error || "Không thể gửi hồ sơ ứng tuyển.");
      }
    } catch {
      setFormError("Lỗi kết nối tới máy chủ.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !applicationId) return;

    setOtpSubmitting(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/recruitment-posts/${selectedPost.id}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          otp: inputOtp.trim(),
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setOtpSuccess(true);
      } else {
        setOtpError(json.error || "Mã xác thực OTP không chính xác.");
      }
    } catch {
      setOtpError("Lỗi kết nối khi xác thực OTP.");
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!selectedPost || !applicationId || resendCooldown > 0) return;

    setOtpSubmitting(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/recruitment-posts/${selectedPost.id}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const json = await res.json();
      if (json.ok) {
        setResendCooldown(60);
        setMaskedEmail(json.data.maskedEmail);
      } else {
        setOtpError(json.error || "Không thể gửi lại mã OTP.");
      }
    } catch {
      setOtpError("Lỗi kết nối khi gửi lại OTP.");
    } finally {
      setOtpSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));
  const startItem = totalPosts === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalPosts);

  return (
    <div className="idea-fair-container page-shell">
      {/* 3.1 & 3.2 Hero Header */}
      <section className="idea-fair-hero">
        <p className="idea-fair-hero-eyebrow">
          <Sparkles size={16} /> KẾT NỐI TÀI NĂNG ĐỔI MỚI SÁNG TẠO
        </p>
        <h1 className="idea-fair-hero-title">Hội Chợ Ý Tưởng</h1>
        <p className="idea-fair-hero-subtitle">
          Tìm đề tài phù hợp, kết nối với nhóm nghiên cứu và cùng phát triển giải pháp.
        </p>
      </section>

      {/* 3.2 Search & Filters Toolbar */}
      <div className="idea-fair-filter-bar">
        <div className="idea-fair-search-box">
          <Search size={18} className="idea-fair-search-icon" />
          <input
            type="text"
            className="idea-fair-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo tên đề tài, lĩnh vực, kỹ năng..."
          />
        </div>

        <select
          className="idea-fair-field-select"
          value={selectedField}
          onChange={(e) => {
            setSelectedField(e.target.value);
            setCurrentPage(1);
          }}
          aria-label="Lọc theo lĩnh vực"
        >
          <option value="">Tất cả lĩnh vực</option>
          {RESEARCH_FIELDS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <input
          type="text"
          className="idea-fair-skill-input"
          value={inputSkill}
          onChange={(e) => {
            setInputSkill(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Lọc theo kỹ năng cần tìm..."
          aria-label="Lọc theo kỹ năng"
        />

        <select
          className="idea-fair-sort-select"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setCurrentPage(1);
          }}
          aria-label="Sắp xếp danh sách"
        >
          <option value="newest">Sắp xếp: Mới nhất</option>
          <option value="oldest">Sắp xếp: Cũ nhất</option>
          <option value="slots">Sắp xếp: Nhiều chỉ tiêu nhất</option>
        </select>

        <button
          type="button"
          className="idea-fair-reset-btn"
          onClick={handleResetFilters}
          title="Đặt lại tất cả bộ lọc"
        >
          <RotateCcw size={16} /> Đặt lại
        </button>
      </div>

      {/* 3.3 Quick Category Chips */}
      <div className="idea-fair-chips-bar">
        <span className="idea-fair-counter-text">
          {totalPosts} đề tài đang tuyển thành viên
        </span>

        <div className="idea-fair-chips-list">
          <button
            type="button"
            className={`idea-fair-chip ${selectedField === "" ? "active" : ""}`}
            onClick={() => {
              setSelectedField("");
              setCurrentPage(1);
            }}
          >
            Tất cả ({totalPosts})
          </button>

          {QUICK_CATEGORY_CHIPS.map((chip) => {
            const isActive = selectedField === chip.value;
            return (
              <button
                key={chip.label}
                type="button"
                className={`idea-fair-chip ${isActive ? "active" : ""}`}
                onClick={() => handleChipSelect(chip.value)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3.4 Main Two-Column Layout */}
      <div className="idea-fair-grid-layout">
        {/* Left Column: Post List */}
        <div>
          {loading && posts.length === 0 ? (
            <div className="idea-fair-cards-container" aria-busy="true" aria-label="Đang tải danh sách đề tài...">
              {Array.from({ length: 4 }).map((_, i) => (
                <IdeaFairCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="notice" style={{ borderLeft: "4px solid #ef4444", color: "#ef4444" }}>
              {error}
            </div>
          ) : posts.length === 0 ? (
            <div
              className="form-panel"
              style={{
                textAlign: "center",
                padding: "56px 24px",
                borderRadius: 16,
                border: "1px dashed var(--border)",
              }}
            >
              <Users size={48} style={{ color: "var(--muted)", margin: "0 auto 16px auto" }} />
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 8px 0" }}>
                Chưa có tin tuyển dụng nào phù hợp
              </h3>
              <p style={{ color: "var(--muted)", margin: "0 0 20px 0" }}>
                Hiện chưa có đề tài nào mở tuyển thành viên theo từ khóa tìm kiếm của bạn. Hãy thử thay đổi bộ lọc hoặc quay lại sau!
              </p>
              <Button variant="outline" onClick={handleResetFilters}>
                Xóa tất cả bộ lọc
              </Button>
            </div>
          ) : (
            <div className="idea-fair-cards-container">
              {posts.map((post) => {
                const fieldInfo = getFieldInfo(post.field);
                const FieldIcon = fieldInfo.icon;
                const currentMembers = post.currentMembers || 1;
                const totalCap = post.totalTeamCapacity || currentMembers + post.remainingSlots;
                const progressPercent = Math.min(
                  100,
                  Math.max(0, Math.round((currentMembers / Math.max(totalCap, 1)) * 100))
                );

                const skillsList = post.requiredSkills
                  ? post.requiredSkills
                      .split(/[,;\n]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [];

                return (
                  <article key={post.id} className="idea-card">
                    {/* Neutral High-Tech Graphic Thumbnail */}
                    <div className="idea-card-thumbnail">
                      <FieldIcon size={44} style={{ color: fieldInfo.color, opacity: 0.9 }} />
                      <div className="idea-card-thumbnail-badge">{fieldInfo.badge}</div>
                    </div>

                    {/* Middle Info */}
                    <div className="idea-card-body">
                      <div>
                        <div className="idea-card-header">
                          <h2 className="idea-card-title">{post.title}</h2>
                          <span className="idea-card-status-badge">ĐANG TUYỂN</span>
                        </div>

                        <div className="idea-card-field-row">
                          <FieldIcon size={14} style={{ color: fieldInfo.color }} />
                          <span>{fieldInfo.label}</span>
                          <span style={{ margin: "0 4px", opacity: 0.4 }}>•</span>
                          <span style={{ fontSize: "0.78rem" }}>Mã: {post.referenceCode}</span>
                        </div>

                        <p className="idea-card-description">{post.description}</p>
                      </div>

                      {skillsList.length > 0 && (
                        <div className="idea-card-skills-row">
                          {skillsList.map((skill, idx) => (
                            <span key={idx} className="idea-card-skill-tag">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Meta Column */}
                    <div className="idea-card-meta">
                      {/* Team Capacity Bar */}
                      <div className="idea-card-capacity-box">
                        <div className="idea-card-capacity-header">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Users size={14} />
                            {currentMembers}/{totalCap} thành viên
                          </span>
                          <span style={{ color: "var(--brand-orange)", fontSize: "0.76rem" }}>
                            {post.remainingSlots > 0
                              ? `Còn ${post.remainingSlots} vị trí`
                              : "Đã đủ vị trí"}
                          </span>
                        </div>
                        <div className="idea-card-capacity-progress-track">
                          <div
                            className="idea-card-capacity-progress-fill"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Leader Info */}
                      <div className="idea-card-leader-row">
                        <div className="idea-card-leader-avatar">
                          {getInitials(post.leaderName)}
                        </div>
                        <div className="idea-card-leader-info">
                          <span className="idea-card-leader-name">{post.leaderName}</span>
                          <span className="idea-card-leader-sub">
                            Trưởng nhóm {post.leaderClass ? `• ${post.leaderClass}` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="idea-card-date-row">
                        <Clock size={13} />
                        <span>{formatRelativeTime(post.createdAt)}</span>
                      </div>

                      {/* Actions */}
                      <div className="idea-card-actions">
                        <button
                          type="button"
                          className="btn-card-view"
                          onClick={() => handleOpenDetail(post)}
                        >
                          Xem đề tài
                        </button>
                        <button
                          type="button"
                          className="btn-card-apply"
                          aria-label="Ứng tuyển ngay"
                          disabled={post.remainingSlots <= 0}
                          onClick={() => handleOpenApply(post)}
                        >
                          {post.remainingSlots > 0 ? "Ứng tuyển" : "Đã đủ chỉ tiêu"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* 3.6 Pagination Bar */}
          {!loading && posts.length > 0 && (
            <div className="idea-fair-pagination-bar">
              <span className="idea-fair-pagination-info">
                Hiển thị {startItem}–{endItem} trên {totalPosts} đề tài
              </span>

              <div className="idea-fair-pagination-controls">
                <button
                  type="button"
                  className="idea-fair-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} /> Trước
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`idea-fair-page-btn ${page === currentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="idea-fair-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Trang sau"
                >
                  Sau <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar */}
        <aside className="idea-fair-sidebar">
          {/* Quick Skill Filters */}
          <div className="idea-fair-sidebar-card">
            <h3 className="idea-fair-sidebar-title">
              <Filter size={18} style={{ color: "var(--brand-orange)" }} />
              Bộ lọc nhanh
            </h3>
            <p className="idea-fair-sidebar-subtitle">Kỹ năng</p>
            <div className="idea-fair-skill-checkboxes">
              {SIDEBAR_QUICK_SKILLS.map((skill) => (
                <label key={skill} className="idea-fair-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checkedSkills.includes(skill)}
                    onChange={() => handleToggleSkillCheckbox(skill)}
                  />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Callout: Bạn chưa có nhóm? */}
          <div className="idea-fair-no-team-banner">
            <div className="idea-fair-no-team-icon">
              <Users size={22} />
            </div>
            <h4 className="idea-fair-no-team-title">Bạn chưa có nhóm?</h4>
            <p className="idea-fair-no-team-desc">
              Khám phá các đề tài đang cần thêm thành viên và tìm đồng đội phù hợp với năng lực của bạn.
            </p>
            <button
              type="button"
              className="idea-fair-no-team-cta"
              onClick={handleResetFilters}
            >
              Khám phá ngay <ArrowRight size={15} />
            </button>
          </div>
        </aside>
      </div>

      {/* DETAIL MODAL: Xem đề tài */}
      {isClient && selectedDetailPost && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={() => setSelectedDetailPost(null)}
        >
          <div
            className="form-panel"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 680,
              background: "var(--surface)",
              borderRadius: 20,
              border: "1px solid var(--border)",
              padding: "clamp(18px, 4vw, 32px)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedDetailPost(null)}
              style={{
                position: "absolute",
                right: 20,
                top: 20,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
              }}
              aria-label="Đóng"
            >
              <X size={22} />
            </button>

            <p className="eyebrow" style={{ marginBottom: 6 }}>
              CHI TIẾT ĐỀ TÀI & TUYỂN DỤNG
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--brand-orange)",
                  background: "rgba(242, 92, 5, 0.12)",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                MÃ: {selectedDetailPost.referenceCode}
              </span>
              <span className="idea-card-status-badge">ĐANG TUYỂN</span>
            </div>

            <h2 style={{ fontSize: "clamp(1.2rem, 4vw, 1.45rem)", fontWeight: 800, margin: "0 0 12px 0", lineHeight: 1.3 }}>
              {selectedDetailPost.title}
            </h2>

            <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: 20 }}>
              Đề tài: <strong style={{ color: "var(--foreground)" }}>{selectedDetailPost.ideaTitle}</strong>
              {selectedDetailPost.field && ` (${selectedDetailPost.field})`}
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                Mô tả đề tài & nội dung tuyển dụng
              </h4>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--foreground)", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {selectedDetailPost.description}
              </p>
              {selectedDetailPost.ideaDescription && selectedDetailPost.ideaDescription !== selectedDetailPost.description && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--background)", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                    Chi tiết bổ sung từ bản đăng ký đề tài:
                  </div>
                  <p style={{ fontSize: "0.9rem", color: "var(--foreground)", margin: 0, overflowWrap: "anywhere" }}>
                    {selectedDetailPost.ideaDescription}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                Kỹ năng nhóm đang tìm kiếm
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedDetailPost.requiredSkills
                  .split(/[,;\n]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((skill, idx) => (
                    <span key={idx} className="idea-card-skill-tag" style={{ fontSize: 13, padding: "4px 10px" }}>
                      {skill}
                    </span>
                  ))}
              </div>
            </div>

            <div
              className="resp-grid-2"
              style={{
                padding: "16px",
                background: "var(--background)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                marginBottom: 24,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Trưởng nhóm</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>
                  {selectedDetailPost.leaderName}
                </div>
                {selectedDetailPost.leaderClass && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Lớp: {selectedDetailPost.leaderClass}</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Chỉ tiêu tuyển thành viên</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-orange)" }}>
                  Còn {selectedDetailPost.remainingSlots} / {selectedDetailPost.targetMemberCount} chỉ tiêu
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {formatRelativeTime(selectedDetailPost.createdAt)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <Button variant="outline" onClick={() => setSelectedDetailPost(null)}>
                Đóng
              </Button>
              <Button
                disabled={selectedDetailPost.remainingSlots <= 0}
                onClick={() => {
                  const post = selectedDetailPost;
                  setSelectedDetailPost(null);
                  handleOpenApply(post);
                }}
              >
                {selectedDetailPost.remainingSlots > 0 ? (
                  <>Ứng tuyển ngay <ArrowRight size={15} /></>
                ) : (
                  "Đã đủ chỉ tiêu"
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* APPLICATION MODAL (PRESERVED 100% BUSINESS RULES & CONSENT) */}
      {isClient && showApplyModal && selectedPost && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={handleCloseModal}
        >
          <div
            className="form-panel"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 640,
              background: "var(--surface)",
              borderRadius: 20,
              border: "1px solid var(--border)",
              padding: "clamp(18px, 4vw, 32px)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseModal}
              style={{
                position: "absolute",
                right: 20,
                top: 20,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
              }}
              aria-label="Đóng"
            >
              <X size={22} />
            </button>

            {!otpStep ? (
              /* FORM STEP */
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  HỒ SƠ ỨNG TUYỂN THÀNH VIÊN
                </p>
                <h2 style={{ fontSize: "clamp(1.2rem, 4vw, 1.45rem)", fontWeight: 800, margin: "0 0 6px 0" }}>
                  {selectedPost.title}
                </h2>
                <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 20px 0" }}>
                  Đề tài: <strong>{selectedPost.ideaTitle}</strong> ({selectedPost.referenceCode})
                </p>

                {formError && (
                  <div
                    className="notice"
                    style={{
                      borderLeft: "4px solid #ef4444",
                      color: "#ef4444",
                      marginBottom: 20,
                      padding: "10px 14px",
                    }}
                  >
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmitApply} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="resp-grid-2">
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Họ và tên <span style={{ color: "red" }}>*</span>
                      </label>
                      <Input
                        required
                        value={formData.fullName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        placeholder="Nguyễn Văn A"
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Mã sinh viên (MSSV) <span style={{ color: "red" }}>*</span>
                      </label>
                      <Input
                        required
                        value={formData.studentCode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, studentCode: e.target.value })
                        }
                        placeholder="71DCTT21..."
                      />
                    </div>
                  </div>

                  <div className="resp-grid-2">
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Email sinh viên <span style={{ color: "red" }}>*</span>
                      </label>
                      <Input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="sv@utt.edu.vn"
                      />
                      <EmailTypoSuggestion
                        email={formData.email}
                        onAccept={(fixed) => setFormData({ ...formData, email: fixed })}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Lớp sinh hoạt
                      </label>
                      <Input
                        value={formData.className}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, className: e.target.value })
                        }
                        placeholder="71DCTT21"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Số điện thoại liên hệ
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="0987xxxxxx"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Chuyên môn / Kỹ năng thế mạnh <span style={{ color: "red" }}>*</span>
                    </label>
                    <Input
                      required
                      value={formData.specialty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, specialty: e.target.value })
                      }
                      placeholder="Ví dụ: Lập trình Flutter, mô hình Revit, xử lý dữ liệu Python..."
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Lý do muốn tham gia đề tài <span style={{ color: "red" }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formData.motivation}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData({ ...formData, motivation: e.target.value })
                      }
                      placeholder="Nêu rõ lý do, mong muốn và mục tiêu khi tham gia đề tài này..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Đóng góp dự kiến cho nhóm <span style={{ color: "red" }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formData.contribution}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData({ ...formData, contribution: e.target.value })
                      }
                      placeholder="Bạn dự kiến đảm nhận những nhiệm vụ gì để giúp hoàn thiện đề tài..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  {/* INVARIANT 5: Explicit Consent Checkbox */}
                  <div
                    style={{
                      background: "rgba(242, 92, 5, 0.05)",
                      border: "1px solid rgba(242, 92, 5, 0.2)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      id="recruitment-consent"
                      required
                      checked={formData.consentAccepted}
                      onChange={(e) =>
                        setFormData({ ...formData, consentAccepted: e.target.checked })
                      }
                      style={{ marginTop: 3, width: 18, height: 18, cursor: "pointer" }}
                    />
                    <label
                      htmlFor="recruitment-consent"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--foreground)",
                        cursor: "pointer",
                      }}
                    >
                      <strong>Xác nhận chia sẻ dữ liệu:</strong> Tôi đồng ý và xác nhận rằng toàn bộ thông tin ứng tuyển trên (họ tên, MSSV, email, số điện thoại, năng lực chuyên môn và nội dung đề xuất) sẽ được chuyển trực tiếp cho Trưởng nhóm đề tài để phục vụ công tác xét duyệt và liên hệ phối hợp nghiên cứu.
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                    <Button type="button" variant="outline" onClick={handleCloseModal}>
                      Hủy bỏ
                    </Button>
                    <Button type="submit" disabled={formSubmitting}>
                      {formSubmitting ? "Đang gửi hồ sơ..." : "Tiếp tục: Xác thực Email"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : otpSuccess ? (
              /* OTP SUCCESS STATE */
              <div style={{ textAlign: "center", padding: "24px 8px" }}>
                <CheckCircle2 size={56} style={{ color: "#16a34a", margin: "0 auto 16px auto" }} />
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 10px 0" }}>
                  Ứng Tuyển Thành Công!
                </h3>
                <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 24px auto", lineHeight: 1.6 }}>
                  Email của bạn đã được xác thực thành công. Hồ sơ ứng tuyển đã được gửi trực tiếp tới Trưởng nhóm đề tài (<strong>{selectedPost.leaderName}</strong>). Bạn sẽ nhận được thông báo qua email khi Trưởng nhóm xét duyệt.
                </p>
                <Button onClick={handleCloseModal}>Đóng cửa sổ</Button>
              </div>
            ) : (
              /* OTP VERIFICATION STEP */
              <div style={{ textAlign: "center" }}>
                <ShieldCheck size={48} style={{ color: "var(--brand-orange)", margin: "0 auto 12px auto" }} />
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 8px 0" }}>
                  Xác Thực Email Ứng Tuyển
                </h3>
                <p style={{ fontSize: "0.92rem", color: "var(--muted)", maxWidth: 480, margin: "0 auto 20px auto", lineHeight: 1.5 }}>
                  Mã xác thực gồm 6 chữ số đã được gửi tới địa chỉ email:{" "}
                  <strong style={{ color: "var(--foreground)" }}>{maskedEmail}</strong>. Vui lòng nhập mã để hoàn tất đơn đăng ký.
                </p>

                {otpError && (
                  <div
                    className="notice"
                    style={{
                      borderLeft: "4px solid #ef4444",
                      color: "#ef4444",
                      marginBottom: 16,
                      textAlign: "left",
                    }}
                  >
                    {otpError}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} style={{ maxWidth: 320, margin: "0 auto" }}>
                  <Input
                    required
                    maxLength={6}
                    value={inputOtp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInputOtp(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="000000"
                    style={{
                      textAlign: "center",
                      letterSpacing: 8,
                      fontSize: 24,
                      fontWeight: 800,
                      height: 52,
                      fontFamily: "monospace",
                      marginBottom: 16,
                    }}
                  />

                  <Button
                    type="submit"
                    style={{ width: "100%", marginBottom: 14 }}
                    disabled={otpSubmitting || inputOtp.length !== 6}
                  >
                    {otpSubmitting ? "Đang xác thực..." : "Xác nhận OTP"}
                  </Button>

                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    {resendCooldown > 0 ? (
                      <span>
                        Gửi lại mã mới sau <strong>{resendCooldown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--brand-orange)",
                          cursor: "pointer",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        Gửi lại mã OTP
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
