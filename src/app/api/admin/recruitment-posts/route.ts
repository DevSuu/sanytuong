import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { IdeaRecruitmentPostStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

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
    const status = searchParams.get("status")?.trim() as IdeaRecruitmentPostStatus | undefined;

    const db = getDb();
    const where: Prisma.IdeaRecruitmentPostWhereInput = {};

    if (status && Object.values(IdeaRecruitmentPostStatus).includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { requiredSkills: { contains: search, mode: "insensitive" } },
        { idea: { title: { contains: search, mode: "insensitive" } } },
        { idea: { referenceCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    const posts = await db.ideaRecruitmentPost.findMany({
      where,
      include: {
        idea: {
          select: {
            id: true,
            referenceCode: true,
            title: true,
            status: true,
            submitter: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
                className: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: posts });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Lỗi khi tải danh sách tin tuyển dụng cho quản trị.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
