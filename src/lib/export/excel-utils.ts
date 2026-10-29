import ExcelJS from "exceljs";

/**
 * Creates a new ExcelJS Workbook with standard application metadata.
 */
export function createStyledWorkbook(title: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cổng Đổi mới Sáng tạo UTT (UTT Innovation Portal)";
  workbook.lastModifiedBy = "Admin UTT";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = title;
  return workbook;
}

/**
 * Formats a date object or ISO string to standard Vietnamese locale format "DD/MM/YYYY HH:mm".
 */
export function formatExcelDate(date?: Date | string | null): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Formats date without time "DD/MM/YYYY".
 */
export function formatExcelDateOnly(date?: Date | string | null): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Styles a header row with UTT theme colors (Navy/Dark Slate with white text or accent).
 */
export function styleHeaderRow(
  row: ExcelJS.Row,
  accentColor: "slate" | "orange" = "slate"
): void {
  row.height = 30;
  const fillColor = accentColor === "orange" ? "FFF25C05" : "FF1E293B";

  row.eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF94A3B8" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
}

/**
 * Styles data rows of a worksheet with consistent typography and borders.
 */
export function styleDataRows(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    row.height = 24;
    const isEven = rowNumber % 2 === 0;

    row.eachCell((cell) => {
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF0F172A" },
      };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      // Keep existing alignment if already set (e.g., center for STT), else default
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle" };
      } else {
        cell.alignment = { ...cell.alignment, vertical: "middle" };
      }
    });
  });
}

/**
 * Automatically calculates and sets readable column widths based on content.
 */
export function autoFitColumns(
  worksheet: ExcelJS.Worksheet,
  minWidth = 12,
  maxWidth = 60
): void {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    if (column.header) {
      maxLen = column.header.toString().length;
    }
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : "";
        if (cellValue.length > maxLen) {
          maxLen = cellValue.length;
        }
      });
    }
    column.width = Math.max(minWidth, Math.min(maxWidth, maxLen + 3));
  });
}

/**
 * Set of characters that can trigger spreadsheet formula execution in Excel/Calc/Sheets.
 * Includes formula prefixes: '=', '+', '-', '@', '\t', '\r', '%'
 */
export const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r", "%"]);

/**
 * Sanitizes untrusted user strings against CSV / Excel Formula Injection (CWE-1236).
 *
 * Rules:
 * - If value is not a string (number, boolean, null, undefined, Date), it is returned untouched.
 * - If value is a string, we strip leading whitespace and control characters to check the first visible char.
 * - If the first visible character is a formula trigger character ('=', '+', '-', '@', '\t', '\r', '%'),
 *   and the string is NOT already escaped with a leading single quote, we prefix with a single quote (').
 * - In Microsoft Excel / LibreOffice / Google Sheets, a leading single quote tells the spreadsheet
 *   parser to treat the cell contents strictly as plain text (label prefix) rather than a formula.
 */
export function sanitizeExcelValue<T>(value: T): T {
  if (typeof value !== "string") {
    return value;
  }

  const str = value;
  // Scan past any leading whitespace or control characters (ASCII 0-32 and Unicode whitespace)
  let i = 0;
  while (i < str.length && (str.charCodeAt(i) <= 32 || /\s/.test(str[i]))) {
    i++;
  }
  const firstNonControlChar = str[i];

  if (firstNonControlChar && FORMULA_TRIGGER_CHARS.has(firstNonControlChar)) {
    // Already safe if it starts with single quote
    if (str.startsWith("'")) {
      return str as unknown as T;
    }
    // Prefix with single quote to force plain text in Excel
    return `'${str}` as unknown as T;
  }

  return value;
}

/**
 * Sanitizes an entire row data object before inserting into an ExcelJS worksheet.
 */
export function sanitizeExcelRow<T extends Record<string, unknown>>(row: T): T {
  const sanitized = { ...row } as Record<string, unknown>;
  for (const [key, val] of Object.entries(sanitized)) {
    sanitized[key] = sanitizeExcelValue(val);
  }
  return sanitized as T;
}

