import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { Prisma, AwardStatus } from "@/generated/prisma/client";
import { AWARD_STATUS_LABELS } from "@/lib/domain/award-state-machine";
import { AwardsExportQuery } from "@/lib/validation/export-schema";
import {
  createStyledWorkbook,
  formatExcelDate,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  sanitizeExcelRow,
} from "./excel-utils";
import { AdminActorInfo } from "./ideas-export";

/**
 * Exports Awards and Honored Members matching server-side filters to a 2-sheet Excel workbook.
 * Explicitly displays isDemo flag to separate official awards from demo fixtures.
 */
export async function exportAwardsToExcel(
  filters: AwardsExportQuery,
  actor: AdminActorInfo
): Promise<ExcelJS.Workbook> {
  const db = getDb();
  const where: Prisma.AwardWhereInput = {};

  if (filters.status && Object.values(AwardStatus).includes(filters.status as AwardStatus)) {
    where.status = filters.status as AwardStatus;
  }

  if (filters.seasonId && filters.seasonId !== "ALL") {
    where.seasonId = filters.seasonId;
  }

  if (filters.isDemo === "true") {
    where.isDemo = true;
  } else if (filters.isDemo === "false") {
    where.isDemo = false;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { awardName: { contains: filters.q, mode: "insensitive" } },
      { category: { contains: filters.q, mode: "insensitive" } },
      { organization: { contains: filters.q, mode: "insensitive" } },
      { shortDescription: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const awards = await db.award.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      awardName: true,
      category: true,
      organization: true,
      shortDescription: true,
      description: true,
      displayOrder: true,
      status: true,
      isDemo: true,
      createdAt: true,
      updatedAt: true,
      season: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          year: true,
        },
      },
      members: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          className: true,
          role: true,
          department: true,
          displayOrder: true,
          isDemo: true,
        },
      },
    },
  });

  // Audit log
  console.info(
    `[ADMIN_AUDIT] actor:${actor.id} (${actor.email}) action:EXPORT_AWARDS count:${awards.length} filters:${JSON.stringify(filters)} timestamp:${new Date().toISOString()}`
  );

  const workbook = createStyledWorkbook("Sảnh Vinh Danh & Giải Thưởng Sáng Tạo UTT");

  // ==================== SHEET 1: AWARDS ====================
  const sheetAwards = workbook.addWorksheet("Giai_Thuong");
  sheetAwards.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mùa giải", key: "seasonName", width: 20 },
    { header: "Tên công trình / Đề tài", key: "title", width: 36 },
    { header: "Danh hiệu giải thưởng", key: "awardName", width: 22 },
    { header: "Lĩnh vực", key: "category", width: 24 },
    { header: "Đơn vị / Khoa viện", key: "organization", width: 24 },
    { header: "Trạng thái", key: "status", width: 16 },
    { header: "Phân loại dữ liệu", key: "isDemo", width: 22 },
    { header: "Thứ tự hiển thị", key: "displayOrder", width: 16 },
    { header: "Tóm tắt ngắn", key: "shortDescription", width: 40 },
    { header: "Mô tả chi tiết", key: "description", width: 45 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
  ];

  awards.forEach((a, idx) => {
    sheetAwards.addRow(
      sanitizeExcelRow({
        stt: idx + 1,
        seasonName: a.season.name,
        title: a.title,
        awardName: a.awardName,
        category: a.category || "",
        organization: a.organization || "",
        status: AWARD_STATUS_LABELS[a.status] || a.status,
        isDemo: a.isDemo ? "Dữ liệu minh họa (Demo)" : "Dữ liệu chính thức",
        displayOrder: a.displayOrder,
        shortDescription: a.shortDescription || "",
        description: a.description,
        createdAt: formatExcelDate(a.createdAt),
      })
    );
  });

  const headerRowAwards = sheetAwards.getRow(1);
  styleHeaderRow(headerRowAwards, "orange");
  styleDataRows(sheetAwards);
  autoFitColumns(sheetAwards, 10, 45);

  // ==================== SHEET 2: MEMBERS ====================
  const sheetMembers = workbook.addWorksheet("Thanh_Vien_Vinh_Danh");
  sheetMembers.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Tên công trình / Đề tài", key: "awardTitle", width: 32 },
    { header: "Mùa giải", key: "seasonName", width: 20 },
    { header: "Họ và tên thành viên", key: "fullName", width: 24 },
    { header: "Vai trò", key: "role", width: 18 },
    { header: "Mã sinh viên", key: "studentCode", width: 16 },
    { header: "Lớp", key: "className", width: 14 },
    { header: "Khoa / Đơn vị", key: "department", width: 22 },
    { header: "Phân loại dữ liệu", key: "isDemo", width: 22 },
  ];

  let memberStt = 1;
  awards.forEach((a) => {
    a.members.forEach((m) => {
      sheetMembers.addRow(
        sanitizeExcelRow({
          stt: memberStt++,
          awardTitle: a.title,
          seasonName: a.season.name,
          fullName: m.fullName,
          role: m.role || "Thành viên",
          studentCode: m.studentCode || "",
          className: m.className || "",
          department: m.department || "",
          isDemo: m.isDemo || a.isDemo ? "Dữ liệu minh họa (Demo)" : "Dữ liệu chính thức",
        })
      );
    });
  });

  const headerRowMembers = sheetMembers.getRow(1);
  styleHeaderRow(headerRowMembers, "slate");
  styleDataRows(sheetMembers);
  autoFitColumns(sheetMembers, 10, 45);

  return workbook;
}
