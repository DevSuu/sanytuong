import React from "react";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminHeaderActions } from "@/components/admin-header-actions";
import { AdminNavLinks } from "@/components/admin-nav-links";
import { AutoRefreshWatcher } from "@/components/auto-refresh-watcher";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản trị — Thử thách sáng tạo 4.0 UTT",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // Enforce session check on all admin routes except login
  if (pathname && !pathname.startsWith("/quan-tri/dang-nhap")) {
    const session = await getAdminSession();
    if (!session) {
      redirect("/quan-tri/dang-nhap");
    }
  }

  return (
    <div className="admin-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AutoRefreshWatcher intervalMs={10000} mode="admin" />
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--background)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: "64px",
            paddingTop: 8,
            paddingBottom: 8,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              maxWidth: "100%",
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            <Link
              href="/quan-tri"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
                flexShrink: 0,
              }}
            >
              <Image
                src="/images/utt-logo.webp"
                alt="UTT Logo"
                width={96}
                height={92}
                unoptimized
                style={{ height: "44px", width: "auto" }}
              />
              <span
                style={{
                  borderLeft: "2px solid var(--brand-orange)",
                  paddingLeft: "10px",
                  fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: "var(--brand-orange)",
                  textTransform: "uppercase",
                }}
              >
                TRƯỜNG ĐẠI HỌC CÔNG NGHỆ GTVT
                <br />
                <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em" }}>
                  QUẢN TRỊ THỬ THÁCH SÁNG TẠO 4.0
                </span>
              </span>
            </Link>

            <AdminNavLinks />
          </div>

          <div style={{ flexShrink: 0 }}>
            <AdminHeaderActions />
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "32px 0 64px 0" }}>{children}</main>
    </div>
  );
}
