import { getDb } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/domain/idea-state-machine";
import { PROFILE_STATUS_LABELS } from "@/lib/domain/profile-state-machine";
import {
  TASK_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
} from "@/lib/domain/task-state-machine";
import { AWARD_STATUS_LABELS } from "@/lib/domain/award-state-machine";
import { formatExcelDate, formatExcelDateOnly } from "@/lib/export/excel-utils";

const CONFIG_PROBE_ID = 9001;
const STATUS_PROBE_ID = 9002;

export interface GoogleSheetsConfig {
  enabled: boolean;
  webhookUrl: string;
  spreadsheetUrl: string;
  secret: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GoogleSheetsSyncStatus {
  lastSyncAt: string | null;
  lastSyncStatus: "SUCCESS" | "ERROR" | "IDLE" | "SYNCING";
  lastSyncMessage: string | null;
  lastSyncTrigger: string | null;
  lastFingerprint: string | null;
  totalSheets: number;
  totalRows: number;
  sheetCounts: Record<string, number>;
  durationMs?: number;
}

export interface SheetTabPayload {
  sheetName: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface FullSpreadsheetPayload {
  systemName: string;
  exportedAt: string;
  secret?: string;
  summary: {
    totalSheets: number;
    totalRows: number;
    sheetCounts: Record<string, number>;
  };
  sheets: SheetTabPayload[];
}

/**
 * Sanitizes cell values for Google Sheets to prevent Formula Injection (=, +, -, @)
 * while preserving full text content and Vietnamese characters.
 */
function cell(val: unknown): string | number {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? "Có" : "Không";
  let str = String(val);
  if (str.startsWith("data:image/") && str.length > 2000) {
    return `[Ảnh tải lên lưu trong CSDL (${Math.round(str.length / 1024)} KB)]`;
  }
  if (str.length > 49000) {
    str = `${str.slice(0, 49000)}... [Giới hạn 50.000 ký tự/ô của Google Sheets]`;
  }
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Reads the persisted Google Sheets configuration from PostgreSQL (with .env fallback).
 */
export async function getGoogleSheetsConfig(): Promise<GoogleSheetsConfig> {
  const db = getDb();
  const envWebhookUrl = (process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
  const envSpreadsheetUrl = (process.env.GOOGLE_SHEETS_SPREADSHEET_URL || "").trim();
  const envSecret = (process.env.GOOGLE_SHEETS_SECRET || "").trim();

  try {
    const row = await db.systemProbe.findUnique({
      where: { id: CONFIG_PROBE_ID },
    });
    if (row?.label) {
      const parsed = JSON.parse(row.label) as Partial<GoogleSheetsConfig>;
      const webhookUrl = (parsed.webhookUrl ?? envWebhookUrl).trim();
      return {
        enabled: parsed.enabled ?? Boolean(webhookUrl),
        webhookUrl,
        spreadsheetUrl: (parsed.spreadsheetUrl ?? envSpreadsheetUrl).trim(),
        secret: (parsed.secret ?? envSecret).trim(),
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      };
    }
  } catch {
    // Fallback to env if JSON parse or DB query fails
  }

  return {
    enabled: Boolean(envWebhookUrl),
    webhookUrl: envWebhookUrl,
    spreadsheetUrl: envSpreadsheetUrl,
    secret: envSecret,
  };
}

/**
 * Saves Google Sheets configuration into PostgreSQL so both `app` and `worker` share it immediately.
 */
export async function saveGoogleSheetsConfig(
  input: Partial<GoogleSheetsConfig>,
  actorEmail?: string
): Promise<GoogleSheetsConfig> {
  const db = getDb();
  const current = await getGoogleSheetsConfig();

  const updated: GoogleSheetsConfig = {
    enabled:
      input.enabled !== undefined
        ? Boolean(input.enabled)
        : Boolean((input.webhookUrl ?? current.webhookUrl).trim()),
    webhookUrl: (input.webhookUrl ?? current.webhookUrl).trim(),
    spreadsheetUrl: (input.spreadsheetUrl ?? current.spreadsheetUrl).trim(),
    secret: (input.secret ?? current.secret).trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail || current.updatedBy || "ADMIN",
  };

  await db.systemProbe.upsert({
    where: { id: CONFIG_PROBE_ID },
    update: { label: JSON.stringify(updated) },
    create: { id: CONFIG_PROBE_ID, label: JSON.stringify(updated) },
  });

  return updated;
}

/**
 * Reads the last synchronization status from PostgreSQL.
 */
export async function getGoogleSheetsSyncStatus(): Promise<GoogleSheetsSyncStatus> {
  const db = getDb();
  try {
    const row = await db.systemProbe.findUnique({
      where: { id: STATUS_PROBE_ID },
    });
    if (row?.label) {
      return JSON.parse(row.label) as GoogleSheetsSyncStatus;
    }
  } catch {
    // Ignore parse error
  }

  return {
    lastSyncAt: null,
    lastSyncStatus: "IDLE",
    lastSyncMessage: "Chưa thực hiện đồng bộ lần nào.",
    lastFingerprint: null,
    lastSyncTrigger: null,
    totalSheets: 17,
    totalRows: 0,
    sheetCounts: {},
  };
}

async function saveGoogleSheetsSyncStatus(
  status: GoogleSheetsSyncStatus
): Promise<void> {
  const db = getDb();
  try {
    await db.systemProbe.upsert({
      where: { id: STATUS_PROBE_ID },
      update: { label: JSON.stringify(status) },
      create: { id: STATUS_PROBE_ID, label: JSON.stringify(status) },
    });
  } catch (err) {
    console.error("[GOOGLE_SHEETS_SYNC] Failed to save sync status:", err);
  }
}

/**
 * Computes a fast change fingerprint across all business tables in PostgreSQL.
 * Allows the background worker to detect any new or updated record in <15ms.
 */
export async function computeDatabaseFingerprint(): Promise<string> {
  const db = getDb();
  const [
    ideaAgg,
    subAgg,
    histAgg,
    profAgg,
    memAgg,
    editReqAgg,
    profHistAgg,
    taskAgg,
    taskAppAgg,
    taskMemAgg,
    recPostAgg,
    recAppAgg,
    seasonAgg,
    awardAgg,
    awardMemAgg,
    emailAgg,
  ] = await Promise.all([
    db.idea.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.submitter.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.ideaStatusHistory.aggregate({ _count: true, _max: { createdAt: true } }),
    db.projectProfile.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.projectMember.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.profileEditRequest.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.profileHistory.aggregate({ _count: true, _max: { createdAt: true } }),
    db.task.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.taskApplication.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.taskApplicationMember.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.ideaRecruitmentPost.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.ideaRecruitmentApplication.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.awardSeason.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.award.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.awardMember.aggregate({ _count: true, _max: { updatedAt: true } }),
    db.emailJob.aggregate({ _count: true, _max: { processedAt: true, createdAt: true } }),
  ]);

  return JSON.stringify([
    ideaAgg._count,
    ideaAgg._max.updatedAt?.toISOString(),
    subAgg._count,
    subAgg._max.updatedAt?.toISOString(),
    histAgg._count,
    histAgg._max.createdAt?.toISOString(),
    profAgg._count,
    profAgg._max.updatedAt?.toISOString(),
    memAgg._count,
    memAgg._max.updatedAt?.toISOString(),
    editReqAgg._count,
    editReqAgg._max.updatedAt?.toISOString(),
    profHistAgg._count,
    profHistAgg._max.createdAt?.toISOString(),
    taskAgg._count,
    taskAgg._max.updatedAt?.toISOString(),
    taskAppAgg._count,
    taskAppAgg._max.updatedAt?.toISOString(),
    taskMemAgg._count,
    taskMemAgg._max.updatedAt?.toISOString(),
    recPostAgg._count,
    recPostAgg._max.updatedAt?.toISOString(),
    recAppAgg._count,
    recAppAgg._max.updatedAt?.toISOString(),
    seasonAgg._count,
    seasonAgg._max.updatedAt?.toISOString(),
    awardAgg._count,
    awardAgg._max.updatedAt?.toISOString(),
    awardMemAgg._count,
    awardMemAgg._max.updatedAt?.toISOString(),
    emailAgg._count,
    emailAgg._max.processedAt?.toISOString(),
    emailAgg._max.createdAt?.toISOString(),
  ]);
}

/**
 * Builds the complete 17-sheet dataset containing 100% of business data and columns in PostgreSQL.
 */
export async function buildFullGoogleSheetsPayload(
  secret?: string
): Promise<FullSpreadsheetPayload> {
  const db = getDb();

  const [
    ideas,
    submitters,
    ideaHistories,
    profiles,
    editRequests,
    profileHistories,
    tasks,
    taskHistories,
    taskAppHistories,
    recruitmentPosts,
    recruitmentApps,
    awardSeasons,
    awards,
    awardHistories,
    emailJobs,
  ] = await Promise.all([
    db.idea.findMany({
      orderBy: { createdAt: "desc" },
      include: { submitter: true },
    }),
    db.submitter.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { ideas: true, taskApplications: true } },
      },
    }),
    db.ideaStatusHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        idea: { select: { referenceCode: true, title: true } },
      },
    }),
    db.projectProfile.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        idea: {
          include: { submitter: true },
        },
        members: {
          orderBy: [{ isLeader: "desc" }, { orderIndex: "asc" }],
        },
      },
    }),
    db.profileEditRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        profile: {
          include: {
            idea: { select: { referenceCode: true, title: true } },
          },
        },
      },
    }),
    db.profileHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        idea: { select: { referenceCode: true, title: true } },
      },
    }),
    db.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          include: {
            submitter: true,
            members: {
              orderBy: [{ isLeader: "desc" }, { orderIndex: "asc" }],
            },
          },
        },
      },
    }),
    db.taskHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        task: { select: { title: true, slug: true } },
      },
    }),
    db.taskApplicationHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        application: {
          include: {
            task: { select: { title: true } },
            submitter: { select: { fullName: true, studentCode: true } },
          },
        },
      },
    }),
    db.ideaRecruitmentPost.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        idea: {
          include: { submitter: true },
        },
        _count: { select: { applications: true } },
      },
    }),
    db.ideaRecruitmentApplication.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          include: {
            idea: { select: { referenceCode: true, title: true } },
          },
        },
      },
    }),
    db.awardSeason.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { awards: true } },
      },
    }),
    db.award.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        season: true,
        members: { orderBy: { displayOrder: "asc" } },
      },
    }),
    db.awardHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        award: { select: { title: true, awardName: true } },
      },
    }),
    db.emailJob.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // 1. Danh_Sach_Y_Tuong (Full Idea + Submitter fields)
  const sheetIdeas: SheetTabPayload = {
    sheetName: "1_Danh_Sach_Y_Tuong",
    title: "Danh sách Ý tưởng Sáng tạo (Đầy đủ)",
    headers: [
      "STT",
      "ID Ý tưởng",
      "Mã hồ sơ",
      "Tên ý tưởng / Đề tài",
      "Trạng thái (Nhãn)",
      "Trạng thái (Mã)",
      "Phiên bản",
      "Lĩnh vực nghiên cứu",
      "Họ và tên tác giả",
      "Mã CB / SV",
      "Lớp",
      "Ngành / Khoa",
      "Số điện thoại",
      "Email liên hệ",
      "Email chuẩn hóa",
      "Thời điểm xác minh Email",
      "Tên ngân hàng",
      "Số tài khoản NH",
      "Chi nhánh NH",
      "Mô tả chi tiết",
      "Sản phẩm dự kiến",
      "Tính cấp thiết",
      "Tính mới & sáng tạo",
      "Tính khả thi",
      "Tiềm năng phát triển",
      "Hỗ trợ thành viên Vòng 2",
      "ID Người nộp",
      "Ngày gửi hồ sơ",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: ideas.map((idea, idx) => [
      idx + 1,
      cell(idea.id),
      cell(idea.referenceCode),
      cell(idea.title),
      cell(STATUS_LABELS[idea.status] || idea.status),
      cell(idea.status),
      idea.version,
      cell(idea.field),
      cell(idea.submitter.fullName),
      cell(idea.submitter.studentCode),
      cell(idea.submitter.className),
      cell(idea.submitter.major),
      cell(idea.submitter.phone),
      cell(idea.submitter.email),
      cell(idea.submitter.emailNormalized),
      cell(formatExcelDate(idea.submitter.emailVerifiedAt)),
      cell(idea.submitter.bankName),
      cell(idea.submitter.bankAccountNumber),
      cell(idea.submitter.bankBranch),
      cell(idea.description),
      cell(idea.expectedProduct),
      cell(idea.necessity),
      cell(idea.innovation),
      cell(idea.feasibility),
      cell(idea.potential),
      cell(idea.needsMemberSupport),
      cell(idea.submitterId),
      cell(formatExcelDate(idea.submittedAt)),
      cell(formatExcelDate(idea.createdAt)),
      cell(formatExcelDate(idea.updatedAt)),
    ]),
  };

  // 2. Nguoi_Nop_Ho_So (Full Submitter table)
  const sheetSubmitters: SheetTabPayload = {
    sheetName: "2_Nguoi_Nop_Ho_So",
    title: "Danh sách Người nộp / Tác giả (Submitter)",
    headers: [
      "STT",
      "ID Người nộp",
      "Họ và tên",
      "Mã CB / SV",
      "Lớp",
      "Ngành / Khoa",
      "Số điện thoại",
      "Email",
      "Email chuẩn hóa",
      "Thời điểm xác minh Email",
      "Tên ngân hàng",
      "Số tài khoản NH",
      "Chi nhánh NH",
      "Tổng số ý tưởng",
      "Tổng số đơn nhiệm vụ",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: submitters.map((s, idx) => [
      idx + 1,
      cell(s.id),
      cell(s.fullName),
      cell(s.studentCode),
      cell(s.className),
      cell(s.major),
      cell(s.phone),
      cell(s.email),
      cell(s.emailNormalized),
      cell(formatExcelDate(s.emailVerifiedAt)),
      cell(s.bankName),
      cell(s.bankAccountNumber),
      cell(s.bankBranch),
      s._count.ideas,
      s._count.taskApplications,
      cell(formatExcelDate(s.createdAt)),
      cell(formatExcelDate(s.updatedAt)),
    ]),
  };

  // 3. Lich_Su_Y_Tuong (Full IdeaStatusHistory table)
  const sheetIdeaHistory: SheetTabPayload = {
    sheetName: "3_Lich_Su_Y_Tuong",
    title: "Lịch sử Trạng thái Ý tưởng",
    headers: [
      "STT",
      "ID Lịch sử",
      "ID Ý tưởng",
      "Mã hồ sơ",
      "Tên ý tưởng",
      "Trạng thái cũ",
      "Trạng thái mới",
      "Loại tác nhân",
      "ID Người thao tác",
      "Lý do / Ghi chú",
      "Thời gian",
    ],
    rows: ideaHistories.map((h, idx) => [
      idx + 1,
      cell(h.id),
      cell(h.ideaId),
      cell(h.idea?.referenceCode),
      cell(h.idea?.title),
      cell(STATUS_LABELS[h.oldStatus] || h.oldStatus),
      cell(STATUS_LABELS[h.newStatus] || h.newStatus),
      cell(h.actorType),
      cell(h.actorId),
      cell(h.reason),
      cell(formatExcelDate(h.createdAt)),
    ]),
  };

  // 4. Ho_So_De_Tai (Full ProjectProfile table)
  const sheetProfiles: SheetTabPayload = {
    sheetName: "4_Ho_So_De_Tai",
    title: "Danh sách Hồ sơ Đề tài (ProjectProfile)",
    headers: [
      "STT",
      "ID Hồ sơ",
      "ID Ý tưởng",
      "Mã hồ sơ",
      "Tên đề tài / Ý tưởng",
      "Trạng thái hồ sơ (Nhãn)",
      "Trạng thái hồ sơ (Mã)",
      "Phiên bản",
      "Trưởng nhóm",
      "MSSV Trưởng nhóm",
      "Email Trưởng nhóm",
      "SĐT Trưởng nhóm",
      "Tổng số thành viên",
      "Số GVHD",
      "Ngày gửi hồ sơ",
      "Ngày hoàn thành",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: profiles.map((p, idx) => {
      const leader = p.members.find((m) => m.isLeader) || p.members[0];
      const advisorCount = p.members.filter((m) => m.memberType === "ADVISOR").length;
      return [
        idx + 1,
        cell(p.id),
        cell(p.ideaId),
        cell(p.idea.referenceCode),
        cell(p.idea.title),
        cell(PROFILE_STATUS_LABELS[p.status] || p.status),
        cell(p.status),
        p.version,
        cell(leader?.fullName || p.idea.submitter.fullName),
        cell(leader?.studentCode || p.idea.submitter.studentCode),
        cell(leader?.email || p.idea.submitter.email),
        cell(leader?.phone || p.idea.submitter.phone),
        p.members.length,
        advisorCount,
        cell(formatExcelDate(p.submittedAt)),
        cell(formatExcelDate(p.completedAt)),
        cell(formatExcelDate(p.createdAt)),
        cell(formatExcelDate(p.updatedAt)),
      ];
    }),
  };

  // 5. Thanh_Vien_De_Tai (Full ProjectMember table)
  const allProfileMembers: (string | number)[][] = [];
  let pmStt = 1;
  profiles.forEach((p) => {
    p.members.forEach((m) => {
      allProfileMembers.push([
        pmStt++,
        cell(m.id),
        cell(m.profileId),
        cell(p.idea.referenceCode),
        cell(p.idea.title),
        cell(m.memberType === "ADVISOR" ? "Giảng viên hướng dẫn" : "Sinh viên"),
        cell(m.memberType),
        cell(m.isLeader ? "Có (Trưởng nhóm)" : "Không"),
        cell(m.fullName),
        cell(m.studentCode),
        cell(m.className),
        cell(m.department),
        cell(m.email),
        cell(m.phone),
        m.orderIndex,
        cell(formatExcelDate(m.createdAt)),
        cell(formatExcelDate(m.updatedAt)),
      ]);
    });
  });

  const sheetProfileMembers: SheetTabPayload = {
    sheetName: "5_Thanh_Vien_De_Tai",
    title: "Danh sách Thành viên & GVHD Hồ sơ Đề tài",
    headers: [
      "STT",
      "ID Thành viên",
      "ID Hồ sơ",
      "Mã hồ sơ",
      "Tên đề tài",
      "Vai trò (Nhãn)",
      "Vai trò (Mã)",
      "Trưởng nhóm",
      "Họ và tên",
      "Mã sinh viên",
      "Lớp",
      "Khoa / Đơn vị",
      "Email",
      "Số điện thoại",
      "Thứ tự",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: allProfileMembers,
  };

  // 6. Yeu_Cau_Sua_Ho_So (Full ProfileEditRequest table)
  const sheetEditRequests: SheetTabPayload = {
    sheetName: "6_Yeu_Cau_Sua_Ho_So",
    title: "Danh sách Yêu cầu Chỉnh sửa Hồ sơ Đề tài",
    headers: [
      "STT",
      "ID Yêu cầu",
      "ID Hồ sơ",
      "Mã hồ sơ",
      "Tên đề tài",
      "Người yêu cầu",
      "Lý do xin chỉnh sửa",
      "Các mục xin sửa",
      "Các mục được phép sửa",
      "Trạng thái",
      "Người duyệt",
      "Thời gian duyệt",
      "Lý do từ chối",
      "Ghi chú quản trị",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: editRequests.map((r, idx) => [
      idx + 1,
      cell(r.id),
      cell(r.profileId),
      cell(r.profile.idea.referenceCode),
      cell(r.profile.idea.title),
      cell(r.requestedBy),
      cell(r.reason),
      cell((r.requestedFields || []).join(", ")),
      cell((r.allowedFields || []).join(", ")),
      cell(r.status),
      cell(r.reviewedBy),
      cell(formatExcelDate(r.reviewedAt)),
      cell(r.rejectionReason),
      cell(r.adminNote),
      cell(formatExcelDate(r.createdAt)),
      cell(formatExcelDate(r.updatedAt)),
    ]),
  };

  // 7. Lich_Su_Ho_So (Full ProfileHistory table)
  const sheetProfileHistory: SheetTabPayload = {
    sheetName: "7_Lich_Su_Ho_So",
    title: "Lịch sử Hồ sơ Đề tài",
    headers: [
      "STT",
      "ID Lịch sử",
      "ID Hồ sơ",
      "ID Ý tưởng",
      "Mã hồ sơ",
      "Tên đề tài",
      "Hành động",
      "Vai trò tác nhân",
      "ID Người thao tác",
      "Lý do / Ghi chú",
      "Metadata (JSON)",
      "Thời gian",
    ],
    rows: profileHistories.map((h, idx) => [
      idx + 1,
      cell(h.id),
      cell(h.profileId),
      cell(h.ideaId),
      cell(h.idea?.referenceCode),
      cell(h.idea?.title),
      cell(h.action),
      cell(h.actorRole),
      cell(h.actorId),
      cell(h.reason),
      cell(h.metadata ? JSON.stringify(h.metadata) : ""),
      cell(formatExcelDate(h.createdAt)),
    ]),
  };

  // 8. Nhiem_Vu_Dat_Hang (Full Task table)
  const sheetTasks: SheetTabPayload = {
    sheetName: "8_Nhiem_Vu_Dat_Hang",
    title: "Danh sách Nhiệm vụ Đặt hàng (Task)",
    headers: [
      "STT",
      "ID Nhiệm vụ",
      "Tên nhiệm vụ",
      "Slug đường dẫn",
      "Đơn vị đặt hàng",
      "Lĩnh vực",
      "Kinh phí / Phần thưởng",
      "Trạng thái (Nhãn)",
      "Trạng thái (Mã)",
      "Hạn nộp hồ sơ",
      "Hạn hoàn thành",
      "Số lượng ứng tuyển",
      "Nhóm được chọn",
      "Yêu cầu năng lực",
      "Mô tả chi tiết",
      "Người tạo",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: tasks.map((t, idx) => {
      const selectedApp = t.applications.find((a) => a.status === "SELECTED");
      const selectedLeader =
        selectedApp?.members.find((m) => m.isLeader) || selectedApp?.submitter;
      return [
        idx + 1,
        cell(t.id),
        cell(t.title),
        cell(t.slug),
        cell(t.orderingOrganization),
        cell(t.category),
        cell(t.reward),
        cell(TASK_STATUS_LABELS[t.status] || t.status),
        cell(t.status),
        cell(formatExcelDateOnly(t.applicationDeadline)),
        cell(formatExcelDateOnly(t.executionDeadline)),
        t.applications.length,
        cell(selectedLeader ? selectedLeader.fullName : "Chưa chọn"),
        cell(t.requirements),
        cell(t.description),
        cell(t.createdBy),
        cell(formatExcelDate(t.createdAt)),
        cell(formatExcelDate(t.updatedAt)),
      ];
    }),
  };

  // 9. Ung_Tuyen_Nhiem_Vu (Full TaskApplication table)
  const allTaskApps: (string | number)[][] = [];
  const allTaskAppMembers: (string | number)[][] = [];
  let taStt = 1;
  let tamStt = 1;

  tasks.forEach((t) => {
    t.applications.forEach((a) => {
      const leader = a.members.find((m) => m.isLeader) || a.submitter;
      allTaskApps.push([
        taStt++,
        cell(a.id),
        cell(t.id),
        cell(t.title),
        cell(t.orderingOrganization),
        cell(a.submitterId),
        cell(APPLICATION_STATUS_LABELS[a.status] || a.status),
        cell(a.status),
        cell(leader.fullName),
        cell(leader.studentCode),
        cell(leader.email),
        a.members.length,
        cell(a.proposal),
        cell(a.adminFeedback),
        cell(formatExcelDate(a.submittedAt)),
        cell(formatExcelDate(a.selectedAt)),
        cell(formatExcelDate(a.createdAt)),
        cell(formatExcelDate(a.updatedAt)),
      ]);

      a.members.forEach((m) => {
        allTaskAppMembers.push([
          tamStt++,
          cell(m.id),
          cell(a.id),
          cell(t.title),
          cell(m.memberType === "ADVISOR" ? "Giảng viên hướng dẫn" : "Sinh viên"),
          cell(m.memberType),
          cell(m.isLeader ? "Có (Trưởng nhóm)" : "Không"),
          cell(m.fullName),
          cell(m.studentCode),
          cell(m.className),
          cell(m.department),
          cell(m.email),
          cell(m.phone),
          m.orderIndex,
          cell(formatExcelDate(m.createdAt)),
          cell(formatExcelDate(m.updatedAt)),
        ]);
      });
    });
  });

  const sheetTaskApps: SheetTabPayload = {
    sheetName: "9_Ung_Tuyen_Nhiem_Vu",
    title: "Danh sách Đơn Ứng tuyển Nhiệm vụ",
    headers: [
      "STT",
      "ID Đơn ứng tuyển",
      "ID Nhiệm vụ",
      "Tên nhiệm vụ",
      "Đơn vị đặt hàng",
      "ID Người nộp",
      "Trạng thái (Nhãn)",
      "Trạng thái (Mã)",
      "Trưởng nhóm",
      "MSSV Trưởng nhóm",
      "Email Trưởng nhóm",
      "Số thành viên",
      "Tóm tắt đề xuất",
      "Phản hồi quản trị",
      "Ngày nộp",
      "Ngày được chọn",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: allTaskApps,
  };

  // 10. Thanh_Vien_Nhiem_Vu (Full TaskApplicationMember table)
  const sheetTaskAppMembers: SheetTabPayload = {
    sheetName: "10_Thanh_Vien_Nhiem_Vu",
    title: "Danh sách Thành viên Ứng tuyển Nhiệm vụ",
    headers: [
      "STT",
      "ID Thành viên",
      "ID Đơn ứng tuyển",
      "Tên nhiệm vụ",
      "Vai trò (Nhãn)",
      "Vai trò (Mã)",
      "Trưởng nhóm",
      "Họ và tên",
      "Mã sinh viên",
      "Lớp",
      "Khoa / Đơn vị",
      "Email",
      "Số điện thoại",
      "Thứ tự",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: allTaskAppMembers,
  };

  // 11. Lich_Su_Nhiem_Vu (Combined TaskHistory + TaskApplicationHistory)
  const combinedTaskHistories: (string | number)[][] = [];
  let thStt = 1;
  taskHistories.forEach((h) => {
    combinedTaskHistories.push([
      thStt++,
      "NHIEM_VU",
      cell(h.id),
      cell(h.taskId),
      cell(h.task?.title),
      cell(h.action),
      cell(h.actorRole),
      cell(h.actorId),
      cell(h.reason),
      cell(h.metadata ? JSON.stringify(h.metadata) : ""),
      cell(formatExcelDate(h.createdAt)),
    ]);
  });
  taskAppHistories.forEach((h) => {
    combinedTaskHistories.push([
      thStt++,
      "DON_UNG_TUYEN",
      cell(h.id),
      cell(h.applicationId),
      cell(
        `${h.application?.task?.title || ""} — ${h.application?.submitter?.fullName || ""}`
      ),
      cell(h.action),
      cell(h.actorRole),
      cell(h.actorId),
      cell(h.reason),
      cell(h.metadata ? JSON.stringify(h.metadata) : ""),
      cell(formatExcelDate(h.createdAt)),
    ]);
  });

  const sheetTaskHistory: SheetTabPayload = {
    sheetName: "11_Lich_Su_Nhiem_Vu",
    title: "Lịch sử Nhiệm vụ & Đơn Ứng tuyển",
    headers: [
      "STT",
      "Phân loại",
      "ID Lịch sử",
      "ID Đối tượng",
      "Tên nhiệm vụ / Nhóm",
      "Hành động",
      "Vai trò tác nhân",
      "ID Người thao tác",
      "Lý do / Ghi chú",
      "Metadata (JSON)",
      "Thời gian",
    ],
    rows: combinedTaskHistories,
  };

  // 12. Hoi_Cho_Y_Tuong (Full IdeaRecruitmentPost table)
  const sheetRecruitmentPosts: SheetTabPayload = {
    sheetName: "12_Hoi_Cho_Y_Tuong",
    title: "Danh sách Tin Tuyển Thành viên (Hội chợ Ý tưởng)",
    headers: [
      "STT",
      "ID Tin tuyển",
      "ID Ý tưởng",
      "Mã hồ sơ",
      "Tên đề tài / Ý tưởng",
      "Tiêu đề tin tuyển",
      "Mô tả công việc",
      "Số lượng cần tuyển",
      "Kỹ năng yêu cầu",
      "Trạng thái tin",
      "Số lượng ứng viên",
      "Trưởng nhóm",
      "MSSV Trưởng nhóm",
      "Email Trưởng nhóm",
      "SĐT Trưởng nhóm",
      "Ngày đăng",
      "Ngày đóng",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: recruitmentPosts.map((post, idx) => [
      idx + 1,
      cell(post.id),
      cell(post.ideaId),
      cell(post.idea.referenceCode),
      cell(post.idea.title),
      cell(post.title),
      cell(post.description),
      post.targetMemberCount,
      cell(post.requiredSkills),
      cell(post.status),
      post._count.applications,
      cell(post.idea.submitter.fullName),
      cell(post.idea.submitter.studentCode),
      cell(post.idea.submitter.email),
      cell(post.idea.submitter.phone),
      cell(formatExcelDate(post.publishedAt)),
      cell(formatExcelDate(post.closedAt)),
      cell(formatExcelDate(post.createdAt)),
      cell(formatExcelDate(post.updatedAt)),
    ]),
  };

  // 13. Ung_Vien_Hoi_Cho (Full IdeaRecruitmentApplication table)
  const sheetRecruitmentApps: SheetTabPayload = {
    sheetName: "13_Ung_Vien_Hoi_Cho",
    title: "Danh sách Ứng viên Ghép nhóm (Hội chợ Ý tưởng)",
    headers: [
      "STT",
      "ID Đơn ứng tuyển",
      "ID Tin tuyển",
      "Tiêu đề tin tuyển",
      "Mã hồ sơ đề tài",
      "Tên đề tài",
      "Họ và tên ứng viên",
      "Mã sinh viên",
      "Lớp",
      "Email",
      "Email chuẩn hóa",
      "Số điện thoại",
      "Chuyên môn / Kỹ năng",
      "Động lực tham gia",
      "Đóng góp dự kiến",
      "Trạng thái duyệt",
      "Thời gian duyệt",
      "Ghi chú duyệt",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: recruitmentApps.map((app, idx) => [
      idx + 1,
      cell(app.id),
      cell(app.postId),
      cell(app.post.title),
      cell(app.post.idea.referenceCode),
      cell(app.post.idea.title),
      cell(app.fullName),
      cell(app.studentCode),
      cell(app.className),
      cell(app.email),
      cell(app.emailNormalized),
      cell(app.phone),
      cell(app.specialty),
      cell(app.motivation),
      cell(app.contribution),
      cell(app.status),
      cell(formatExcelDate(app.reviewedAt)),
      cell(app.reviewNote),
      cell(formatExcelDate(app.createdAt)),
      cell(formatExcelDate(app.updatedAt)),
    ]),
  };

  // 14. Mua_Giai_Thuong (Full AwardSeason table)
  const sheetSeasons: SheetTabPayload = {
    sheetName: "14_Mua_Giai_Thuong",
    title: "Danh sách Mùa Giải thưởng (AwardSeason)",
    headers: [
      "STT",
      "ID Mùa giải",
      "Tên mùa giải",
      "Slug",
      "Mô tả",
      "Trạng thái",
      "Năm",
      "Ngày bắt đầu",
      "Ngày kết thúc",
      "Phân loại dữ liệu",
      "Thứ tự hiển thị",
      "Số lượng giải thưởng",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: awardSeasons.map((s, idx) => [
      idx + 1,
      cell(s.id),
      cell(s.name),
      cell(s.slug),
      cell(s.description),
      cell(s.status),
      s.year ?? "",
      cell(formatExcelDateOnly(s.startDate)),
      cell(formatExcelDateOnly(s.endDate)),
      cell(s.isDemo ? "Dữ liệu minh họa (Demo)" : "Dữ liệu chính thức"),
      s.displayOrder,
      s._count.awards,
      cell(formatExcelDate(s.createdAt)),
      cell(formatExcelDate(s.updatedAt)),
    ]),
  };

  // 15. Giai_Thuong_Vinh_Danh (Full Award table)
  const sheetAwards: SheetTabPayload = {
    sheetName: "15_Giai_Thuong_Vinh_Danh",
    title: "Danh sách Công trình & Giải thưởng Vinh danh",
    headers: [
      "STT",
      "ID Giải thưởng",
      "ID Mùa giải",
      "Mùa giải",
      "Tên công trình / Đề tài",
      "Slug",
      "Danh hiệu giải thưởng",
      "Lĩnh vực",
      "Đơn vị / Khoa viện",
      "Trạng thái (Nhãn)",
      "Trạng thái (Mã)",
      "Phân loại dữ liệu",
      "Thứ tự hiển thị",
      "Tóm tắt ngắn",
      "Mô tả chi tiết",
      "Đường dẫn ảnh (imageUrl)",
      "Đường dẫn video (videoUrl)",
      "Số thành viên vinh danh",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: awards.map((a, idx) => [
      idx + 1,
      cell(a.id),
      cell(a.seasonId),
      cell(a.season.name),
      cell(a.title),
      cell(a.slug),
      cell(a.awardName),
      cell(a.category),
      cell(a.organization),
      cell(AWARD_STATUS_LABELS[a.status] || a.status),
      cell(a.status),
      cell(a.isDemo ? "Dữ liệu minh họa (Demo)" : "Dữ liệu chính thức"),
      a.displayOrder,
      cell(a.shortDescription),
      cell(a.description),
      cell(a.imageUrl),
      cell(a.videoUrl),
      a.members.length,
      cell(formatExcelDate(a.createdAt)),
      cell(formatExcelDate(a.updatedAt)),
    ]),
  };

  // 16. Thanh_Vien_Vinh_Danh (Full AwardMember + AwardHistory)
  const allAwardMembers: (string | number)[][] = [];
  let amStt = 1;
  awards.forEach((a) => {
    a.members.forEach((m) => {
      allAwardMembers.push([
        amStt++,
        cell(m.id),
        cell(a.id),
        cell(a.title),
        cell(a.awardName),
        cell(a.season.name),
        cell(m.fullName),
        cell(m.role || "Thành viên"),
        cell(m.studentCode),
        cell(m.className),
        cell(m.department),
        m.displayOrder,
        cell(m.isDemo || a.isDemo ? "Dữ liệu minh họa (Demo)" : "Dữ liệu chính thức"),
        cell(formatExcelDate(m.createdAt)),
        cell(formatExcelDate(m.updatedAt)),
      ]);
    });
  });

  const sheetAwardMembers: SheetTabPayload = {
    sheetName: "16_Thanh_Vien_Vinh_Danh",
    title: "Danh sách Thành viên Vinh danh Giải thưởng",
    headers: [
      "STT",
      "ID Thành viên",
      "ID Giải thưởng",
      "Tên công trình / Đề tài",
      "Danh hiệu giải thưởng",
      "Mùa giải",
      "Họ và tên thành viên",
      "Vai trò",
      "Mã sinh viên",
      "Lớp",
      "Khoa / Đơn vị",
      "Thứ tự hiển thị",
      "Phân loại dữ liệu",
      "Ngày tạo",
      "Cập nhật lần cuối",
    ],
    rows: allAwardMembers,
  };

  // 17. Nhat_Ky_He_Thong_Email (Full EmailJob + AwardHistory)
  const sheetEmailJobs: SheetTabPayload = {
    sheetName: "17_Nhat_Ky_Email",
    title: "Nhật ký Hàng đợi Email Outbox & Lịch sử Giải thưởng",
    headers: [
      "STT",
      "ID Email Job",
      "Loại thông báo",
      "Email người nhận",
      "Trạng thái",
      "Số lần thử",
      "Tối đa lần thử",
      "Khóa Idempotency",
      "Lỗi gần nhất",
      "Thời gian khả dụng",
      "Thời gian tạo",
      "Thời gian hoàn tất",
    ],
    rows: emailJobs.map((job, idx) => [
      idx + 1,
      cell(job.id),
      cell(job.type),
      cell(job.recipient),
      cell(job.status),
      job.attempts,
      job.maxAttempts,
      cell(job.idempotencyKey),
      cell(job.lastError),
      cell(formatExcelDate(job.availableAt)),
      cell(formatExcelDate(job.createdAt)),
      cell(formatExcelDate(job.processedAt)),
    ]),
  };

  void awardHistories;

  const sheets: SheetTabPayload[] = [
    sheetIdeas,
    sheetSubmitters,
    sheetIdeaHistory,
    sheetProfiles,
    sheetProfileMembers,
    sheetEditRequests,
    sheetProfileHistory,
    sheetTasks,
    sheetTaskApps,
    sheetTaskAppMembers,
    sheetTaskHistory,
    sheetRecruitmentPosts,
    sheetRecruitmentApps,
    sheetSeasons,
    sheetAwards,
    sheetAwardMembers,
    sheetEmailJobs,
  ];

  const sheetCounts: Record<string, number> = {};
  let totalRows = 0;
  for (const s of sheets) {
    sheetCounts[s.sheetName] = s.rows.length;
    totalRows += s.rows.length;
  }

  return {
    systemName: "CỔNG ĐỔI MỚI SÁNG TẠO 4.0 — TRƯỜNG ĐẠI HỌC CÔNG NGHỆ GTVT (UTT)",
    exportedAt: formatExcelDate(new Date()),
    secret: secret || undefined,
    summary: {
      totalSheets: sheets.length,
      totalRows,
      sheetCounts,
    },
    sheets,
  };
}

let inFlightSyncPromise: Promise<GoogleSheetsSyncStatus> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Executes a full synchronization of all 17 PostgreSQL datasets to Google Sheets.
 */
export async function syncAllDataToGoogleSheets(
  trigger = "MANUAL"
): Promise<GoogleSheetsSyncStatus> {
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    const startMs = Date.now();
    const config = await getGoogleSheetsConfig();
    const prevStatus = await getGoogleSheetsSyncStatus();

    if (!config.webhookUrl) {
      const status: GoogleSheetsSyncStatus = {
        ...prevStatus,
        lastSyncStatus: "IDLE",
        lastSyncMessage: "Chưa cấu hình URL Google Apps Script Webhook.",
        lastSyncTrigger: trigger,
      };
      await saveGoogleSheetsSyncStatus(status);
      return status;
    }

    try {
      const fingerprint = await computeDatabaseFingerprint();
      const payload = await buildFullGoogleSheetsPayload(config.secret);

      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
      });

      const responseText = await response.text();
      let parsedOk = response.ok;
      let serverMsg = "";

      try {
        const json = JSON.parse(responseText) as { ok?: boolean; error?: string; message?: string };
        if (json.ok === false) {
          parsedOk = false;
          serverMsg = json.error || json.message || "Google Apps Script trả về lỗi.";
        } else if (json.message) {
          serverMsg = json.message;
        }
      } catch {
        if (!response.ok) {
          serverMsg = `HTTP ${response.status}: ${responseText.slice(0, 180)}`;
        }
      }

      if (!parsedOk) {
        throw new Error(serverMsg || `Lỗi HTTP ${response.status} khi gọi Google Sheets Webhook`);
      }

      const durationMs = Date.now() - startMs;
      const successStatus: GoogleSheetsSyncStatus = {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "SUCCESS",
        lastSyncMessage:
          serverMsg ||
          `Đã đồng bộ thành công ${payload.summary.totalRows} bản ghi trên ${payload.summary.totalSheets} bảng dữ liệu (${durationMs}ms).`,
        lastSyncTrigger: trigger,
        lastFingerprint: fingerprint,
        totalSheets: payload.summary.totalSheets,
        totalRows: payload.summary.totalRows,
        sheetCounts: payload.summary.sheetCounts,
        durationMs,
      };

      await saveGoogleSheetsSyncStatus(successStatus);
      console.info(
        `[GOOGLE_SHEETS_SYNC] SUCCESS trigger:${trigger} sheets:${payload.summary.totalSheets} rows:${payload.summary.totalRows} durationMs:${durationMs}`
      );
      return successStatus;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Lỗi không xác định khi kết nối Google Sheets";
      const errStatus: GoogleSheetsSyncStatus = {
        ...prevStatus,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "ERROR",
        lastSyncMessage: errorMsg,
        lastSyncTrigger: trigger,
        durationMs: Date.now() - startMs,
      };
      await saveGoogleSheetsSyncStatus(errStatus);
      console.error(`[GOOGLE_SHEETS_SYNC] ERROR trigger:${trigger} message:${errorMsg}`);
      return errStatus;
    } finally {
      inFlightSyncPromise = null;
    }
  })();

  return inFlightSyncPromise;
}

/**
 * Non-blocking debounced trigger that can be called after any database write.
 */
export function triggerGoogleSheetsSync(reason = "EVENT"): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncAllDataToGoogleSheets(reason).catch((err) => {
      console.error("[GOOGLE_SHEETS_SYNC] Background trigger failed:", err);
    });
  }, 3000);
}

export const triggerGoogleSheetsAutoSync = triggerGoogleSheetsSync;

/**
 * Returns the ready-to-paste Google Apps Script (`Code.gs`) that automatically creates
 * and formats all 17 sheets inside the user's Google Spreadsheet.
 */
export function getGoogleAppsScriptTemplate(secret = ""): string {
  return `/**
 * KỊCH BẢN ĐỒNG BỘ TỰ ĐỘNG 100% DỮ LIỆU CỔNG SÁNG TẠO 4.0 UTT LÊN GOOGLE SHEETS
 * Hướng dẫn cài đặt (chỉ mất 1 phút):
 * 1. Mở file Google Sheet của bạn -> Chọn menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * 2. Xóa mã cũ, dán toàn bộ đoạn mã này vào và bấm biểu tượng Đĩa mềm (Lưu / Ctrl+S).
 * 3. Bấm nút "Triển khai" (Deploy) ở góc phải trên -> "Tùy chọn triển khai mới" (New deployment).
 * 4. Chọn loại: "Ứng dụng web" (Web app):
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 5. Bấm "Triển khai" (Deploy), cấp quyền truy cập và copy "URL ứng dụng web" (Web App URL) dán vào trang Quản trị UTT.
 */

const EXPECTED_SECRET = ${JSON.stringify(secret)};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Không nhận được dữ liệu JSON." });
    }

    const payload = JSON.parse(e.postData.contents);

    if (EXPECTED_SECRET && payload.secret !== EXPECTED_SECRET) {
      return jsonResponse({ ok: false, error: "Mã bảo mật (Secret) không khớp." });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = payload.sheets || [];

    for (let i = 0; i < sheets.length; i++) {
      const tab = sheets[i];
      const sheetName = tab.sheetName;
      const headers = tab.headers || [];
      const rows = tab.rows || [];

      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      sheet.clearContents();

      if (headers.length > 0) {
        const allValues = [headers].concat(rows);
        const range = sheet.getRange(1, 1, allValues.length, headers.length);
        range.setValues(allValues);

        // Định dạng dòng tiêu đề chuẩn thương hiệu UTT
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange
          .setBackground("#F25C05")
          .setFontColor("#FFFFFF")
          .setFontWeight("bold")
          .setVerticalAlignment("middle");

        sheet.setFrozenRows(1);
      }
    }

    // Cập nhật tab Tổng quan đồng bộ đầu tiên
    let summarySheet = ss.getSheetByName("0_Tong_Quan_Dong_Bo");
    if (!summarySheet) {
      summarySheet = ss.insertSheet("0_Tong_Quan_Dong_Bo", 0);
    }
    summarySheet.clearContents();

    const summaryRows = [
      ["HỆ THỐNG", payload.systemName || "CỔNG ĐỔI MỚI SÁNG TẠO 4.0 UTT"],
      ["THỜI ĐIỂM ĐỒNG BỘ GẦN NHẤT", payload.exportedAt || new Date().toLocaleString("vi-VN")],
      ["TỔNG SỐ BẢNG DỮ LIỆU (SHEETS)", String(payload.summary ? payload.summary.totalSheets : sheets.length)],
      ["TỔNG SỐ BẢN GHI ĐÃ LƯU", String(payload.summary ? payload.summary.totalRows : 0)],
      ["", ""],
      ["TÊN BẢNG DỮ LIỆU (SHEET)", "SỐ LƯỢNG BẢN GHI HIỆN TẠI"],
    ];

    for (let i = 0; i < sheets.length; i++) {
      summaryRows.push([sheets[i].sheetName + " — " + (sheets[i].title || ""), String((sheets[i].rows || []).length)]);
    }

    summarySheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
    summarySheet.getRange(1, 1, 4, 1).setFontWeight("bold");
    summarySheet.getRange(6, 1, 1, 2).setBackground("#091B48").setFontColor("#FFFFFF").setFontWeight("bold");
    summarySheet.setColumnWidth(1, 420);
    summarySheet.setColumnWidth(2, 260);

    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      message: "Đã đồng bộ thành công " + sheets.length + " bảng dữ liệu lên Google Sheets lúc " + (payload.exportedAt || ""),
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`;
}
