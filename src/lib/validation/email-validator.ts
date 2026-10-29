import { z } from "zod";

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Exact domain typo map for popular email providers and UTT academic domains.
 * Enterprise/corporate domains (e.g. @viettel.com.vn, @fpt.com, @congty.vn, @startup.io)
 * are NOT restricted by this map and pass freely unless they have a universal TLD typo (.con, .vnn, etc.).
 */
const EXACT_DOMAIN_TYPO_MAP: Record<string, string> = {
  // Gmail typos
  "gmail.con": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.ocm": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmail.coom": "gmail.com",
  "gmail.comn": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmail.vom": "gmail.com",
  "gmail.xom": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.vn": "gmail.com",
  "gmail.com.vn": "gmail.com",
  "gmail.edu.vn": "gmail.com",
  "gmail.net": "gmail.com",
  "gmail.org": "gmail.com",
  "gmai.com": "gmail.com",
  "gmai.con": "gmail.com",
  "gmai.vn": "gmail.com",
  "gmial.com": "gmail.com",
  "gmial.con": "gmail.com",
  "gamil.com": "gmail.com",
  "gamil.con": "gmail.com",
  "gnail.com": "gmail.com",
  "gnail.con": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmsil.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmil.com": "gmail.com",
  "ggmail.com": "gmail.com",

  // Yahoo / Outlook / Hotmail / iCloud typos
  "yahoo.con": "yahoo.com",
  "yahoo.cmo": "yahoo.com",
  "yahoo.comm": "yahoo.com",
  "yaho.com": "yahoo.com",
  "ymail.con": "ymail.com",
  "outlook.con": "outlook.com",
  "outlook.cmo": "outlook.com",
  "outlook.comm": "outlook.com",
  "outlok.com": "outlook.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cmo": "hotmail.com",
  "hotmail.comm": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "icloud.con": "icloud.com",
  "icloud.cmo": "icloud.com",
  "icloud.comm": "icloud.com",

  // UTT university domain typos
  "utt.edu.con": "utt.edu.vn",
  "utt.edu.vnn": "utt.edu.vn",
  "utt.edu.vm": "utt.edu.vn",
  "utt.edu.vb": "utt.edu.vn",
  "utt.edu.com": "utt.edu.vn",
  "utt.ed.vn": "utt.edu.vn",
  "utt.edu.vn.vn": "utt.edu.vn",
  "st.utt.edu.con": "st.utt.edu.vn",
  "st.utt.edu.vnn": "st.utt.edu.vn",
  "st.utt.edu.vm": "st.utt.edu.vn",
  "st.utt.edu.com": "st.utt.edu.vn",
  "st.utt.ed.vn": "st.utt.edu.vn",
};

/**
 * Universal TLD suffix typos that do not exist as valid TLDs in IANA root zone
 * and indicate a keyboard slip on ANY domain (including enterprise/corporate emails).
 */
const TLD_SUFFIX_TYPO_RULES: Array<{ suffix: string; replacement: string }> = [
  { suffix: ".con.vn", replacement: ".com.vn" },
  { suffix: ".cmo.vn", replacement: ".com.vn" },
  { suffix: ".ocm.vn", replacement: ".com.vn" },
  { suffix: ".comm.vn", replacement: ".com.vn" },
  { suffix: ".edu.con", replacement: ".edu.vn" },
  { suffix: ".edu.vnn", replacement: ".edu.vn" },
  { suffix: ".edu.vm", replacement: ".edu.vn" },
  { suffix: ".com.vnn", replacement: ".com.vn" },
  { suffix: ".com.vm", replacement: ".com.vn" },
  { suffix: ".vn.vn", replacement: ".vn" },
  { suffix: ".com.com", replacement: ".com" },
  { suffix: ".com.con", replacement: ".com" },
  { suffix: ".con", replacement: ".com" },
  { suffix: ".cmo", replacement: ".com" },
  { suffix: ".ocm", replacement: ".com" },
  { suffix: ".comm", replacement: ".com" },
  { suffix: ".coom", replacement: ".com" },
  { suffix: ".comn", replacement: ".com" },
  { suffix: ".cim", replacement: ".com" },
  { suffix: ".vom", replacement: ".com" },
  { suffix: ".xom", replacement: ".com" },
  { suffix: ".vnn", replacement: ".vn" },
  { suffix: ".vnm", replacement: ".vn" },
  { suffix: ".orgg", replacement: ".org" },
  { suffix: ".ogr", replacement: ".org" },
  { suffix: ".nett", replacement: ".net" },
  { suffix: ".nte", replacement: ".net" },
  { suffix: ".eduu", replacement: ".edu" },
];

