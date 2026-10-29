"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

interface AutoRefreshWatcherProps {
  /** Refresh interval in milliseconds (default: 10000ms for admin, 15000ms for public) */
  intervalMs?: number;
  /** Mode: 'admin' always refreshes RSC routes; 'public' refreshes /tra-cuu/[token] RSC + dispatches client event */
  mode?: "admin" | "public";
}

/**
 * Checks whether the user is currently typing in a form field or has an interactive modal open,
 * so background refresh never interrupts active data entry.
 */
function isUserBusyInteracting(): boolean {
  if (typeof document === "undefined") return false;

  const active = document.activeElement;
  if (active) {
    const tag = active.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }
    if ((active as HTMLElement).isContentEditable) {
      return true;
    }
  }

  // Check if any modal dialog is open
  const openModal = document.querySelector(
    '[role="dialog"], [aria-modal="true"], .idea-fair-modal-backdrop'
  );
  if (openModal) {
    return true;
  }

  return false;
}

export function AutoRefreshWatcher({
  intervalMs = 10000,
  mode = "admin",
}: AutoRefreshWatcherProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [, startTransition] = useTransition();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    if (pathname.startsWith("/quan-tri/dang-nhap")) {
      return;
    }

    const triggerSilentRefresh = (force = false) => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (!force && isUserBusyInteracting()) return;

      const now = Date.now();
      if (!force && now - lastRefreshRef.current < 3500) {
        return;
      }
      lastRefreshRef.current = now;

      // Notify client-fetched views (TasksView, AwardsHallView, IdeaFairView, AdminIdeaFairClient)
      window.dispatchEvent(new CustomEvent("utt:auto-refresh"));

      // Refresh Server Components for Admin routes or Student Lookup (/tra-cuu/[token])
      const shouldRefreshServerRoute =
        mode === "admin" || pathname.startsWith("/tra-cuu/");

      if (shouldRefreshServerRoute) {
        startTransition(() => {
          router.refresh();
        });
      }

      window.dispatchEvent(
        new CustomEvent("utt:refresh-tick", { detail: { timestamp: now } })
      );
    };

    const timer = window.setInterval(() => {
      triggerSilentRefresh(false);
    }, intervalMs);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        triggerSilentRefresh(false);
      }
    };

    const handleManualRefresh = () => {
      triggerSilentRefresh(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("utt:manual-refresh", handleManualRefresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("utt:manual-refresh", handleManualRefresh);
    };
  }, [intervalMs, mode, pathname, router]);

  return null;
}
