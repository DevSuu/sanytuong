"use client";
import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

export type TabKey =
  | "home"
  | "gui-y-tuong"
  | "nhiem-vu"
  | "hoi-cho-y-tuong"
  | "giai-thuong"
  | "the-le"
  | "tra-cuu"
  | "lien-he";

export const TAB_ROUTES: Record<TabKey, string> = {
  home: "/",
  "gui-y-tuong": "/gui-y-tuong",
  "nhiem-vu": "/nhiem-vu",
  "hoi-cho-y-tuong": "/hoi-cho-y-tuong",
  "giai-thuong": "/san-giai-thuong",
  "the-le": "/the-le",
  "tra-cuu": "/tra-cuu",
  "lien-he": "/lien-he",
};

export const ROUTE_TO_TAB: Record<string, TabKey> = {
  "/": "home",
  "/gui-y-tuong": "gui-y-tuong",
  "/nhiem-vu": "nhiem-vu",
  "/hoi-cho-y-tuong": "hoi-cho-y-tuong",
  "/san-giai-thuong": "giai-thuong",
  "/giai-thuong": "giai-thuong",
  "/the-le": "the-le",
  "/tra-cuu": "tra-cuu",
  "/lien-he": "lien-he",
};

const TAB_ORDER: TabKey[] = [
  "home",
  "gui-y-tuong",
  "nhiem-vu",
  "hoi-cho-y-tuong",
  "giai-thuong",
  "the-le",
  "tra-cuu",
  "lien-he",
];

interface NavigationContextType {
  currentTab: TabKey;
  selectedTaskSlug: string | null;
  direction: "forward" | "back";
  isPopState: boolean;
  goToTab: (tab: TabKey, taskSlug?: string | null) => void;
  goToTaskDetail: (slug: string) => void;
  goBackToTasks: () => void;
  prefetchTab: (tab: TabKey) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({
  initialTab = "home",
  initialTaskSlug = null,
  children,
}: {
  initialTab?: TabKey;
  initialTaskSlug?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const routeTab = pathname.startsWith("/nhiem-vu")
    ? "nhiem-vu"
    : pathname.startsWith("/hoi-cho-y-tuong")
    ? "hoi-cho-y-tuong"
    : pathname.startsWith("/the-le")
    ? "the-le"
    : pathname.startsWith("/san-giai-thuong") || pathname.startsWith("/giai-thuong")
    ? "giai-thuong"
    : (ROUTE_TO_TAB[pathname] || initialTab);
  const routeTaskSlug =
    pathname.startsWith("/nhiem-vu/") && pathname !== "/nhiem-vu/"
      ? pathname.replace("/nhiem-vu/", "")
      : initialTaskSlug;

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [activeTaskSlug, setActiveTaskSlug] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [isPopState, setIsPopState] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const currentTab = activeTab ?? routeTab;
  const selectedTaskSlug =
    activeTaskSlug !== null ? activeTaskSlug : routeTaskSlug;

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setActiveTab(null);
  }

  // Tiêu đề trang cố định duy nhất "Thử thách sáng tạo 4.0 | UTT"
  useEffect(() => {
    document.title = "Thử thách sáng tạo 4.0 | UTT";
  }, [currentTab]);

  // Xử lý nút Back/Forward của trình duyệt mà không reload trang
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setIsPopState(true);
      if (path.startsWith("/nhiem-vu/") && path !== "/nhiem-vu/") {
        const slug = path.replace("/nhiem-vu/", "");
        setDirection("forward");
        setActiveTab("nhiem-vu");
        setActiveTaskSlug(slug);
        return;
      }
      const matchedTab = ROUTE_TO_TAB[path] || "home";
      const fromIdx = TAB_ORDER.indexOf(currentTab);
      const toIdx = TAB_ORDER.indexOf(matchedTab);
      setDirection(toIdx >= fromIdx ? "forward" : "back");
      setActiveTab(matchedTab);
      setActiveTaskSlug(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentTab]);

  const goToTab = (tab: TabKey, taskSlug: string | null = null) => {
    const fromIdx = TAB_ORDER.indexOf(currentTab);
    const toIdx = TAB_ORDER.indexOf(tab);
    const newDir = toIdx >= fromIdx ? "forward" : "back";

    setIsPopState(false);
    startTransition(() => {
      setDirection(newDir);
      setActiveTab(tab);
      setActiveTaskSlug(taskSlug);
    });

    const targetRoute = taskSlug ? `/nhiem-vu/${taskSlug}` : TAB_ROUTES[tab];
    if (typeof window !== "undefined") {
      const isDetailPage =
        pathname.startsWith("/nhiem-vu/") ||
        pathname.startsWith("/san-giai-thuong/") ||
        pathname.startsWith("/quan-tri");

      if (isDetailPage) {
        router.push(targetRoute);
      } else if (window.location.pathname !== targetRoute) {
        window.history.pushState(null, "", targetRoute);
      }
    }

    window.scrollTo(0, 0);
  };

  const goToTaskDetail = (slug: string) => {
    goToTab("nhiem-vu", slug);
  };

  const goBackToTasks = () => {
    setDirection("back");
    setActiveTaskSlug(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/nhiem-vu") {
      window.history.pushState(null, "", "/nhiem-vu");
    }
  };

  const prefetchTab = (tab: TabKey) => {
    try {
      const targetRoute = TAB_ROUTES[tab];
      if (targetRoute) {
        router.prefetch(targetRoute);
      }
      switch (tab) {
        case "gui-y-tuong":
          void import("@/components/views/submit-idea-view");
          break;
        case "nhiem-vu":
          void import("@/components/views/tasks-view");
          break;
        case "hoi-cho-y-tuong":
          void import("@/components/views/idea-fair-view");
          break;
        case "giai-thuong":
          void import("@/components/views/awards-view");
          break;
        case "tra-cuu":
          void import("@/components/views/lookup-view");
          break;
        case "the-le":
          void import("@/components/views/rules-view");
          break;
        case "lien-he":
          void import("@/components/views/contact-view");
          break;
        default:
          break;
      }
    } catch {
      // Ignore prefetch errors
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      TAB_ORDER.forEach((tab) => {
        if (tab !== "home") {
          try {
            router.prefetch(TAB_ROUTES[tab]);
          } catch {
            // Ignore
          }
        }
      });
    }, 2800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <NavigationContext.Provider
      value={{
        currentTab,
        selectedTaskSlug,
        direction,
        isPopState,
        goToTab,
        goToTaskDetail,
        goBackToTasks,
        prefetchTab,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useAppNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useAppNavigation must be used within NavigationProvider");
  }
  return ctx;
}
