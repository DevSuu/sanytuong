import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createTaskSchema } from "@/lib/validation/task-schema";
import { slugify } from "@/lib/domain/task-service";
import { TaskStatus, TaskHistoryAction, Prisma } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import { setTaskImage } from "@/lib/domain/task-image-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tasks
 * Admin endpoint to list all tasks (including DRAFT), with search, filter, and application metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() as TaskStatus | undefined;

    const db = getDb();
    const where: Prisma.TaskWhereInput = {};

    if (status && Object.values(TaskStatus).includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { orderingOrganization: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
        applications: {
          where: { status: "SELECTED" },
          take: 1,
          include: {
            submitter: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
                email: true,
                className: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      tasks: tasks.map((t) => ({
        ...t,
        applicationsCount: t._count.applications,
        selectedApplication: t.applications[0] || null,
      })),
    });
  } catch (error) {
    console.error("[AdminGetTasksError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy danh sách nhiệm vụ." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tasks
 * Admin endpoint to create a new task.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu nhiệm vụ không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const {
      title,
      slug: customSlug,
      description,
      requirements,
      orderingOrganization,
      reward,
      category,
      applicationDeadline,
      executionDeadline,
      status,
    } = parsed.data;

    const db = getDb();

    // Generate unique slug
    let baseSlug = customSlug?.trim() ? slugify(customSlug) : slugify(title);
    if (!baseSlug) baseSlug = "nhiem-vu-" + Date.now();

    let candidateSlug = baseSlug;
    let counter = 1;
    while (await db.task.findUnique({ where: { slug: candidateSlug } })) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const task = await db.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title,
          slug: candidateSlug,
          description,
          requirements: requirements || null,
          orderingOrganization,
          reward: reward || null,
          category: category || null,
          applicationDeadline: applicationDeadline
            ? new Date(applicationDeadline)
            : null,
          executionDeadline: executionDeadline
            ? new Date(executionDeadline)
            : null,
          status: status || TaskStatus.DRAFT,
          createdBy: session.user.id,
        },
      });

      await tx.taskHistory.create({
        data: {
          taskId: created.id,
          actorId: session.user.id,
          actorRole: "ADMIN",
          action: TaskHistoryAction.TASK_CREATED,
          reason: "Khởi tạo nhiệm vụ mới.",
          metadata: {
            adminName: session.user.name,
            adminEmail: session.user.email,
          },
        },
      });

      return created;
    });

    if (parsed.data.imageUrl) {
      await setTaskImage(task.id, parsed.data.imageUrl);
    }

    triggerGoogleSheetsAutoSync("admin:task-create");

    return NextResponse.json({
      success: true,
      message: "Tạo nhiệm vụ thành công!",
      task,
    });
  } catch (error) {
    console.error("[AdminCreateTaskError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tạo nhiệm vụ mới." },
      { status: 500 }
    );
  }
}
