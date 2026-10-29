"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV_ITEMS = [
  { href: "/quan-tri", label: "Tổng quan", exact: true },
  { href: "/quan-tri/bang-tin", label: "Bảng tin" },
  { href: "/quan-tri/y-tuong", label: "Quản lý ý tưởng" },
  { href: "/quan-tri/ho-so", label: "Hồ sơ đề tài" },
  { href: "/quan-tri/nhiem-vu", label: "Nhiệm vụ đặt hàng" },
  { href: "/quan-tri/giai-thuong", label: "Giải thưởng" },
  { href: "/quan-tri/hoi-cho-y-tuong", label: "Hội chợ ý tưởng" },
];

export function AdminNavLinks() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/quan-tri/dang-nhap")) {
    return null;
  }

  return (
    <nav
      aria-label="Điều hướng quản trị"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        maxWidth: "100%",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className="button button-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              lineHeight: 1,
              height: 34,
              padding: "0 12px",
              borderRadius: 7,
              whiteSpace: "nowrap",
              flexShrink: 0,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--brand-orange)" : "var(--foreground)",
              backgroundColor: isActive ? "rgba(242, 92, 5, 0.1)" : "transparent",
              transition: "background-color 0.18s ease, color 0.18s ease",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
