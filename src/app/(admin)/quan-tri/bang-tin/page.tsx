import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getAdminNewsPosts } from "@/lib/domain/news-service";
import { AdminNewsfeedClient } from "@/components/admin-newsfeed-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản trị Bảng Tin & Hoạt Động Sáng Tạo — Quản trị UTT",
  robots: { index: false, follow: false },
};

export default async function AdminNewsfeedPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const items = await getAdminNewsPosts();
  return <AdminNewsfeedClient initialItems={items} />;
}
