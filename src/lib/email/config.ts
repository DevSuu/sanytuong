export type EmailDeliveryMode = "smtp" | "console";

export interface EmailConfig {
  deliveryMode: EmailDeliveryMode;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

const PLACEHOLDER_PATTERNS = [
  /^XXXX-XXXX-XXXX/i,
  /^replace_with/i,
  /^your_password/i,
  /^app_password_here/i,
];

export function isPlaceholder(val?: string | null): boolean {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim();
  if (trimmed === "") return true;
  return PLACEHOLDER_PATTERNS.some((pat) => pat.test(trimmed));
}

/**
 * Parses and returns the email system configuration from environment variables.
 */
export function getEmailConfig(): EmailConfig {
  // Check delivery mode; default to console in local/test or if explicit
  const rawMode = (
    process.env.EMAIL_DELIVERY_MODE ||
    process.env.EMAIL_MODE ||
    (process.env.NODE_ENV === "production" ? "smtp" : "console")
  ).toLowerCase();

  const deliveryMode: EmailDeliveryMode =
    rawMode === "smtp" ? "smtp" : "console";

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "i4t@utt.edu.vn";
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || user || "i4t@utt.edu.vn";

  return {
    deliveryMode,
    host,
    port,
    secure,
    user,
    password,
    from,
  };
}

/**
 * Validates the email configuration strictly.
 * In production or SMTP mode, fails fast if credentials are missing or placeholders.
 */
export function validateEmailConfig(config: EmailConfig = getEmailConfig()): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.deliveryMode === "smtp") {
    if (!config.host || config.host.trim() === "") {
      errors.push("SMTP_HOST must be specified in SMTP mode.");
    }
    if (isNaN(config.port) || config.port <= 0 || config.port > 65535) {
      errors.push("SMTP_PORT must be a valid port number between 1 and 65535.");
    }
    if (!config.user || config.user.trim() === "") {
      errors.push("SMTP_USER must be specified in SMTP mode.");
    }
    if (!config.password || config.password.trim() === "") {
      errors.push("SMTP_PASSWORD is required in SMTP mode.");
    } else if (isPlaceholder(config.password)) {
      errors.push(
        "SMTP_PASSWORD must be a valid Google App Password, not a placeholder.",
      );
    }
    if (!config.from || config.from.trim() === "") {
      errors.push("EMAIL_FROM must be specified in SMTP mode.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Returns safe metadata for observability without leaking passwords.
 */
export function getSafeEmailConfig(config: EmailConfig = getEmailConfig()) {
  return {
    deliveryMode: config.deliveryMode,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    hasPassword: Boolean(config.password && !isPlaceholder(config.password)),
    isRedirectActive: safeCheckRedirectActive(),
    redirectRecipient: safeCheckRedirectActive() ? getTestEmailRecipient() : null,
  };
}

function safeCheckRedirectActive(): boolean {
  try {
    return isEmailRedirectActive();
  } catch {
    return false;
  }
}

/**
 * Returns the configured test email recipient for manual verification and SMTP tests.
 * Defaults to anhvh@utt.edu.vn.
 */
export function getTestEmailRecipient(): string {
  return (
    process.env.EMAIL_TEST_RECIPIENT ||
    process.env.TEST_EMAIL_RECIPIENT ||
    "anhvh@utt.edu.vn"
  ).trim();
}

/**
 * Checks whether an APP_URL represents a local host / loopback environment.
 */
export function isLocalHostUrl(urlStr?: string): boolean {
  if (!urlStr) return true;
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname.endsWith(".local")
    );
  } catch {
    return urlStr.includes("localhost") || urlStr.includes("127.0.0.1");
  }
}

/**
 * Checks whether the environment is genuine production (not local test/dev server).
 */
export function isGenuineProduction(): boolean {
  if (process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return true;
  }
  const isProdNode = process.env.NODE_ENV === "production";
  const isLocal = isLocalHostUrl(process.env.APP_URL);
  // Genuine production requires NODE_ENV=production AND a non-localhost URL
  return isProdNode && !isLocal;
}

/**
 * Determines whether global email redirection is active.
 * Throws EmailConfigError if enabled mistakenly in genuine production (fail-safe).
 */
export function isEmailRedirectActive(): boolean {
  const isProd = isGenuineProduction();
  const redirectFlag = process.env.EMAIL_REDIRECT_ALL === "true";

  if (isProd) {
    if (redirectFlag) {
      throw new EmailConfigError(
        "CRITICAL SAFETY REFUSAL: EMAIL_REDIRECT_ALL cannot be enabled in genuine production environment. Refusing to send to prevent email misdirection.",
      );
    }
    return false;
  }

  // In non-production (local dev, demo, e2e test):
  if (process.env.EMAIL_REDIRECT_ALL === "false") {
    return false;
  }

  if (redirectFlag) return true;

  // Active by default in local/demo/test whenever a test recipient is present
  return Boolean(
    process.env.EMAIL_TEST_RECIPIENT ||
    process.env.TEST_EMAIL_RECIPIENT
  );
}

export interface ActualRecipientResult {
  actualRecipient: string;
  isRedirected: boolean;
  intendedRecipient: string;
}

/**
 * Resolves the actual recipient for outgoing email.
 * Preserves the intended recipient while redirecting all physical delivery in local/test to getTestEmailRecipient().
 */
export function resolveActualRecipient(intendedRecipient: string): ActualRecipientResult {
  const normalizedIntended = intendedRecipient.trim().toLowerCase();
  const redirected = isEmailRedirectActive();

  if (redirected) {
    const testRecipient = getTestEmailRecipient();
    return {
      actualRecipient: testRecipient,
      isRedirected: true,
      intendedRecipient: normalizedIntended,
    };
  }

  return {
    actualRecipient: normalizedIntended,
    isRedirected: false,
    intendedRecipient: normalizedIntended,
  };
}
