/**
 * Structured Server Logger
 * Phase 6B — Security & Reliability Hardening
 *
 * Emits JSON-structured logs with automated redaction of sensitive credentials,
 * email masking, and Request ID correlation.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  message: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  ip?: string;
  context?: Record<string, unknown>;
  error?: string;
}

const SENSITIVE_KEY_PATTERN = /password|secret|token|otp|credential|auth|cookie|key/i;

/**
 * Masks an email address for safe log output (e.g. "ch***@utt.edu.vn").
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "***";
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || ""}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Recursively sanitizes an object to redact sensitive keys and mask emails.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Check if string looks like an email
    if (data.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return maskEmail(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }

  return data;
}

class StructuredLogger {
  private formatAndOutput(entry: LogEntry): void {
    const sanitizedContext = entry.context
      ? (sanitizeLogData(entry.context) as Record<string, unknown>)
      : undefined;

    const record: LogEntry = {
      ...entry,
      context: sanitizedContext,
    };

    const jsonString = JSON.stringify(record);

    if (entry.level === "ERROR") {
      console.error(jsonString);
    } else if (entry.level === "WARN") {
      console.warn(jsonString);
    } else {
      console.log(jsonString);
    }
  }

  info(message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>): void {
    this.formatAndOutput({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      ...meta,
    });
  }

  warn(message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>): void {
    this.formatAndOutput({
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
      ...meta,
    });
  }

  error(message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>): void {
    this.formatAndOutput({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message,
      ...meta,
    });
  }

  debug(message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>): void {
    if (process.env.NODE_ENV !== "production") {
      this.formatAndOutput({
        timestamp: new Date().toISOString(),
        level: "DEBUG",
        message,
        ...meta,
      });
    }
  }
}

export const logger = new StructuredLogger();