const STANDARD_EMAIL_SYNTAX_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates an email address with enterprise-friendly rules:
 * - Allows all legitimate corporate, custom, government, and academic domains.
 * - Detects and blocks common provider typos (e.g. @gmail.con, @gmai.com) and universal TLD typos (.con, .vnn, .cmo)
 *   with an actionable suggestion.
 */
export function validateSmartEmail(rawEmail: string): EmailValidationResult {
  const trimmed = (rawEmail || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Vui lòng nhập địa chỉ email." };
  }

  if (trimmed.length > 150) {
    return { valid: false, error: "Email không được vượt quá 150 ký tự." };
  }

  if (/\s/.test(trimmed) || trimmed.includes("..")) {
    return { valid: false, error: "Địa chỉ email không đúng định dạng." };
  }

  const atParts = trimmed.split("@");
  if (atParts.length !== 2) {
    return { valid: false, error: "Địa chỉ email không đúng định dạng." };
  }

  const [localPart, rawDomain] = atParts;
  const domain = rawDomain.toLowerCase();

  if (
    !localPart ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    !domain ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    return { valid: false, error: "Địa chỉ email không đúng định dạng." };
  }

  if (!STANDARD_EMAIL_SYNTAX_REGEX.test(trimmed)) {
    return { valid: false, error: "Địa chỉ email không đúng định dạng." };
  }

  // 1. Check exact typo dictionary for popular providers & UTT domains
  if (EXACT_DOMAIN_TYPO_MAP[domain]) {
    const correctedDomain = EXACT_DOMAIN_TYPO_MAP[domain];
    const suggestion = `${localPart}@${correctedDomain}`;
    return {
      valid: false,
      suggestion,
      error: `Tên miền email "@${domain}" có vẻ bị gõ sai. Ý của bạn có phải là "${suggestion}" không?`,
    };
  }

  // 2. Any "gmail.*" where the TLD is not ".com" (e.g., gmail.anything) is always a typo for gmail.com
  if (domain.startsWith("gmail.") && domain !== "gmail.com") {
    const suggestion = `${localPart}@gmail.com`;
    return {
      valid: false,
      suggestion,
      error: `Địa chỉ Gmail phải có đuôi "@gmail.com" (bạn đang nhập "@${domain}"). Ý của bạn có phải là "${suggestion}" không?`,
    };
  }

  // 3. Universal invalid TLD suffix rules (protects corporate domains too, e.g. ten@congty.con -> ten@congty.com)
  for (const rule of TLD_SUFFIX_TYPO_RULES) {
    if (domain.endsWith(rule.suffix)) {
      const correctedDomain =
        domain.slice(0, domain.length - rule.suffix.length) + rule.replacement;
      const suggestion = `${localPart}@${correctedDomain}`;
      return {
        valid: false,
        suggestion,
        error: `Đuôi tên miền "${rule.suffix}" không tồn tại (có vẻ bị gõ nhầm). Ý của bạn có phải là "${suggestion}" không?`,
      };
    }
  }

  // 4. Verify the final TLD segment is at least 2 alphabetic characters (allows all country & generic TLDs: .vn, .com, .io, .ai, .tech, .company, etc.)
  const domainParts = domain.split(".");
  const lastTld = domainParts[domainParts.length - 1] || "";
  if (lastTld.length < 2 || !/^[a-z]{2,24}$/.test(lastTld)) {
    return {
      valid: false,
      error: "Đuôi tên miền email không hợp lệ.",
    };
  }

  return { valid: true };
}

/**
 * Reusable Zod schema for email validation across all forms and APIs.
 */
export function createSmartEmailSchema(requiredMessage = "Địa chỉ email không hợp lệ") {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(150, "Email không được vượt quá 150 ký tự")
    .superRefine((val, ctx) => {
      const check = validateSmartEmail(val);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.error || requiredMessage,
        });
      }
    });
}
