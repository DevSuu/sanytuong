import React from "react";
import { redirect, notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminAwardDetailClient } from "@/components/admin-award-detail-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chi tiết Giải thưởng — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAwardDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { id } = await params;
  const db = getDb();

  const [award, seasons] = await Promise.all([
    db.award.findUnique({
      where: { id },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        members: {
          orderBy: { displayOrder: "asc" },
        },
        history: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.awardSeason.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
  ]);

  if (!award) {
    notFound();
  }

  return <AdminAwardDetailClient award={award} seasons={seasons} />;
}
