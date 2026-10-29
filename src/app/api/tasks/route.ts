import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TaskStatus, Prisma } from "@/generated/prisma/client";
import { getTaskImageMap, resolvePublicTaskImageUrl } from "@/lib/domain/task-image-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks
 * Public endpoint to list tasks in the Task Hall.
 * Excludes DRAFT tasks for public viewers.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const statusParam = searchParams.get("status")?.trim();

    const db = getDb();

    // Build filter: never expose DRAFT to public
    const allowedStatuses: TaskStatus[] = [
      TaskStatus.OPEN,
      TaskStatus.ASSIGNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.CLOSED,
    ];

    let filterStatus: TaskStatus[] = allowedStatuses;
    if (statusParam && allowedStatuses.includes(statusParam as TaskStatus)) {
      filterStatus = [statusParam as TaskStatus];
    }

    const where: Prisma.TaskWhereInput = {
      status: { in: filterStatus },
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { orderingOrganization: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tasks, imageMap] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          orderingOrganization: true,
          reward: true,
          category: true,
          applicationDeadline: true,
          executionDeadline: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              applications: {
                where: {
                  status: { in: ["SUBMITTED", "SELECTED", "NOT_SELECTED"] },
                },
              },
            },
          },
        },
      }),
      getTaskImageMap(),
    ]);

    return NextResponse.json(
      {
        success: true,
        tasks: tasks.map(({ _count, ...t }) => ({
          ...t,
          imageUrl: resolvePublicTaskImageUrl(t, imageMap),
          submittedCount: _count.applications,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error("[GetTasksError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy danh sách nhiệm vụ." },
      { status: 500 }
    );
  }
}
