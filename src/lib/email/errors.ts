/**
 * Helper to mask an email address for safe logging.
 * Example: "i4t@utt.edu.vn" -> "i***@utt.edu.vn"
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [local, domain] = parts;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/**
 * Deterministic backoff schedule in milliseconds based on attempt count.
 * attempt 1 -> 1 minute
 * attempt 2 -> 5 minutes
 * attempt 3 -> 15 minutes
 * attempt 4 -> 1 hour
 */
export const RETRY_DELAYS_MS = [
  60 * 1000, // 1 min
  5 * 60 * 1000, // 5 mins
  15 * 60 * 1000, // 15 mins
  60 * 60 * 1000, // 1 hour
];

export function calculateNextAvailableAt(
  attempt: number,
  baseTime: Date = new Date(),
): Date {
  const index = Math.max(0, Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1));
  const delayMs = RETRY_DELAYS_MS[index];
  return new Date(baseTime.getTime() + delayMs);
}

/**
 * Classifies whether an error from sending an email is retryable or permanent.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  const responseCode = (error as { responseCode?: number })?.responseCode;

  // 1. Permanent: Authentication error (Bad password / Invalid credentials)
  if (
    code === "EAUTH" ||
    msg.includes("Invalid login") ||
    msg.includes("Username and Password not accepted") ||
    msg.includes("535") ||
    msg.includes("5.7.8")
  ) {
    return false;
  }

  // 2. Permanent: Invalid recipient syntax / Non-existent mailbox permanent 5xx
  if (
    responseCode &&
    responseCode >= 500 &&
    responseCode < 600 &&
    responseCode !== 535
  ) {
    // 550, 553, 501 are permanent RFC failures
    return false;
  }

  if (
    msg.includes("No recipients defined") ||
    msg.includes("Invalid recipient") ||
    msg.includes("Unsupported EmailJobType")
  ) {
    return false;
  }

  // 3. Retryable: Network connection errors
  const networkCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ESOCKETTIMEDOUT",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "ECONNRESET",
    "EPIPE",
  ];
  if (code && networkCodes.includes(code)) {
    return true;
  }

  // 4. Retryable: SMTP 4xx temporary response codes
  if (responseCode && responseCode >= 400 && responseCode < 500) {
    return true;
  }

  // 5. Retryable: Common transient substrings
  const transientPhrases = [
    "greeting never received",
    "connection closed",
    "timed out",
    "try again later",
    "rate limit",
    "temporary",
  ];
  const lowerMsg = msg.toLowerCase();
  if (transientPhrases.some((p) => lowerMsg.includes(p))) {
    return true;
  }

  // Default: Unknown error with attempts < maxAttempts is treated as retryable
  return true;
}
