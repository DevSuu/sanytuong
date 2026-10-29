"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  Building2,
  Calendar,
  Gift,
  ArrowRight,
  Users,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";
import { TaskDetailView } from "./task-detail-view";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGES,
  TaskStatus,
} from "@/lib/domain/task-state-machine";
import { getClientCache, setClientCache } from "@/lib/cache/client-cache";

interface TaskItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  orderingOrganization: string;
  reward?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  applicationDeadline?: string | null;
  executionDeadline?: string | null;
  status: TaskStatus;
  submittedCount: number;
}

function TaskCardSkeleton() {
  return (
    <article
      className="task-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: 20,
        minHeight: 220,
        opacity: 0.8,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ width: 90, height: 22, borderRadius: 20, background: "rgba(148, 163, 184, 0.2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ width: 70, height: 16, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)" }} />
        </div>
        <div style={{ width: "85%", height: 22, borderRadius: 6, background: "rgba(148, 163, 184, 0.2)", marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "100%", height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)", marginBottom: 6 }} />
        <div style={{ width: "75%", height: 14, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)", marginBottom: 16 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{ width: 90, height: 16, borderRadius: 4, background: "rgba(148, 163, 184, 0.15)" }} />
        <div style={{ width: 85, height: 32, borderRadius: 8, background: "rgba(148, 163, 184, 0.2)" }} />
      </div>
    </article>
  );
}

export function TasksView() {
  const { selectedTaskSlug, goToTaskDetail } = useAppNavigation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const cacheKey = `tasks:${search.trim()}:${statusFilter}`;
  const initialCache = getClientCache<{ tasks: TaskItem[] }>(cacheKey);

  const [tasks, setTasks] = useState<TaskItem[]>(() => initialCache.data?.tasks || []);
  const [loading, setLoading] = useState<boolean>(() => !initialCache.data);
  const isFirstMount = React.useRef(true);

  useEffect(() => {
    let isMounted = true;
    const currentKey = `tasks:${search.trim()}:${statusFilter}`;
    const cached = getClientCache<{ tasks: TaskItem[] }>(currentKey);

    if (cached.data && !cached.isStale && !isFirstMount.current) {
      return;
    }

    const executeFetch = () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      fetch(`/api/tasks?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.success && Array.isArray(data.tasks)) {
            setTasks(data.tasks);
            setClientCache(currentKey, { tasks: data.tasks });
          }
        })
        .catch((err) => {
          console.error("Lỗi khi tải danh sách nhiệm vụ:", err);
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    };

    if (isFirstMount.current) {
      isFirstMount.current = false;
      executeFetch();
      return;
    }

    if (search.trim().length > 0) {
      const timer = setTimeout(executeFetch, 200);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      executeFetch();
      return () => {
        isMounted = false;
      };
    }
  }, [search, statusFilter]);

  useEffect(() => {
    let isMounted = true;
    const handleSilentRefresh = () => {
      const currentKey = `tasks:${search.trim()}:${statusFilter}`;
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      fetch(`/api/tasks?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.success && Array.isArray(data.tasks)) {
            setTasks(data.tasks);
            setClientCache(currentKey, { tasks: data.tasks });
          }
        })
        .catch(() => {});
    };

    window.addEventListener("utt:auto-refresh", handleSilentRefresh);
    return () => {
      isMounted = false;
      window.removeEventListener("utt:auto-refresh", handleSilentRefresh);
    };
  }, [search, statusFilter]);

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    const nextKey = `tasks:${search.trim()}:${status}`;
    const nextCached = getClientCache<{ tasks: TaskItem[] }>(nextKey);
    if (nextCached.data?.tasks) {
      setTasks(nextCached.data.tasks);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  if (selectedTaskSlug) {
    return <TaskDetailView slug={selectedTaskSlug} />;
  }

  return (
    <div className="container page-shell">
      <p className="eyebrow">GIẢI BÀI TOÁN THỰC TIỄN TỪ DOANH NGHIỆP</p>
      <h1>Sảnh nhiệm vụ – Đặt hàng sáng tạo</h1>
      <p className="page-intro">
        Nơi các doanh nghiệp, viện nghiên cứu và khoa ban đưa ra bài toán thực tế
        để sinh viên UTT thành lập nhóm giải quyết và nhận tài trợ, giải thưởng.
      </p>

      {/* SEARCH AND FILTER BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          margin: "28px 0 24px 0",
        }}
      >
        <div style={{ position: "relative", minWidth: 0, width: "100%", flex: "1 1 280px" }}>
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
            type="text"
            placeholder="Tìm theo tên nhiệm vụ, đơn vị đặt hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 38px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Tất cả" },
            { key: "OPEN", label: "Đang mở đăng ký" },
            { key: "ASSIGNED", label: "Đã giao nhóm" },
            { key: "IN_PROGRESS", label: "Đang thực hiện" },
            { key: "COMPLETED", label: "Đã hoàn thành" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatusFilterChange(tab.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--border)",
                cursor: "pointer",
                background:
                  statusFilter === tab.key
                    ? "var(--brand-orange)"
                    : "var(--surface)",
                color: statusFilter === tab.key ? "#fff" : "var(--foreground)",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TASKS LIST */}
      {loading && tasks.length === 0 ? (
        <div className="three-grid" aria-busy="true" aria-label="Đang tải danh sách nhiệm vụ...">
          {Array.from({ length: 6 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="form-panel" style={{ textAlign: "center", padding: 48 }}>
          <Briefcase size={40} style={{ margin: "0 auto 12px", color: "var(--muted)" }} />
          <h3>Không tìm thấy nhiệm vụ nào</h3>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.
          </p>
        </div>
      ) : (
        <div className="three-grid">
          {tasks.map((task) => {
            const badge = TASK_STATUS_BADGES[task.status] || {
              bg: "#f1f5f9",
              color: "#334155",
              border: "#cbd5e1",
            };

            return (
              <article
                key={task.id}
                className="task-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  overflow: "hidden",
                  padding: 0,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div>
                  {task.imageUrl && (
                    <div
                      style={{
                        width: "100%",
                        height: 175,
                        background: "#0f172a",
                        overflow: "hidden",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={task.imageUrl}
                        alt={task.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  )}
                  <div style={{ padding: "18px 20px 0 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {TASK_STATUS_LABELS[task.status] || task.status}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Users size={13} /> {task.submittedCount} nhóm
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--brand-orange)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 6,
                      }}
                    >
                      <Building2 size={13} />
                      {task.orderingOrganization}
                    </div>

                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        margin: "0 0 8px 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {task.title}
                    </h3>

                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {task.description}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 20, padding: "0 20px 20px 20px" }}>
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: 12,
                      marginBottom: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    {task.reward && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 700,
                          color: "#16a34a",
                        }}
                      >
                        <Gift size={14} /> {task.reward}
                      </div>
                    )}
                    {task.applicationDeadline && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} /> Hạn đăng ký:{" "}
                        {new Date(task.applicationDeadline).toLocaleDateString("vi-VN")}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    style={{ width: "100%", justifyContent: "center", gap: 8 }}
                    onClick={() => goToTaskDetail(task.slug)}
                  >
                    Xem chi tiết nhiệm vụ <ArrowRight size={14} />
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
