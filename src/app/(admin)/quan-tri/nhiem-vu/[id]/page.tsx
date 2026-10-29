import React from "react";
import { redirect, notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminTaskDetailClient } from "@/components/admin-task-detail-client";
import { getTaskRawImage } from "@/lib/domain/task-image-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chi tiết Nhiệm vụ đặt hàng — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTaskDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const { id } = await params;
  const db = getDb();

  const task = await db.task.findUnique({
    where: { id },
    include: {
      applications: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          submitter: {
            select: {
              id: true,
              fullName: true,
              studentCode: true,
              className: true,
              email: true,
              phone: true,
              major: true,
            },
          },
          members: {
            orderBy: [{ orderIndex: "asc" }],
          },
          history: {
            orderBy: [{ createdAt: "desc" }],
          },
        },
      },
      history: {
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!task) {
    notFound();
  }

  const imageUrl = await getTaskRawImage(task.id);

  return <AdminTaskDetailClient task={{ ...task, imageUrl }} />;
}
