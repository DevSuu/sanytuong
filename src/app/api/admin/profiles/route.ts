import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { ProjectProfileStatus, Prisma } from "@/generated/prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Yêu cầu đăng nhập quản trị viên." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const query = searchParams.get("q")?.trim();

    const db = getDb();

    const where: Prisma.ProjectProfileWhereInput = {};

    if (statusParam && Object.values(ProjectProfileStatus).includes(statusParam as ProjectProfileStatus)) {
      where.status = statusParam as ProjectProfileStatus;
    }

    if (query) {
      where.OR = [
        { idea: { title: { contains: query, mode: "insensitive" } } },
        { idea: { referenceCode: { contains: query, mode: "insensitive" } } },
        { idea: { submitter: { fullName: { contains: query, mode: "insensitive" } } } },
        { idea: { submitter: { studentCode: { contains: query, mode: "insensitive" } } } },
        { members: { some: { fullName: { contains: query, mode: "insensitive" } } } },
        { members: { some: { studentCode: { contains: query, mode: "insensitive" } } } },
      ];
    }

    const profiles = await db.projectProfile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        idea: {
          select: {
            id: true,
            referenceCode: true,
            title: true,
            status: true,
            submitter: {
              select: {
                fullName: true,
                studentCode: true,
                className: true,
                email: true,
              },
            },
          },
        },
        members: {
          select: {
            id: true,
            memberType: true,
            isLeader: true,
            fullName: true,
            studentCode: true,
            className: true,
            email: true,
          },
        },
        editRequests: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: profiles,
    });
  } catch (error: unknown) {
    console.error("[AdminProfilesGetError]", error);
    return NextResponse.json({ ok: false, error: "Lỗi khi lấy danh sách hồ sơ." }, { status: 500 });
  }
}
