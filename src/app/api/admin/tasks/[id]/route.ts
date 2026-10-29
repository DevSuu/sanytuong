import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateTaskSchema } from "@/lib/validation/task-schema";
import { TaskHistoryAction } from "@/generated/prisma/client";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";
import {
  getTaskRawImage,
  setTaskImage,
  deleteTaskImage,
} from "@/lib/domain/task-image-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tasks/[id]
 * Fetches full task details for admin, including all applications, members, and audit history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
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
      return NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
    }

    const imageUrl = await getTaskRawImage(task.id);

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        imageUrl,
      },
    });
  } catch (error) {
    console.error("[AdminGetTaskDetailError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy thông tin chi tiết nhiệm vụ." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tasks/[id]
 * Updates task fields (title, description, requirements, deadlines, reward, etc.).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dữ liệu cập nhật không hợp lệ.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const db = getDb();
    const task = await db.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
    }

    const {
      title,
      description,
      requirements,
      orderingOrganization,
      reward,
      category,
      applicationDeadline,
      executionDeadline,
      reason,
    } = parsed.data;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id },
        data: {
          title: title ?? task.title,
          description: description ?? task.description,
          requirements: requirements !== undefined ? requirements : task.requirements,
          orderingOrganization:
            orderingOrganization ?? task.orderingOrganization,
          reward: reward !== undefined ? reward : task.reward,
          category: category !== undefined ? category : task.category,
          applicationDeadline:
            applicationDeadline !== undefined
              ? applicationDeadline
                ? new Date(applicationDeadline)
                : null
              : task.applicationDeadline,
          executionDeadline:
            executionDeadline !== undefined
              ? executionDeadline
                ? new Date(executionDeadline)
                : null
              : task.executionDeadline,
        },
      });

      await tx.taskHistory.create({
        data: {
          taskId: id,
          actorId: session.user.id,
          actorRole: "ADMIN",
          action: TaskHistoryAction.TASK_UPDATED,
          reason: reason || "Quản trị viên cập nhật thông tin nhiệm vụ.",
          metadata: {
            adminName: session.user.name,
            adminEmail: session.user.email,
          },
        },
      });

      return result;
    });

    if (parsed.data.imageUrl !== undefined) {
      await setTaskImage(id, parsed.data.imageUrl);
    }

    triggerGoogleSheetsAutoSync("admin:task-update");

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin nhiệm vụ thành công!",
      task: updated,
    });
  } catch (error) {
    console.error("[AdminUpdateTaskError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi cập nhật nhiệm vụ." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tasks/[id]
 * Permanently deletes a task (and cascades to its applications & history).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 });
    }

    const { id } = await params;
    const db = getDb();

    const task = await db.task.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
    }

    await db.task.delete({ where: { id } });
    await deleteTaskImage(id);

    triggerGoogleSheetsAutoSync("admin:task-delete");

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhiệm vụ "${task.title}" thành công.`,
    });
  } catch (error) {
    console.error("[AdminDeleteTaskError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa nhiệm vụ." },
      { status: 500 }
    );
  }
}
