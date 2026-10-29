"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  PauseCircle,
  PlayCircle,
  Lock,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface AdminPostItem {
  id: string;
  title: string;
  description: string;
  targetMemberCount: number;
  requiredSkills: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  idea: {
    id: string;
    referenceCode: string;
    title: string;
    status: string;
    submitter: {
      fullName: string;
      studentCode: string;
      className: string | null;
      email: string;
    };
  };
  _count: {
    applications: number;
  };
}

export function AdminIdeaFairClient() {
  const [posts, setPosts] = useState<AdminPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/admin/recruitment-posts?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          setPosts(json.data);
          setError(null);
        } else {
          setError(json.error || "Không thể tải danh sách tin tuyển dụng.");
        }
      })
      .catch(() => {
        setError("Lỗi kết nối khi tải danh sách quản trị.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const handleAutoRefresh = () => {
      fetchPosts();
    };
    window.addEventListener("utt:auto-refresh", handleAutoRefresh);
    return () => {
      window.removeEventListener("utt:auto-refresh", handleAutoRefresh);
    };
  }, [fetchPosts]);

  const handleUpdateStatus = async (postId: string, newStatus: string) => {
    const actionLabel =
      newStatus === "PUBLISHED"
        ? "mở phê duyệt hiển thị (PUBLISHED)"
        : newStatus === "PAUSED"
        ? "tạm dừng (PAUSED)"
        : "đóng (CLOSED)";
    if (!confirm(`Bạn có chắc chắn muốn ${actionLabel} tin tuyển dụng này không?`)) {
      return;
    }

    setActionLoading(postId);
    try {
      const res = await fetch(`/api/admin/recruitment-posts/${postId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchPosts();
      } else {
        alert(json.error || "Lỗi khi cập nhật trạng thái.");
      }
    } catch {
      alert("Lỗi kết nối.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePost = async (postId: string, postTitle: string) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn XÓA VĨNH VIỄN tin tuyển dụng "${postTitle}" cùng toàn bộ hồ sơ ứng tuyển liên quan không?\nThao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }

    setActionLoading(postId);
    try {
      const res = await fetch(`/api/admin/recruitment-posts/${postId}/status`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        fetchPosts();
      } else {
        alert(json.error || "Lỗi khi xóa tin tuyển dụng.");
      }
    } catch {
      alert("Lỗi kết nối khi xóa tin tuyển dụng.");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(22, 163, 74, 0.1)", color: "#16a34a" }}>
            ● PUBLISHED (Đang mở)
          </span>
        );
      case "PAUSED":
        return (
          <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(234, 179, 8, 0.1)", color: "#ca8a04" }}>
            ⏸ PAUSED (Tạm dừng)
          </span>
        );
      case "CLOSED":
        return (
          <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626" }}>
            ✕ CLOSED (Đã đóng)
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(100, 116, 139, 0.1)", color: "#64748b" }}>
            ✎ DRAFT (Bản nháp)
          </span>
        );
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
            Quản trị Hội chợ ý tưởng
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.95rem" }}>
            Theo dõi và kiểm duyệt các tin tuyển dụng thành viên của các đề tài nghiên cứu.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/hoi-cho-y-tuong" target="_blank">
            <ExternalLink size={15} /> Xem giao diện công khai
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          background: "var(--surface)",
          padding: "16px 20px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          marginBottom: 24,
        }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề tin, đề tài, mã hồ sơ..."
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["ALL", "PUBLISHED", "PAUSED", "CLOSED", "DRAFT"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "default" : "outline"}
              onClick={() => setStatusFilter(st)}
            >
              {st === "ALL" ? "Tất cả" : st}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
          Đang tải danh sách tin tuyển dụng...
        </div>
      ) : error ? (
        <div className="notice" style={{ borderLeft: "4px solid #ef4444", color: "#ef4444" }}>
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
          Không tìm thấy tin tuyển dụng nào.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            <thead>
              <tr style={{ background: "var(--background)", borderBottom: "1px solid var(--border)", textAlign: "left", fontSize: 13, color: "var(--muted)" }}>
                <th style={{ padding: "14px 16px" }}>Mã & Đề tài</th>
                <th style={{ padding: "14px 16px" }}>Tin tuyển dụng</th>
                <th style={{ padding: "14px 16px" }}>Trưởng nhóm</th>
                <th style={{ padding: "14px 16px" }}>Chỉ tiêu & Ứng viên</th>
                <th style={{ padding: "14px 16px" }}>Trạng thái</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Kiểm duyệt</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", fontSize: 14 }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, color: "var(--brand-orange)", fontSize: 12 }}>
                      {p.idea.referenceCode}
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>
                      {p.idea.title}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.requiredSkills}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div><strong>{p.idea.submitter.fullName}</strong></div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.idea.submitter.studentCode} · {p.idea.submitter.email}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div>Chỉ tiêu: <strong>{p.targetMemberCount}</strong></div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Đã nộp: {p._count.applications} hồ sơ</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {getStatusBadge(p.status)}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {p.status !== "PUBLISHED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === p.id}
                          onClick={() => handleUpdateStatus(p.id, "PUBLISHED")}
                          title="Mở tuyển dụng"
                        >
                          <PlayCircle size={14} />
                        </Button>
                      )}
                      {p.status === "PUBLISHED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === p.id}
                          onClick={() => handleUpdateStatus(p.id, "PAUSED")}
                          title="Tạm dừng"
                        >
                          <PauseCircle size={14} />
                        </Button>
                      )}
                      {p.status !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === p.id}
                          onClick={() => handleUpdateStatus(p.id, "CLOSED")}
                          title="Đóng tin"
                          style={{ color: "#dc2626" }}
                        >
                          <Lock size={14} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === p.id}
                        onClick={() => handleDeletePost(p.id, p.title)}
                        title="Xóa vĩnh viễn tin tuyển dụng"
                        style={{
                          color: "#b91c1c",
                          borderColor: "#fca5a5",
                          background: "#fee2e2",
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
