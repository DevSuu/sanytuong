// Client-safe types and pure extractors; server-only functions dynamically import getDb.

const POSTER_DRIVE_CONFIG_PROBE_ID = 9005;

export interface PosterDriveConfig {
  webhookUrl: string;
  rootFolderName: string;
  useTestSuffix: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PosterDriveFileItem {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
  viewUrl: string;
  previewUrl: string;
}

export interface PosterDriveMetadata {
  folderId?: string | null;
  folderName: string;
  rootFolderName: string;
  folderUrl: string | null;
  editorEmail: string;
  posterStatus: "WAITING_UPLOAD" | "SUBMITTED";
  submittedAt?: string | null;
  leaderNote?: string | null;
  files: PosterDriveFileItem[];
  lastCheckedAt?: string | null;
  driveWarning?: string | null;
}

const DEFAULT_POSTER_DRIVE_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxuAgSdOjMyayfuPyHblTUsRyq137rQL8873rd4oBVWMl6rszvR8Eds4FD3Xv1xlAg/exec";

function isDefaultTestEnvironment(): boolean {
  return process.env.FORCE_POSTER_TEST_FOLDER === "true";
}

/**
 * Generates the Google Drive folder name for a given idea reference code.
 * Uses "_TEST" suffix when useTestSuffix is enabled (default on test/staging).
 */
export function getPosterFolderName(
  referenceCode: string,
  useTestSuffix = isDefaultTestEnvironment(),
): string {
  const cleanCode = (referenceCode || "IDEA").trim();
  return useTestSuffix ? `${cleanCode}_TEST` : cleanCode;
}

export function getPosterRootFolderName(
  useTestSuffix = isDefaultTestEnvironment(),
): string {
  return useTestSuffix ? "UTT_POSTER_VONG_2_TEST" : "UTT_POSTER_VONG_2";
}

export {
  isValidPosterFileName,
  buildStandardPosterFileName,
  MAX_POSTER_FILE_SIZE_BYTES,
  POSTER_UPLOAD_CHUNK_SIZE,
} from "./poster-file-utils";

/**
 * Reads the dedicated Poster Google Drive configuration from PostgreSQL (SystemProbe 9005),
 * completely isolated from the Google Sheets sync configuration.
 */
export async function getPosterDriveConfig(): Promise<PosterDriveConfig> {
  const defaultTest = isDefaultTestEnvironment();
  const envWebhook = (
    process.env.POSTER_DRIVE_WEBHOOK_URL || DEFAULT_POSTER_DRIVE_WEBHOOK_URL
  ).trim();
  const defaultConfig: PosterDriveConfig = {
    webhookUrl: envWebhook,
    rootFolderName: getPosterRootFolderName(defaultTest),
    useTestSuffix: defaultTest,
  };

  try {
    const { getDb } = await import("@/lib/db");
    const { getGoogleSheetsConfig } = await import("@/lib/google-sheets/sync-service");
    const sheetsCfg = await getGoogleSheetsConfig();
    const fallbackWebhook =
      (process.env.POSTER_DRIVE_WEBHOOK_URL || "").trim() ||
      DEFAULT_POSTER_DRIVE_WEBHOOK_URL ||
      sheetsCfg.webhookUrl;
    const db = getDb();
    const row = await db.systemProbe.findUnique({
      where: { id: POSTER_DRIVE_CONFIG_PROBE_ID },
    });
    if (row?.label) {
      const parsed = JSON.parse(row.label) as Partial<PosterDriveConfig>;
      const useTest =
        parsed.useTestSuffix !== undefined ? parsed.useTestSuffix : defaultTest;
      return {
        webhookUrl: (parsed.webhookUrl || fallbackWebhook).trim(),
        rootFolderName:
          (parsed.rootFolderName || "").trim() ||
          getPosterRootFolderName(useTest),
        useTestSuffix: useTest,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      };
    }
    return {
      ...defaultConfig,
      webhookUrl: fallbackWebhook.trim(),
    };
  } catch {
    // Fallback to defaultConfig
  }

  return defaultConfig;
}

/**
 * Saves the dedicated Poster Google Drive configuration into PostgreSQL (SystemProbe 9005).
 */
export async function savePosterDriveConfig(
  input: Partial<PosterDriveConfig>,
  actorEmail?: string,
): Promise<PosterDriveConfig> {
  const current = await getPosterDriveConfig();
  const useTestSuffix =
    input.useTestSuffix !== undefined
      ? Boolean(input.useTestSuffix)
      : current.useTestSuffix;
  const next: PosterDriveConfig = {
    webhookUrl: (input.webhookUrl ?? current.webhookUrl).trim(),
    rootFolderName:
      (input.rootFolderName ?? current.rootFolderName).trim() ||
      getPosterRootFolderName(useTestSuffix),
    useTestSuffix,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail || current.updatedBy || "ADMIN",
  };

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const payloadStr = JSON.stringify(next);
  await db.systemProbe.upsert({
    where: { id: POSTER_DRIVE_CONFIG_PROBE_ID },
    update: { label: payloadStr },
    create: { id: POSTER_DRIVE_CONFIG_PROBE_ID, label: payloadStr },
  });

  return next;
}

/**
 * Returns the standalone Google Apps Script (`Code.gs`) dedicated ONLY to Google Drive Poster folders.
 * Does NOT touch Google Sheets or any existing Apps Script project.
 */
export function getStandalonePosterAppsScriptTemplate(): string {
  return `/**
 * KỊCH BẢN ĐỘC LẬP QUẢN LÝ THƯ MỤC & TẢI LÊN POSTER VÒNG 2 (GOOGLE DRIVE)
 * Hỗ trợ:
 * - CREATE_POSTER_FOLDER / LIST_POSTER_FILES
 * - INIT_RESUMABLE_UPLOAD (Cấp phiên tải lên trực tiếp Google Drive API v3)
 * - FINALIZE_POSTER_UPLOAD (Mở quyền xem link Preview cho Admin, dọn file cũ khi nộp lại)
 */

function capQuyenHeThong() {
  // Chọn hàm "capQuyenHeThong" trên thanh công cụ -> bấm "Chạy" 1 lần để cấp đủ quyền DriveApp + UrlFetchApp
  DriveApp.getRootFolder();
  UrlFetchApp.fetch("https://www.googleapis.com", { muteHttpExceptions: true });
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "UTT Poster Google Drive Webhook Vòng 2",
    status: "READY",
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Không nhận được dữ liệu JSON." });
    }

    const payload = JSON.parse(e.postData.contents);
    return handlePosterDriveAction(payload);
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    lock.releaseLock();
  }
}

function findOrCreateActiveSubFolder(payload) {
  const rootFolderName = String(payload.rootFolderName || "UTT_POSTER_VONG_2").trim();
  const folderName = String(payload.folderName || "TTST-02").trim();

  // 1. Tìm hoặc tạo thư mục gốc của BTC (chế độ Riêng tư, bỏ qua thư mục trong Thùng rác)
  let rootFolder = null;
  const rootIter = DriveApp.getFoldersByName(rootFolderName);
  while (rootIter.hasNext()) {
    const candidate = rootIter.next();
    if (!candidate.isTrashed()) {
      rootFolder = candidate;
      break;
    }
  }
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder(rootFolderName);
    rootFolder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  }

  // 2. Tìm hoặc tạo thư mục con theo Mã đề tài (chế độ Riêng tư, bỏ qua thư mục trong Thùng rác)
  let subFolder = null;
  if (payload.folderId) {
    try {
      const byId = DriveApp.getFolderById(String(payload.folderId));
      if (byId && !byId.isTrashed()) {
        subFolder = byId;
      }
    } catch (e) {
      subFolder = null;
    }
  }
  if (!subFolder) {
    const subIter = rootFolder.getFoldersByName(folderName);
    while (subIter.hasNext()) {
      const candidate = subIter.next();
      if (!candidate.isTrashed()) {
        subFolder = candidate;
        break;
      }
    }
    if (!subFolder) {
      subFolder = rootFolder.createFolder(folderName);
      subFolder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    }
  }

  return subFolder;
}

function listFolderFiles(subFolder) {
  const files = [];
  const fileIter = subFolder.getFiles();
  while (fileIter.hasNext()) {
    const f = fileIter.next();
    if (f.isTrashed()) continue;
    const fId = f.getId();
    files.push({
      id: fId,
      name: f.getName(),
      mimeType: f.getMimeType(),
      size: f.getSize(),
      updatedAt: f.getLastUpdated() ? f.getLastUpdated().toISOString() : "",
      viewUrl: f.getUrl(),
      previewUrl: "https://drive.google.com/file/d/" + fId + "/preview",
    });
  }
  return files;
}

function handlePosterDriveAction(payload) {
  const action = String(payload.action || "").trim();
  const editorEmail = String(payload.editorEmail || "").trim().toLowerCase();
  const subFolder = findOrCreateActiveSubFolder(payload);

  // Action A0: Tải trực tiếp bằng DriveApp thuần (không cần quyền UrlFetchApp, hỗ trợ tới ~36MB)
  if (action === "UPLOAD_POSTER_DIRECT") {
    const targetFileName = String(payload.targetFileName || subFolder.getName() + ".pdf").trim();
    const mimeType = String(payload.mimeType || "application/pdf").trim();
    const fileBase64 = String(payload.fileBase64 || "");
    if (!fileBase64) {
      return jsonResponse({ ok: false, error: "Thiếu dữ liệu tệp PDF (fileBase64)." });
    }
    const bytes = Utilities.base64Decode(fileBase64);
    const blob = Utilities.newBlob(bytes, mimeType, targetFileName);
    const newFile = subFolder.createFile(blob);
    const uploadedFileId = newFile.getId();
    try {
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr1) {
      try {
        newFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr2) {}
    }
    const oldIter = subFolder.getFiles();
    while (oldIter.hasNext()) {
      const oldFile = oldIter.next();
      if (!oldFile.isTrashed() && oldFile.getId() !== uploadedFileId) {
        try {
          oldFile.setTrashed(true);
        } catch (trashErr) {}
      }
    }
    return jsonResponse({
      ok: true,
      uploadedFileId: uploadedFileId,
      folderId: subFolder.getId(),
      folderName: subFolder.getName(),
      folderUrl: subFolder.getUrl(),
      editorEmail: editorEmail,
      files: listFolderFiles(subFolder),
      warning: null,
    });
  }

  // Action A: Khởi tạo phiên tải lên trực tiếp Google Drive v3 (Resumable Upload Session)
  if (action === "INIT_RESUMABLE_UPLOAD") {
    const targetFileName = String(payload.targetFileName || subFolder.getName() + ".pdf").trim();
    const mimeType = String(payload.mimeType || "application/pdf").trim();
    const fileSize = Number(payload.fileSize || 0);

    const headers = {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      "X-Upload-Content-Type": mimeType,
    };
    if (fileSize > 0) {
      headers["X-Upload-Content-Length"] = String(fileSize);
    }

    const initRes = UrlFetchApp.fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "post",
        contentType: "application/json; charset=UTF-8",
        headers: headers,
        payload: JSON.stringify({
          name: targetFileName,
          parents: [subFolder.getId()],
        }),
        muteHttpExceptions: true,
      }
    );

    const statusCode = initRes.getResponseCode();
    if (statusCode !== 200 && statusCode !== 201) {
      return jsonResponse({
        ok: false,
        error:
          "Không khởi tạo được phiên tải lên Google Drive (HTTP " +
          statusCode +
          "): " +
          initRes.getContentText(),
      });
    }

    const allHeaders = initRes.getAllHeaders();
    const uploadUrl = allHeaders["Location"] || allHeaders["location"] || "";
    if (!uploadUrl) {
      return jsonResponse({
        ok: false,
        error: "Google Drive không trả về đường dẫn phiên tải lên (Location header).",
      });
    }

    return jsonResponse({
      ok: true,
      uploadUrl: uploadUrl,
      folderId: subFolder.getId(),
      folderName: subFolder.getName(),
      folderUrl: subFolder.getUrl(),
      targetFileName: targetFileName,
    });
  }

  // Action B: Hoàn tất sau khi tải xong file -> Cấp quyền xem Preview & Dọn các file cũ bị thay thế
  if (action === "FINALIZE_POSTER_UPLOAD") {
    const uploadedFileId = String(payload.uploadedFileId || "").trim();
    if (uploadedFileId) {
      try {
        const newFile = DriveApp.getFileById(uploadedFileId);
        try {
          newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr1) {
          try {
            newFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (shareErr2) {}
        }
      } catch (fileErr) {}

      // Dọn các file cũ trước đó trong thư mục để mỗi đội luôn chỉ còn 1 file Poster mới nhất
      const oldIter = subFolder.getFiles();
      while (oldIter.hasNext()) {
        const oldFile = oldIter.next();
        if (!oldFile.isTrashed() && oldFile.getId() !== uploadedFileId) {
          try {
            oldFile.setTrashed(true);
          } catch (trashErr) {}
        }
      }
    }

    return jsonResponse({
      ok: true,
      folderId: subFolder.getId(),
      folderName: subFolder.getName(),
      folderUrl: subFolder.getUrl(),
      editorEmail: editorEmail,
      files: listFolderFiles(subFolder),
      warning: null,
    });
  }

  // Action C (mặc định): Chỉ cấp quyền Editor cho email Trưởng nhóm khi có cờ grantEditor: true
  let warningMsg = null;
  if (payload.grantEditor === true && editorEmail) {
    try {
      subFolder.addEditor(editorEmail);
    } catch (permErr) {
      warningMsg =
        "Không thể tự động cấp quyền Google Drive cho email " +
        editorEmail +
        ": " +
        (permErr && permErr.message ? permErr.message : String(permErr));
    }
  }

  return jsonResponse({
    ok: true,
    folderId: subFolder.getId(),
    folderName: subFolder.getName(),
    folderUrl: subFolder.getUrl(),
    editorEmail: editorEmail,
    files: listFolderFiles(subFolder),
    warning: warningMsg,
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`;
}

/**
 * Scans ProfileHistory list (newest first) to extract the latest PosterDriveMetadata.
 */
export function extractPosterDriveMetadata(
  history?: Array<{
    action?: string;
    reason?: string | null;
    metadata?: unknown;
    createdAt?: string | Date;
  }> | null,
  fallbackRefCode = "TTST-02",
  fallbackEditorEmail = "",
): PosterDriveMetadata | null {
  if (!history || history.length === 0) return null;

  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  for (const item of sorted) {
    if (item.metadata && typeof item.metadata === "object") {
      const meta = item.metadata as Record<string, unknown>;
      if (meta.posterDrive && typeof meta.posterDrive === "object") {
        const pd = meta.posterDrive as Partial<PosterDriveMetadata>;
        return {
          folderId: pd.folderId ?? null,
          folderName: pd.folderName || getPosterFolderName(fallbackRefCode),
          rootFolderName: pd.rootFolderName || getPosterRootFolderName(),
          folderUrl: pd.folderUrl ?? null,
          editorEmail: pd.editorEmail || fallbackEditorEmail,
          posterStatus:
            pd.posterStatus === "SUBMITTED" ? "SUBMITTED" : "WAITING_UPLOAD",
          submittedAt: pd.submittedAt ?? null,
          leaderNote: pd.leaderNote ?? null,
          files: Array.isArray(pd.files) ? pd.files : [],
          lastCheckedAt: pd.lastCheckedAt ?? null,
          driveWarning: pd.driveWarning ?? null,
        };
      }
    }
  }

  return null;
}

export function hasSubmittedPosterInHistory(
  history?: Array<{
    reason?: string | null;
    metadata?: unknown;
  }> | null,
): boolean {
  if (!history || history.length === 0) return false;
  return history.some((h) => {
    if (
      typeof h.reason === "string" &&
      h.reason.startsWith("[POSTER_SUBMITTED]")
    ) {
      return true;
    }
    if (h.metadata && typeof h.metadata === "object") {
      const meta = h.metadata as Record<string, unknown>;
      if (meta.eventType === "POSTER_SUBMITTED") return true;
      if (
        meta.posterDrive &&
        typeof meta.posterDrive === "object" &&
        (meta.posterDrive as { posterStatus?: string }).posterStatus ===
          "SUBMITTED"
      ) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Calls the dedicated Poster Drive Webhook to create a private Google Drive folder
 * for the Idea and grant Editor permission ONLY to the Team Leader's email.
 */
export async function provisionPosterDriveFolder(params: {
  referenceCode: string;
  ideaTitle: string;
  leaderEmail: string;
}): Promise<PosterDriveMetadata> {
  const driveCfg = await getPosterDriveConfig();
  const folderName = getPosterFolderName(
    params.referenceCode,
    driveCfg.useTestSuffix,
  );
  const rootFolderName =
    driveCfg.rootFolderName || getPosterRootFolderName(driveCfg.useTestSuffix);
  const editorEmail = params.leaderEmail.trim().toLowerCase();

  const baseMeta: PosterDriveMetadata = {
    folderId: null,
    folderName,
    rootFolderName,
    folderUrl: null,
    editorEmail,
    posterStatus: "WAITING_UPLOAD",
    submittedAt: null,
    leaderNote: null,
    files: [],
    lastCheckedAt: new Date().toISOString(),
    driveWarning: null,
  };

  if (!driveCfg.webhookUrl) {
    return {
      ...baseMeta,
      driveWarning:
        "Chưa cấu hình URL Webhook Google Drive Poster riêng. Vui lòng kiểm tra cấu hình Webhook Drive trong trang Quản trị.",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(driveCfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_POSTER_FOLDER",
        rootFolderName,
        folderName,
        referenceCode: params.referenceCode,
        ideaTitle: params.ideaTitle,
        editorEmail,
      }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ...baseMeta,
        driveWarning:
          "Webhook chưa trả về định dạng JSON hợp lệ. Vui lòng kiểm tra lại quyền truy cập 'Bất kỳ ai (Anyone)' trên Apps Script.",
      };
    }

    if (parsed.ok && typeof parsed.folderUrl === "string" && parsed.folderUrl) {
      return {
        ...baseMeta,
        folderId: typeof parsed.folderId === "string" ? parsed.folderId : null,
        folderName:
          typeof parsed.folderName === "string" ? parsed.folderName : folderName,
        folderUrl: parsed.folderUrl,
        files: Array.isArray(parsed.files)
          ? (parsed.files as PosterDriveFileItem[])
          : [],
        driveWarning:
          typeof parsed.warning === "string" ? parsed.warning : null,
      };
    }

    return {
      ...baseMeta,
      driveWarning:
        typeof parsed.error === "string"
          ? parsed.error
          : "URL Webhook hiện tại chưa trả về thông tin thư mục Google Drive.",
    };
  } catch (err) {
    return {
      ...baseMeta,
      driveWarning:
        err instanceof Error
          ? `Lỗi kết nối Google Drive Webhook: ${err.message}`
          : "Không thể kết nối Google Drive Webhook.",
    };
  }
}

/**
 * Calls the dedicated Poster Drive Webhook to list all files currently inside
 * the team's Google Drive folder (and creates the folder if not yet created).
 */
export async function listPosterDriveFiles(params: {
  referenceCode: string;
  ideaTitle: string;
  leaderEmail: string;
  existingMeta?: PosterDriveMetadata | null;
}): Promise<PosterDriveMetadata> {
  const driveCfg = await getPosterDriveConfig();
  const folderName = getPosterFolderName(
    params.referenceCode,
    driveCfg.useTestSuffix,
  );
  const rootFolderName =
    driveCfg.rootFolderName || getPosterRootFolderName(driveCfg.useTestSuffix);
  const editorEmail = (
    params.existingMeta?.editorEmail || params.leaderEmail
  )
    .trim()
    .toLowerCase();

  const isSameFolderTarget =
    params.existingMeta?.folderName === folderName &&
    params.existingMeta?.rootFolderName === rootFolderName;

  const currentMeta: PosterDriveMetadata = params.existingMeta
    ? {
        ...params.existingMeta,
        folderId: isSameFolderTarget ? params.existingMeta.folderId : null,
        folderName,
        rootFolderName,
        editorEmail,
      }
    : {
        folderId: null,
        folderName,
        rootFolderName,
        folderUrl: null,
        editorEmail,
        posterStatus: "WAITING_UPLOAD",
        submittedAt: null,
        leaderNote: null,
        files: [],
        lastCheckedAt: new Date().toISOString(),
        driveWarning: null,
      };

  if (!driveCfg.webhookUrl) {
    return {
      ...currentMeta,
      driveWarning:
        "Chưa cấu hình URL Webhook Google Drive Poster riêng. Vui lòng kiểm tra cấu hình Webhook Drive trong trang Quản trị.",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(driveCfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "LIST_POSTER_FILES",
        rootFolderName,
        folderName,
        folderId: currentMeta.folderId || undefined,
        referenceCode: params.referenceCode,
        ideaTitle: params.ideaTitle,
        editorEmail,
      }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ...currentMeta,
        driveWarning:
          "Không đọc được phản hồi JSON từ Webhook Google Drive Poster.",
      };
    }

    if (parsed.ok && typeof parsed.folderUrl === "string" && parsed.folderUrl) {
      const files = Array.isArray(parsed.files)
        ? (parsed.files as PosterDriveFileItem[])
        : [];
      return {
        ...currentMeta,
        folderId:
          typeof parsed.folderId === "string"
            ? parsed.folderId
            : currentMeta.folderId,
        folderName:
          typeof parsed.folderName === "string"
            ? parsed.folderName
            : currentMeta.folderName,
        folderUrl: parsed.folderUrl,
        files,
        lastCheckedAt: new Date().toISOString(),
        driveWarning:
          typeof parsed.warning === "string" ? parsed.warning : null,
      };
    }

    return {
      ...currentMeta,
      lastCheckedAt: new Date().toISOString(),
      driveWarning:
        typeof parsed.error === "string"
          ? parsed.error
          : "Webhook chưa trả về thông tin thư mục Google Drive.",
    };
  } catch (err) {
    return {
      ...currentMeta,
      lastCheckedAt: new Date().toISOString(),
      driveWarning:
        err instanceof Error
          ? `Lỗi kết nối Google Drive Webhook: ${err.message}`
          : "Không thể kết nối Google Drive Webhook.",
    };
  }
}

/**
 * Initiates a Google Drive Resumable Upload session via Apps Script #2
 * so chunks can be streamed directly from the website to Google Drive without server disk usage.
 */
export async function initPosterResumableUpload(params: {
  referenceCode: string;
  ideaTitle: string;
  leaderEmail: string;
  targetFileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<{
  ok: boolean;
  uploadUrl?: string;
  folderId?: string;
  folderName: string;
  rootFolderName: string;
  folderUrl?: string;
  error?: string;
}> {
  const driveCfg = await getPosterDriveConfig();
  const folderName = getPosterFolderName(
    params.referenceCode,
    driveCfg.useTestSuffix,
  );
  const rootFolderName =
    driveCfg.rootFolderName || getPosterRootFolderName(driveCfg.useTestSuffix);
  const editorEmail = params.leaderEmail.trim().toLowerCase();

  if (!driveCfg.webhookUrl) {
    return {
      ok: false,
      folderName,
      rootFolderName,
      error:
        'Chưa cấu hình URL Webhook Google Drive Poster. Vui lòng liên hệ Ban tổ chức.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(driveCfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INIT_RESUMABLE_UPLOAD",
        rootFolderName,
        folderName,
        referenceCode: params.referenceCode,
        ideaTitle: params.ideaTitle,
        editorEmail,
        targetFileName: params.targetFileName,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
      }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        folderName,
        rootFolderName,
        error:
          "Apps Script chưa trả về định dạng JSON hợp lệ. Vui lòng kiểm tra quyền triển khai Web App ('Anyone').",
      };
    }

    if (!parsed.ok || typeof parsed.uploadUrl !== "string" || !parsed.uploadUrl) {
      return {
        ok: false,
        folderName,
        rootFolderName,
        error:
          (typeof parsed.error === "string" && parsed.error) ||
          "Apps Script chưa hỗ trợ tải lên trực tiếp (INIT_RESUMABLE_UPLOAD). Vui lòng cập nhật mã Apps Script số 2 mới nhất.",
      };
    }

    return {
      ok: true,
      uploadUrl: parsed.uploadUrl,
      folderId: typeof parsed.folderId === "string" ? parsed.folderId : undefined,
      folderName:
        typeof parsed.folderName === "string" ? parsed.folderName : folderName,
      rootFolderName,
      folderUrl:
        typeof parsed.folderUrl === "string" ? parsed.folderUrl : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      folderName,
      rootFolderName,
      error:
        err instanceof Error
          ? `Lỗi kết nối Apps Script khởi tạo phiên tải lên: ${err.message}`
          : "Không thể kết nối Apps Script khởi tạo phiên tải lên.",
    };
  }
}

/**
 * Finalizes an uploaded Poster file on Google Drive via Apps Script #2:
 * ensures link-view permission for admin iframe preview, cleans older replaced files, and returns metadata.
 */
export async function finalizePosterDriveUpload(params: {
  referenceCode: string;
  ideaTitle: string;
  leaderEmail: string;
  folderId?: string | null;
  uploadedFileId: string;
  targetFileName?: string;
  leaderNote?: string | null;
}): Promise<PosterDriveMetadata> {
  const driveCfg = await getPosterDriveConfig();
  const folderName = getPosterFolderName(
    params.referenceCode,
    driveCfg.useTestSuffix,
  );
  const rootFolderName =
    driveCfg.rootFolderName || getPosterRootFolderName(driveCfg.useTestSuffix);
  const editorEmail = params.leaderEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const fallbackFiles: PosterDriveFileItem[] = params.uploadedFileId
    ? [
        {
          id: params.uploadedFileId,
          name: params.targetFileName || `${params.referenceCode}.pdf`,
          viewUrl: `https://drive.google.com/file/d/${params.uploadedFileId}/view`,
          previewUrl: `https://drive.google.com/file/d/${params.uploadedFileId}/preview`,
          updatedAt: nowIso,
        },
      ]
    : [];

  const baseMeta: PosterDriveMetadata = {
    folderId: params.folderId ?? null,
    folderName,
    rootFolderName,
    folderUrl: params.folderId
      ? `https://drive.google.com/drive/folders/${params.folderId}`
      : null,
    editorEmail,
    posterStatus: "SUBMITTED",
    submittedAt: nowIso,
    leaderNote: params.leaderNote || null,
    files: fallbackFiles,
    lastCheckedAt: nowIso,
    driveWarning: null,
  };

  if (!driveCfg.webhookUrl) {
    return baseMeta;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(driveCfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "FINALIZE_POSTER_UPLOAD",
        rootFolderName,
        folderName,
        folderId: params.folderId || undefined,
        uploadedFileId: params.uploadedFileId,
        referenceCode: params.referenceCode,
        ideaTitle: params.ideaTitle,
        editorEmail,
      }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.ok) {
      const files =
        Array.isArray(parsed.files) && parsed.files.length > 0
          ? (parsed.files as PosterDriveFileItem[])
          : fallbackFiles;
      return {
        ...baseMeta,
        folderId:
          typeof parsed.folderId === "string"
            ? parsed.folderId
            : baseMeta.folderId,
        folderName:
          typeof parsed.folderName === "string"
            ? parsed.folderName
            : baseMeta.folderName,
        folderUrl:
          typeof parsed.folderUrl === "string"
            ? parsed.folderUrl
            : baseMeta.folderUrl,
        files,
        driveWarning:
          typeof parsed.warning === "string" ? parsed.warning : null,
      };
    }
  } catch {
    // Fallback cleanly to baseMeta with the uploaded file ID
  }

  return baseMeta;
}

export const MAX_DIRECT_DRIVEAPP_BYTES = 36 * 1024 * 1024; // 36 MB pure DriveApp direct limit

interface DirectUploadBufferEntry {
  chunks: Buffer[];
  receivedBytes: number;
  createdAt: number;
}

function getDirectUploadStore(): Map<string, DirectUploadBufferEntry> {
  const g = globalThis as unknown as {
    __uttDirectUploadStore?: Map<string, DirectUploadBufferEntry>;
  };
  if (!g.__uttDirectUploadStore) {
    g.__uttDirectUploadStore = new Map<string, DirectUploadBufferEntry>();
  }
  const now = Date.now();
  for (const [key, entry] of g.__uttDirectUploadStore.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) {
      g.__uttDirectUploadStore.delete(key);
    }
  }
  return g.__uttDirectUploadStore;
}

export function appendDirectUploadChunk(
  bufferId: string,
  start: number,
  chunk: Buffer,
): number {
  const store = getDirectUploadStore();
  let entry = start === 0 ? undefined : store.get(bufferId);
  if (!entry) {
    if (start !== 0) {
      throw new Error("Phiên đệm tải lên bị gián đoạn. Vui lòng thử tải lại từ đầu.");
    }
    entry = { chunks: [], receivedBytes: 0, createdAt: Date.now() };
    store.set(bufferId, entry);
  }
  if (start !== entry.receivedBytes) {
    throw new Error("Thứ tự phân mảnh dữ liệu không khớp. Vui lòng thử tải lại.");
  }
  if (entry.receivedBytes + chunk.byteLength > MAX_DIRECT_DRIVEAPP_BYTES) {
    store.delete(bufferId);
    throw new Error("Dung lượng tệp vượt quá giới hạn 36 MB cho chế độ DriveApp trực tiếp.");
  }
  entry.chunks.push(chunk);
  entry.receivedBytes += chunk.byteLength;
  return entry.receivedBytes;
}

export function consumeDirectUploadBuffer(bufferId: string): Buffer | null {
  const store = getDirectUploadStore();
  const entry = store.get(bufferId);
  if (!entry) return null;
  store.delete(bufferId);
  return Buffer.concat(entry.chunks, entry.receivedBytes);
}

export function clearDirectUploadBuffer(bufferId: string): void {
  const store = getDirectUploadStore();
  store.delete(bufferId);
}

/**
 * Fallback direct upload using pure DriveApp (`UPLOAD_POSTER_DIRECT`) inside Apps Script #2,
 * requiring ZERO UrlFetchApp scope (works even under strict Google Workspace policies up to ~36 MB).
 */
export async function uploadPosterDirectViaDriveApp(params: {
  referenceCode: string;
  ideaTitle: string;
  leaderEmail: string;
  targetFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  leaderNote?: string | null;
}): Promise<{ ok: boolean; posterDrive?: PosterDriveMetadata; error?: string }> {
  const driveCfg = await getPosterDriveConfig();
  const folderName = getPosterFolderName(
    params.referenceCode,
    driveCfg.useTestSuffix,
  );
  const rootFolderName =
    driveCfg.rootFolderName || getPosterRootFolderName(driveCfg.useTestSuffix);
  const editorEmail = params.leaderEmail.trim().toLowerCase();

  if (!driveCfg.webhookUrl) {
    return {
      ok: false,
      error: "Chưa cấu hình URL Webhook Google Drive Poster.",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(driveCfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPLOAD_POSTER_DIRECT",
        rootFolderName,
        folderName,
        referenceCode: params.referenceCode,
        ideaTitle: params.ideaTitle,
        editorEmail,
        targetFileName: params.targetFileName,
        mimeType: params.mimeType,
        fileBase64: params.fileBuffer.toString("base64"),
      }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error:
          "Apps Script chưa trả về JSON hợp lệ khi lưu tệp Poster trực tiếp.",
      };
    }

    if (!parsed.ok) {
      return {
        ok: false,
        error:
          (typeof parsed.error === "string" && parsed.error) ||
          "Apps Script chưa hỗ trợ hành động UPLOAD_POSTER_DIRECT. Vui lòng dán bản mã Apps Script số 2 mới nhất.",
      };
    }

    const nowIso = new Date().toISOString();
    const uploadedId =
      typeof parsed.uploadedFileId === "string" ? parsed.uploadedFileId : "";
    const parsedFiles = Array.isArray(parsed.files)
      ? (parsed.files as PosterDriveFileItem[])
      : uploadedId
      ? [
          {
            id: uploadedId,
            name: params.targetFileName,
            viewUrl: `https://drive.google.com/file/d/${uploadedId}/view`,
            previewUrl: `https://drive.google.com/file/d/${uploadedId}/preview`,
            updatedAt: nowIso,
          },
        ]
      : [];

    const posterDrive: PosterDriveMetadata = {
      folderId: typeof parsed.folderId === "string" ? parsed.folderId : null,
      folderName:
        typeof parsed.folderName === "string" ? parsed.folderName : folderName,
      rootFolderName,
      folderUrl:
        typeof parsed.folderUrl === "string" ? parsed.folderUrl : null,
      editorEmail,
      posterStatus: "SUBMITTED",
      submittedAt: nowIso,
      leaderNote: params.leaderNote || null,
      files: parsedFiles,
      lastCheckedAt: nowIso,
      driveWarning:
        typeof parsed.warning === "string" ? parsed.warning : null,
    };

    return { ok: true, posterDrive };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Lỗi kết nối Apps Script khi tải lên trực tiếp: ${err.message}`
          : "Không thể kết nối Apps Script khi tải lên trực tiếp.",
    };
  }
}
