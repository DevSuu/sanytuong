import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminIdeaFairClient } from "@/components/admin-idea-fair-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản trị Hội chợ Ý tưởng — Thử thách sáng tạo 4.0 UTT",
  robots: { index: false, follow: false },
};

export default async function AdminIdeaFairPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  return <AdminIdeaFairClient />;
}
