import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { ideaResubmissionSchema } from "@/lib/validation/idea-schema";
import {
  IdeaStatus,
  assertValidTransition,
  ConcurrencyConflictError,
  InvalidStateTransitionError,
  STATUS_LABELS,
} from "@/lib/domain/idea-state-machine";
import { triggerGoogleSheetsAutoSync } from "@/lib/google-sheets/sync-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu yêu cầu không hợp lệ." },
        { status: 400 },
      );
    }

    const authHeader = req.headers.get("authorization");
    const tokenHeader = req.headers.get("x-lookup-token");
    const rawToken =
      tokenHeader ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null) ||
      body.lookupToken;

    if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Yêu cầu mã tra cứu (lookup token) hợp lệ để thực hiện chỉnh sửa.",
        },
        { status: 401 },
      );
    }

    const db = getDb();
    const tokenHash = hashToken(rawToken.trim());

    // 1. Strict Server-Side Authentication & Lookup Credential Verification
    const credential = await db.lookupCredential.findUnique({
      where: { tokenHash },
      include: {
        submitter: true,
      },
    });

    if (!credential || !credential.submitter || credential.revokedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Liên kết tra cứu không hợp lệ, không tồn tại hoặc đã bị thu hồi.",
        },
        { status: 401 },
      );
    }

    // 2. Validate payload with Zod schema
    const parsed = ideaResubmissionSchema.safeParse({
      ...body,
      lookupToken: rawToken.trim(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Dữ liệu chỉnh sửa không hợp lệ. Vui lòng kiểm tra lại các trường.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 3. Find Idea and verify existence
    const idea = await db.idea.findUnique({
      where: { id: ideaId },
    });

    if (!idea) {
      return NextResponse.json(
        { ok: false, error: "Hồ sơ ý tưởng không tồn tại trong hệ thống." },
        { status: 404 },
      );
    }

    // 4. IDOR Guard: Verify Idea ownership
    if (idea.submitterId !== credential.submitter.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bạn không có quyền chỉnh sửa hồ sơ ý tưởng này.",
        },
        { status: 403 },
      );
    }

    // 5. State Machine Guard: Only NEEDS_REVISION is editable by submitter
    if (idea.status !== IdeaStatus.NEEDS_REVISION) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ý tưởng đang ở trạng thái "${
            STATUS_LABELS[idea.status as keyof typeof STATUS_LABELS] || idea.status
          }", không được phép chỉnh sửa.`,
        },
        { status: 400 },
      );
    }

    // 6. Assert valid state transition
    try {
      assertValidTransition(idea.status, IdeaStatus.SUBMITTED);
    } catch (err) {
      if (err instanceof InvalidStateTransitionError) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      }
      throw err;
    }

    const updatedData = parsed.data;

    // 7. Transactional update with Optimistic Concurrency Control
    await db.$transaction(async (tx) => {
      // Optimistic concurrency check: match current status and version
      const updateResult = await tx.idea.updateMany({
        where: {
          id: idea.id,
          status: IdeaStatus.NEEDS_REVISION,
          version: idea.version,
        },
        data: {
          title: updatedData.title.trim(),
          field: updatedData.field.trim(),
          description: updatedData.description.trim(),
          expectedProduct: updatedData.expectedProduct.trim(),
          necessity: updatedData.necessity.trim(),
          innovation: updatedData.innovation.trim(),
          feasibility: updatedData.feasibility.trim(),
          potential: updatedData.potential.trim(),
          needsMemberSupport: updatedData.needsMemberSupport,
          status: IdeaStatus.SUBMITTED,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConcurrencyConflictError(
          "Hồ sơ ý tưởng đã được cập nhật bởi một phiên làm việc khác. Vui lòng tải lại trang.",
        );
      }

      // Update Submitter contact and banking information (email is immutable)
      await tx.submitter.update({
        where: { id: credential.submitter.id },
        data: {
          fullName: updatedData.fullName.trim(),
          studentCode: updatedData.studentCode.trim().toUpperCase(),
          className: updatedData.className ? updatedData.className.trim() : null,
          phone: updatedData.phone.trim(),
          bankAccountNumber: updatedData.bankAccountNumber.trim(),
          bankName: updatedData.bankName.trim(),
          bankBranch: updatedData.bankBranch ? updatedData.bankBranch.trim() : null,
        },
      });

      // Append new Status History entry (preserving previous history)
      const oldTitle = idea.title.trim();
      const newTitle = updatedData.title.trim();
      const titleChangedNote =
        oldTitle !== newTitle
          ? ` (Đã cập nhật tên đề tài mới: "${newTitle}")`
          : "";

      await tx.ideaStatusHistory.create({
        data: {
          ideaId: idea.id,
          actorType: "SYSTEM",
          oldStatus: IdeaStatus.NEEDS_REVISION,
          newStatus: IdeaStatus.SUBMITTED,
          reason: `Người gửi đã hoàn thiện và gửi lại hồ sơ ý tưởng theo yêu cầu của Ban tổ chức${titleChangedNote}.`,
        },
      });
    });

    triggerGoogleSheetsAutoSync("idea:resubmit");

    return NextResponse.json({
      ok: true,
      message:
        "Hồ sơ ý tưởng đã được cập nhật và gửi lại thành công! Trạng thái hồ sơ đã chuyển sang Đã gửi.",
      data: {
        id: idea.id,
        referenceCode: idea.referenceCode,
        title: updatedData.title.trim(),
        status: IdeaStatus.SUBMITTED,
      },
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hồ sơ ý tưởng đã được cập nhật bởi một phiên làm việc khác. Vui lòng tải lại trang.",
        },
        { status: 409 },
      );
    }

    console.error("[IdeaResubmissionError]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        ok: false,
        error: "Đã xảy ra lỗi hệ thống khi gửi lại ý tưởng. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}
