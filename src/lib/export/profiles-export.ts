import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { Prisma, ProjectProfileStatus, MemberType } from "@/generated/prisma/client";
import { PROFILE_STATUS_LABELS } from "@/lib/domain/profile-state-machine";
import { ProfilesExportQuery } from "@/lib/validation/export-schema";
import {
  createStyledWorkbook,
  formatExcelDate,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  sanitizeExcelRow,
} from "./excel-utils";
import { AdminActorInfo } from "./ideas-export";

const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  STUDENT: "Sinh viên",
  ADVISOR: "Giảng viên hướng dẫn",
};

/**
 * Exports Project Profiles and Members matching server-side filters to a 2-sheet Excel workbook.
 * Performs explicit projection excluding any sensitive tokens or credentials.
 */
export async function exportProfilesToExcel(
  filters: ProfilesExportQuery,
  actor: AdminActorInfo
): Promise<ExcelJS.Workbook> {
  const db = getDb();
  const where: Prisma.ProjectProfileWhereInput = {};

  if (filters.status && Object.values(ProjectProfileStatus).includes(filters.status as ProjectProfileStatus)) {
    where.status = filters.status as ProjectProfileStatus;
  }

  if (filters.q) {
    where.OR = [
      { idea: { title: { contains: filters.q, mode: "insensitive" } } },
      { idea: { referenceCode: { contains: filters.q, mode: "insensitive" } } },
      { idea: { submitter: { fullName: { contains: filters.q, mode: "insensitive" } } } },
      { idea: { submitter: { studentCode: { contains: filters.q, mode: "insensitive" } } } },
      { members: { some: { fullName: { contains: filters.q, mode: "insensitive" } } } },
      { members: { some: { studentCode: { contains: filters.q, mode: "insensitive" } } } },
    ];
  }

  // Explicit projection: NO tokens, NO credentials, NO password hashes
  const profiles = await db.projectProfile.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      version: true,
      submittedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      idea: {
        select: {
          id: true,
          referenceCode: true,
          title: true,
          submitter: {
            select: {
              fullName: true,
              studentCode: true,
              className: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      members: {
        orderBy: [{ isLeader: "desc" }, { orderIndex: "asc" }],
        select: {
          id: true,
          memberType: true,
          isLeader: true,
          fullName: true,
          studentCode: true,
          className: true,
          email: true,
          phone: true,
          department: true,
        },
      },
    },
  });

  // Audit log
  console.info(
    `[ADMIN_AUDIT] actor:${actor.id} (${actor.email}) action:EXPORT_PROJECT_PROFILES count:${profiles.length} filters:${JSON.stringify(filters)} timestamp:${new Date().toISOString()}`
  );

  const workbook = createStyledWorkbook("Quản lý Hồ sơ Đề tài & Thành viên UTT");

  // ==================== SHEET 1: PROFILES ====================
  const sheetProfiles = workbook.addWorksheet("Ho_So_De_Tai");
  sheetProfiles.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã hồ sơ", key: "referenceCode", width: 16 },
    { header: "Tên đề tài / Ý tưởng", key: "title", width: 36 },
    { header: "Trạng thái hồ sơ", key: "status", width: 18 },
    { header: "Trưởng nhóm", key: "leaderName", width: 22 },
    { header: "MSSV Trưởng nhóm", key: "leaderStudentCode", width: 16 },
    { header: "Email Trưởng nhóm", key: "leaderEmail", width: 26 },
    { header: "Tổng số thành viên", key: "totalMembers", width: 18 },
    { header: "Số GVHD", key: "advisorCount", width: 14 },
    { header: "Ngày gửi hồ sơ", key: "submittedAt", width: 18 },
    { header: "Ngày hoàn thành", key: "completedAt", width: 18 },
    { header: "Cập nhật lần cuối", key: "updatedAt", width: 18 },
  ];

  profiles.forEach((p, idx) => {
    const leader = p.members.find((m) => m.isLeader) || p.members[0];
    const advisorCount = p.members.filter((m) => m.memberType === "ADVISOR").length;

    sheetProfiles.addRow(
      sanitizeExcelRow({
        stt: idx + 1,
        referenceCode: p.idea.referenceCode || p.idea.id,
        title: p.idea.title,
        status: PROFILE_STATUS_LABELS[p.status] || p.status,
        leaderName: leader?.fullName || p.idea.submitter.fullName,
        leaderStudentCode: leader?.studentCode || p.idea.submitter.studentCode,
        leaderEmail: leader?.email || p.idea.submitter.email,
        totalMembers: p.members.length,
        advisorCount,
        submittedAt: formatExcelDate(p.submittedAt),
        completedAt: formatExcelDate(p.completedAt),
        updatedAt: formatExcelDate(p.updatedAt),
      })
    );
  });

  const headerRowProfiles = sheetProfiles.getRow(1);
  styleHeaderRow(headerRowProfiles, "orange");
  styleDataRows(sheetProfiles);
  autoFitColumns(sheetProfiles, 10, 45);

  // ==================== SHEET 2: MEMBERS ====================
  const sheetMembers = workbook.addWorksheet("Thanh_Vien");
  sheetMembers.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã hồ sơ", key: "referenceCode", width: 16 },
    { header: "Tên đề tài", key: "title", width: 32 },
    { header: "Họ và tên thành viên", key: "fullName", width: 24 },
    { header: "Vai trò", key: "memberType", width: 22 },
    { header: "Trưởng nhóm", key: "isLeader", width: 14 },
    { header: "Mã sinh viên", key: "studentCode", width: 16 },
    { header: "Lớp", key: "className", width: 14 },
    { header: "Khoa / Đơn vị", key: "department", width: 22 },
    { header: "Email", key: "email", width: 26 },
    { header: "Số điện thoại", key: "phone", width: 16 },
  ];

  let memberStt = 1;
  profiles.forEach((p) => {
    p.members.forEach((m) => {
      sheetMembers.addRow(
        sanitizeExcelRow({
          stt: memberStt++,
          referenceCode: p.idea.referenceCode || p.idea.id,
          title: p.idea.title,
          fullName: m.fullName,
          memberType: MEMBER_TYPE_LABELS[m.memberType] || m.memberType,
          isLeader: m.isLeader ? "Có (Trưởng nhóm)" : "Không",
          studentCode: m.studentCode || "",
          className: m.className || "",
          department: m.department || "",
          email: m.email,
          phone: m.phone || "",
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
