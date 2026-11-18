/**
 * Pure client-safe constants & helpers for Round 2 Poster web uploads.
 * Must NOT import any server modules so Turbopack client bundles remain pure.
 */

export const ALLOWED_POSTER_EXTENSIONS = [".pdf"] as const;

export const MAX_POSTER_FILE_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

// 768 KiB = 3 * 256 KiB (exact multiple of 256 KiB required by Google Drive Resumable API, and < 1 MB default Nginx limit)
export const POSTER_UPLOAD_CHUNK_SIZE = 3 * 256 * 1024; // 786,432 bytes

export function isValidPosterFileName(
  fileName: string,
  referenceCode: string,
): boolean {
  const cleanRef = (referenceCode || "").trim().toUpperCase();
  if (!cleanRef) return true;
  const cleanName = (fileName || "").trim().toUpperCase();
  if (!cleanName.endsWith(".PDF")) return false;
  if (!cleanName.startsWith(cleanRef)) return false;
  const nextChar = cleanName.charAt(cleanRef.length);
  return (
    nextChar === "." ||
    nextChar === "_" ||
    nextChar === "-" ||
    nextChar === " "
  );
}

export function buildStandardPosterFileName(
  originalFileName: string,
  mimeType: string,
  referenceCode: string,
):
  | { ok: true; targetFileName: string; resolvedMimeType: string; extension: string }
  | { ok: false; error: string } {
  const cleanRef = (referenceCode || "POSTER").trim();
  const trimmedOrig = (originalFileName || "").trim();
  const dotIdx = trimmedOrig.lastIndexOf(".");
  const ext = dotIdx >= 0 ? trimmedOrig.slice(dotIdx).toLowerCase() : "";
  const normalizedMime = (mimeType || "").trim().toLowerCase();

  const isPdf =
    ext === ".pdf" || (!ext && normalizedMime === "application/pdf");

  if (!isPdf) {
    return {
      ok: false,
      error:
        "Chỉ chấp nhận tệp Poster định dạng .PDF. Vui lòng chọn tệp .PDF (tối đa 150 MB).",
    };
  }

  return {
    ok: true,
    targetFileName: `${cleanRef}.pdf`,
    resolvedMimeType: "application/pdf",
    extension: ".pdf",
  };
}

export function formatPosterFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatVietnamDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hh = map.hour === "24" ? "00" : (map.hour || "00");
  return `${hh}:${map.minute || "00"}:${map.second || "00"} ${map.day || "01"}/${map.month || "01"}/${map.year || "1970"}`;
}

export function formatVietnamDate(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return `${map.day || "01"}/${map.month || "01"}/${map.year || "1970"}`;
}
