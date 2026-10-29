import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { Prisma, IdeaStatus } from "@/generated/prisma/client";
import { STATUS_LABELS } from "@/lib/domain/idea-state-machine";
import { IdeasExportQuery } from "@/lib/validation/export-schema";
import {
  createStyledWorkbook,
  formatExcelDate,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  sanitizeExcelRow,
} from "./excel-utils";

export interface AdminActorInfo {
  id: string;
  email: string;
}

/**
 * Exports Ideas matching server-side filters to an Excel workbook.
 * Performs explicit projection excluding any sensitive tokens, hashes, or credentials.
 */
export async function exportIdeasToExcel(
  filters: IdeasExportQuery,
  actor: AdminActorInfo
): Promise<ExcelJS.Workbook> {
  const db = getDb();
  const where: Prisma.IdeaWhereInput = {};

  if (filters.status && Object.values(IdeaStatus).includes(filters.status as IdeaStatus)) {
    where.status = filters.status as IdeaStatus;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { referenceCode: { contains: filters.search, mode: "insensitive" } },
      { submitter: { fullName: { contains: filters.search, mode: "insensitive" } } },
      { submitter: { studentCode: { contains: filters.search, mode: "insensitive" } } },
      { submitter: { email: { contains: filters.search, mode: "insensitive" } } },
      { submitter: { className: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const order = filters.order || "desc";
  const orderBy: Prisma.IdeaOrderByWithRelationInput =
    filters.sort === "title"
      ? { title: order }
      : filters.sort === "updatedAt"
      ? { updatedAt: order }
      : { createdAt: order };

  // Explicit projection: NO tokens, NO credentials, NO password hashes
  const ideas = await db.idea.findMany({
    where,
    orderBy,
    select: {
      id: true,
      referenceCode: true,
      title: true,
      field: true,
      description: true,
      expectedProduct: true,
      necessity: true,
      innovation: true,
      feasibility: true,
      potential: true,
      needsMemberSupport: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      submitter: {
        select: {
          fullName: true,
          studentCode: true,
          className: true,
          major: true,
          phone: true,
          bankAccountNumber: true,
          bankName: true,
          bankBranch: true,
          email: true,
        },
      },
    },
  });

  // Audit log
  console.info(
    `[ADMIN_AUDIT] actor:${actor.id} (${actor.email}) action:EXPORT_IDEAS count:${ideas.length} filters:${JSON.stringify(filters)} timestamp:${new Date().toISOString()}`
  );

  const workbook = createStyledWorkbook("Danh sách Ý tưởng Sáng tạo UTT");
  const worksheet = workbook.addWorksheet("Danh_Sach_Y_Tuong");

  worksheet.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã hồ sơ", key: "referenceCode", width: 16 },
    { header: "Tên ý tưởng / Đề tài", key: "title", width: 36 },
    { header: "Trạng thái", key: "status", width: 20 },
    { header: "Họ và tên tác giả", key: "authorName", width: 24 },
    { header: "Mã CB / SV", key: "studentCode", width: 16 },
    { header: "Lĩnh vực nghiên cứu", key: "field", width: 28 },
    { header: "Số điện thoại", key: "phone", width: 16 },
    { header: "Email liên hệ", key: "email", width: 26 },
    { header: "Lớp", key: "className", width: 14 },
    { header: "Tên ngân hàng", key: "bankName", width: 20 },
    { header: "Số tài khoản NH", key: "bankAccountNumber", width: 20 },
    { header: "Chi nhánh NH", key: "bankBranch", width: 26 },
    { header: "Mô tả chi tiết", key: "description", width: 45 },
    { header: "Sản phẩm dự kiến", key: "expectedProduct", width: 35 },
    { header: "Tính cấp thiết", key: "necessity", width: 35 },
    { header: "Tính mới & sáng tạo", key: "innovation", width: 35 },
    { header: "Tính khả thi", key: "feasibility", width: 35 },
    { header: "Tiềm năng phát triển", key: "potential", width: 35 },
    { header: "Hỗ trợ thành viên Vòng 2", key: "needsMemberSupport", width: 24 },
    { header: "Ngày gửi hồ sơ", key: "submittedAt", width: 18 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
    { header: "Cập nhật lần cuối", key: "updatedAt", width: 18 },
  ];

  ideas.forEach((idea, idx) => {
    worksheet.addRow(
      sanitizeExcelRow({
        stt: idx + 1,
        referenceCode: idea.referenceCode || idea.id,
        title: idea.title,
        status: STATUS_LABELS[idea.status] || idea.status,
        authorName: idea.submitter.fullName,
        studentCode: idea.submitter.studentCode,
        field: idea.field || "",
        phone: idea.submitter.phone || "",
        email: idea.submitter.email,
        className: idea.submitter.className || "",
        bankName: idea.submitter.bankName || "",
        bankAccountNumber: idea.submitter.bankAccountNumber || "",
        bankBranch: idea.submitter.bankBranch || "",
        description: idea.description,
        expectedProduct: idea.expectedProduct || "",
        necessity: idea.necessity || "",
        innovation: idea.innovation || "",
        feasibility: idea.feasibility || "",
        potential: idea.potential || "",
        needsMemberSupport: idea.needsMemberSupport ? "Có" : "Không",
        submittedAt: formatExcelDate(idea.submittedAt),
        createdAt: formatExcelDate(idea.createdAt),
        updatedAt: formatExcelDate(idea.updatedAt),
      })
    );
  });

  const headerRow = worksheet.getRow(1);
  styleHeaderRow(headerRow, "orange");
  styleDataRows(worksheet);
  autoFitColumns(worksheet, 10, 50);

  return workbook;
}
