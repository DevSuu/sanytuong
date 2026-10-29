"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, ShieldCheck, RefreshCw } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AdminHeaderActions() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { setTheme, theme } = useTheme();
  const [session, setSession] = React.useState<{
    user?: { name?: string | null; email?: string | null };
  } | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    authClient
      .getSession()
      .then((res) => {
        if (isMounted && res?.data) {
          setSession(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let timeoutId: number | undefined;
    const handleRefreshTick = () => {
      setIsSyncing(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsSyncing(false);
      }, 650);
    };
    window.addEventListener("utt:refresh-tick", handleRefreshTick);
    return () => {
      window.removeEventListener("utt:refresh-tick", handleRefreshTick);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleManualSync = () => {
    window.dispatchEvent(new CustomEvent("utt:manual-refresh"));
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.push("/quan-tri/dang-nhap");
      router.refresh();
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {!pathname.startsWith("/quan-tri/dang-nhap") && (
        <button
          type="button"
          onClick={handleManualSync}
          title="Tự động đồng bộ mỗi 10 giây — bấm để làm mới ngay"
          aria-label="Làm mới dữ liệu"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--muted)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: isSyncing
                ? "0 0 0 4px rgba(16, 185, 129, 0.25)"
                : "0 0 0 2px rgba(16, 185, 129, 0.14)",
              transition: "box-shadow 0.25s ease",
              flexShrink: 0,
            }}
          />
          <span>Live</span>
          <RefreshCw
            size={12}
            style={{
              color: isSyncing ? "var(--brand-orange)" : "var(--muted)",
              transform: isSyncing ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.45s ease, color 0.25s ease",
            }}
          />
        </button>
      )}
      <div
        className="theme-switch"
        style={{
          display: "inline-flex",
          alignItems: "center",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 2,
        }}
        aria-label="Chế độ hiển thị"
      >
        <button
          type="button"
          aria-label="Chế độ sáng"
          onClick={() => setTheme("light")}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            borderRadius: "4px",
            color: theme === "light" ? "var(--brand-orange)" : "var(--muted)",
          }}
        >
          <Sun size={16} />
        </button>
        <button
          type="button"
          aria-label="Chế độ tối"
          onClick={() => setTheme("dark")}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            borderRadius: "4px",
            color: theme === "dark" ? "var(--brand-orange)" : "var(--muted)",
          }}
        >
          <Moon size={16} />
        </button>
      </div>

      {session?.user && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          <ShieldCheck size={14} color="var(--brand-orange)" />
          <span style={{ fontWeight: 600 }}>{session.user.name || "Admin"}</span>
          <button
            type="button"
            onClick={handleSignOut}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              marginLeft: 4,
              color: "var(--muted)",
              padding: 2,
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
