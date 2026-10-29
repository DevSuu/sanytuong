import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { TaskStatus } from "@/generated/prisma/client";
import { getTaskImageMap, resolvePublicTaskImageUrl } from "@/lib/domain/task-image-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[slug]
 * Returns details of a specific task.
 * Excludes DRAFT unless requested by an authorized caller.
 * Optionally returns the student's existing application if lookupToken is provided.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const lookupToken =
      req.headers.get("x-lookup-token")?.trim() ||
      searchParams.get("token")?.trim() ||
      "";

    const db = getDb();

    const cleanSlug = slug?.trim();
    const task =
      (await db.task.findUnique({
        where: { slug: cleanSlug },
        include: {
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
      })) ||
      (cleanSlug?.startsWith("demo-")
        ? await db.task.findUnique({
            where: { slug: cleanSlug.replace(/^demo-/, "") },
            include: {
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
          })
        : null);

    if (!task) {
      return NextResponse.json(
        { error: "Không tìm thấy nhiệm vụ yêu cầu." },
        { status: 404 }
      );
    }

    if (task.status === TaskStatus.DRAFT) {
      return NextResponse.json(
        { error: "Nhiệm vụ này chưa được công bố công khai." },
        { status: 404 }
      );
    }

    let myApplication = null;
    let submitter = null;

    if (lookupToken) {
      const tokenHash = hashToken(lookupToken);
      const credential = await db.lookupCredential.findUnique({
        where: { tokenHash },
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
        },
      });

      if (credential && credential.submitter && !credential.revokedAt) {
        submitter = credential.submitter;
        myApplication = await db.taskApplication.findFirst({
          where: {
            taskId: task.id,
            submitterId: credential.submitter.id,
          },
          include: {
            members: { orderBy: { orderIndex: "asc" } },
            history: { orderBy: { createdAt: "desc" } },
          },
        });
      }
    }

    const { _count, ...taskDto } = task;
    const imageMap = await getTaskImageMap();

    return NextResponse.json({
      success: true,
      task: {
        ...taskDto,
        imageUrl: resolvePublicTaskImageUrl(task, imageMap),
        submittedCount: _count.applications,
      },
      myApplication,
      submitter,
    });
  } catch (error) {
    console.error("[GetTaskDetailError]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy thông tin nhiệm vụ." },
      { status: 500 }
    );
  }
}
