import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { Prisma, TaskStatus } from "@/generated/prisma/client";
import {
  TASK_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
} from "@/lib/domain/task-state-machine";
import { TasksExportQuery } from "@/lib/validation/export-schema";
import {
  createStyledWorkbook,
  formatExcelDate,
  formatExcelDateOnly,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  sanitizeExcelRow,
} from "./excel-utils";
import { AdminActorInfo } from "./ideas-export";

/**
 * Exports Tasks and Applications matching server-side filters to a 2-sheet Excel workbook.
 * Performs explicit projection excluding any sensitive OTP tokens, hashes, or credentials.
 */
export async function exportTasksToExcel(
  filters: TasksExportQuery,
  actor: AdminActorInfo
): Promise<ExcelJS.Workbook> {
  const db = getDb();
  const where: Prisma.TaskWhereInput = {};

  if (filters.status && Object.values(TaskStatus).includes(filters.status as TaskStatus)) {
    where.status = filters.status as TaskStatus;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { orderingOrganization: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  // Explicit projection: NO OTP hashes, NO tokens
  const tasks = await db.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      requirements: true,
      orderingOrganization: true,
      reward: true,
      category: true,
      applicationDeadline: true,
      executionDeadline: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      applications: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          proposal: true,
          submittedAt: true,
          selectedAt: true,
          adminFeedback: true,
          createdAt: true,
          submitter: {
            select: {
              fullName: true,
              email: true,
              studentCode: true,
            },
          },
          members: {
            orderBy: [{ isLeader: "desc" }, { orderIndex: "asc" }],
            select: {
              id: true,
              fullName: true,
              email: true,
              studentCode: true,
              className: true,
              phone: true,
              isLeader: true,
              memberType: true,
            },
          },
        },
      },
    },
  });

  // Audit log
  console.info(
    `[ADMIN_AUDIT] actor:${actor.id} (${actor.email}) action:EXPORT_TASKS count:${tasks.length} filters:${JSON.stringify(filters)} timestamp:${new Date().toISOString()}`
  );

  const workbook = createStyledWorkbook("Quản lý Nhiệm vụ Đặt hàng UTT");

  // ==================== SHEET 1: TASKS ====================
  const sheetTasks = workbook.addWorksheet("Nhiem_Vu");
  sheetTasks.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã nhiệm vụ", key: "id", width: 25 },
    { header: "Tên nhiệm vụ", key: "title", width: 36 },
    { header: "Slug đường dẫn", key: "slug", width: 25 },
    { header: "Đơn vị đặt hàng", key: "orderingOrganization", width: 28 },
    { header: "Lĩnh vực", key: "category", width: 20 },
    { header: "Kinh phí / Phần thưởng", key: "reward", width: 22 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Hạn nộp hồ sơ", key: "applicationDeadline", width: 16 },
    { header: "Hạn hoàn thành", key: "executionDeadline", width: 16 },
    { header: "Số lượng ứng tuyển", key: "applicationCount", width: 18 },
    { header: "Nhóm được chọn", key: "selectedGroup", width: 25 },
    { header: "Yêu cầu năng lực", key: "requirements", width: 40 },
    { header: "Mô tả chi tiết", key: "description", width: 45 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
  ];

  tasks.forEach((t, idx) => {
    const selectedApp = t.applications.find((a) => a.status === "SELECTED");
    const selectedLeader =
      selectedApp?.members.find((m) => m.isLeader) || selectedApp?.submitter;

    sheetTasks.addRow(
      sanitizeExcelRow({
        stt: idx + 1,
        id: t.id,
        title: t.title,
        slug: t.slug,
        orderingOrganization: t.orderingOrganization,
        category: t.category || "",
        reward: t.reward || "",
        status: TASK_STATUS_LABELS[t.status] || t.status,
        applicationDeadline: formatExcelDateOnly(t.applicationDeadline),
        executionDeadline: formatExcelDateOnly(t.executionDeadline),
        applicationCount: t.applications.length,
        selectedGroup: selectedLeader ? selectedLeader.fullName : "Chưa chọn",
        requirements: t.requirements || "",
        description: t.description,
        createdAt: formatExcelDate(t.createdAt),
      })
    );
  });

  const headerRowTasks = sheetTasks.getRow(1);
  styleHeaderRow(headerRowTasks, "orange");
  styleDataRows(sheetTasks);
  autoFitColumns(sheetTasks, 10, 45);

  // ==================== SHEET 2: APPLICATIONS ====================
  const sheetApps = workbook.addWorksheet("Danh_Sach_Ung_Tuyen");
  sheetApps.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Tên nhiệm vụ", key: "taskTitle", width: 32 },
    { header: "Đơn vị đặt hàng", key: "orderingOrganization", width: 24 },
    { header: "Mã ứng tuyển", key: "appId", width: 25 },
    { header: "Trạng thái ứng tuyển", key: "status", width: 22 },
    { header: "Trưởng nhóm ứng tuyển", key: "leaderName", width: 24 },
    { header: "MSSV Trưởng nhóm", key: "leaderStudentCode", width: 18 },
    { header: "Email Trưởng nhóm", key: "leaderEmail", width: 26 },
    { header: "Số thành viên nhóm", key: "memberCount", width: 18 },
    { header: "Tóm tắt đề xuất", key: "proposal", width: 45 },
    { header: "Ngày nộp", key: "submittedAt", width: 18 },
    { header: "Ngày được chọn", key: "selectedAt", width: 18 },
    { header: "Phản hồi quản trị", key: "adminFeedback", width: 30 },
  ];

  let appStt = 1;
  tasks.forEach((t) => {
    t.applications.forEach((a) => {
      const leader = a.members.find((m) => m.isLeader) || a.submitter;

      sheetApps.addRow(
        sanitizeExcelRow({
          stt: appStt++,
          taskTitle: t.title,
          orderingOrganization: t.orderingOrganization,
          appId: a.id,
          status: APPLICATION_STATUS_LABELS[a.status] || a.status,
          leaderName: leader.fullName,
          leaderStudentCode: leader.studentCode || "",
          leaderEmail: leader.email,
          memberCount: a.members.length,
          proposal: a.proposal,
          submittedAt: formatExcelDate(a.submittedAt || a.createdAt),
          selectedAt: formatExcelDate(a.selectedAt),
          adminFeedback: a.adminFeedback || "",
        })
      );
    });
  });

  const headerRowApps = sheetApps.getRow(1);
  styleHeaderRow(headerRowApps, "slate");
  styleDataRows(sheetApps);
  autoFitColumns(sheetApps, 10, 45);

  return workbook;
}
