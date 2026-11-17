import React from "react";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Prisma, IdeaStatus } from "@/generated/prisma/client";
import { AdminIdeasTable, IdeaTableRow } from "@/components/admin-ideas-table";
import { IDEA_FILTER_STATUS, IdeaFilterStatus } from "@/lib/domain/idea-state-machine";

export const metadata = {
  title: "Danh sách Ý tưởng — Quản trị UTT",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function AdminIdeasListPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/quan-tri/dang-nhap");
  }

  const resolvedParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedParams.page || "1", 10) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(resolvedParams.pageSize || "10", 10) || 10)
  );
  const search = (resolvedParams.search || "").trim();
  const statusParam = (resolvedParams.status || "").trim();
  const sort = resolvedParams.sort || "createdAt";
  const order = resolvedParams.order === "asc" ? "asc" : "desc";

  // Validate status filter
  const validStatus = Object.values(IDEA_FILTER_STATUS).includes(
    statusParam as IdeaFilterStatus
  )
    ? (statusParam as IdeaFilterStatus)
    : undefined;

  const db = getDb();

  // Construct Prisma WHERE clause with server-side security & sanitization
  const andConditions: Prisma.IdeaWhereInput[] = [];

  if (validStatus === "PROFILE_COMPLETED") {
    andConditions.push({
      status: IdeaStatus.APPROVED,
      projectProfile: {
        status: "SUBMITTED",
      },
    });
  } else if (validStatus === "PROFILE_APPROVED") {
    andConditions.push({
      status: IdeaStatus.APPROVED,
      projectProfile: {
        status: "COMPLETED",
      },
    });
  } else if (validStatus === IdeaStatus.APPROVED) {
    andConditions.push({
      status: IdeaStatus.APPROVED,
      OR: [
        { projectProfile: null },
        { projectProfile: { status: { notIn: ["SUBMITTED", "COMPLETED"] } } },
      ],
    });
  } else if (validStatus) {
    andConditions.push({ status: validStatus as IdeaStatus });
  }

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { referenceCode: { contains: search, mode: "insensitive" } },
        { submitter: { fullName: { contains: search, mode: "insensitive" } } },
        { submitter: { studentCode: { contains: search, mode: "insensitive" } } },
        { submitter: { email: { contains: search, mode: "insensitive" } } },
        { submitter: { className: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.IdeaWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // Determine orderBy
  const orderBy: Prisma.IdeaOrderByWithRelationInput =
    sort === "title"
      ? { title: order }
      : sort === "updatedAt"
      ? { updatedAt: order }
      : { createdAt: order };

  const [totalCount, ideas] = await Promise.all([
    db.idea.count({ where }),
    db.idea.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        submitter: {
          select: {
            fullName: true,
            studentCode: true,
            className: true,
            email: true,
          },
        },
        projectProfile: {
          select: {
            status: true,
          },
        },
      },
    }),
  ]);

  const tableData: IdeaTableRow[] = ideas.map((idea) => ({
    id: idea.id,
    referenceCode: idea.referenceCode,
    title: idea.title,
    field: idea.field,
    status: idea.status,
    profileStatus: idea.projectProfile?.status ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
    submitter: {
      fullName: idea.submitter.fullName,
      studentCode: idea.submitter.studentCode,
      className: idea.submitter.className,
      email: idea.submitter.email,
    },
  }));

  return (
    <div className="container">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--radius)",
              backgroundColor: "rgba(242, 92, 5, 0.1)",
              color: "var(--brand-orange)",
            }}
          >
            <Lightbulb size={20} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>
            Quản lý Danh sách Ý tưởng
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Tìm kiếm, lọc trạng thái, phân trang và quản lý vòng đời xét duyệt các hồ sơ dự thi
        </p>
      </div>

      <AdminIdeasTable
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        currentSearch={search}
        currentStatus={validStatus || ""}
        currentSort={sort}
        currentOrder={order}
      />
    </div>
  );
}
