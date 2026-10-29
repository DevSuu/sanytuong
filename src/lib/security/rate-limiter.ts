/**
 * Lightweight In-Memory Sliding Window Rate Limiter
 * Phase 6B — Security & Reliability Hardening
 *
 * Designed to mitigate brute-force and spam on sensitive endpoints
 * without requiring external infrastructure (e.g. Redis).
 */

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  // Admin authentication sign-in attempts: 20 attempts per minute
  auth: { windowMs: 60 * 1000, max: 20 },
  // Public idea submission: 5 submissions per minute
  idea_submit: { windowMs: 60 * 1000, max: 5 },
  // Email verification token check: 15 checks per minute
  email_verify: { windowMs: 60 * 1000, max: 15 },
  // Lookup link request (triggers email): 5 requests per minute
  lookup: { windowMs: 60 * 1000, max: 5 },
  // Task application submission: 5 submissions per minute
  task_apply: { windowMs: 60 * 1000, max: 5 },
  // Task OTP verification (prevents brute-force on 6-digit OTP): 10 attempts per minute
  otp_verify: { windowMs: 60 * 1000, max: 10 },
  // Task OTP resend (prevents email bombardment): 3 requests per minute
  otp_resend: { windowMs: 60 * 1000, max: 3 },
  // Public data listing APIs (anti-scraping protection): 60 requests per minute
  public_data: { windowMs: 60 * 1000, max: 60 },
  // General API fallback: generous 120 requests per minute
  general_api: { windowMs: 60 * 1000, max: 120 },
};

// In-memory token store keyed by `${category}:${ip}`
const store = new Map<string, WindowEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000;

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Matches an incoming request path & method to its sensitive rate limit category.
 * Returns null if the route does not require sensitive rate limiting.
 */
export function matchEndpointCategory(pathname: string, method: string): string | null {
  // Only rate-limit API calls; public static pages, images, and fonts are not rate-limited
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  // Health check endpoints are never rate limited
  if (pathname.startsWith("/api/health")) {
    return null;
  }

  // Admin login authentication attempts (POST /api/auth/sign-in or /api/auth/sign-in/email)
  // Read-only session checks (e.g. GET /api/auth/get-session) are deliberately exempted
  if (pathname.startsWith("/api/auth/sign-in") && method === "POST") {
    return "auth";
  }

  // Idea submission
  if (pathname === "/api/ideas/submit" && method === "POST") {
    return "idea_submit";
  }

  // Email verification token
  if (pathname === "/api/ideas/verify") {
    return "email_verify";
  }

  // Lookup request
  if (pathname === "/api/lookup/request" && method === "POST") {
    return "lookup";
  }

  // Task application apply or Recruitment post apply
  if (
    ((pathname.startsWith("/api/tasks/") || pathname.startsWith("/api/recruitment-posts/")) &&
      pathname.endsWith("/apply")) &&
    method === "POST"
  ) {
    return "task_apply";
  }

  // Task or Recruitment OTP resend
  if (
    ((pathname.includes("/applications/") && pathname.endsWith("/resend-otp")) ||
      (pathname.startsWith("/api/recruitment-posts/") && pathname.endsWith("/resend-otp"))) &&
    method === "POST"
  ) {
    return "otp_resend";
  }

  // Task or Recruitment OTP verification
  if (
    ((pathname.includes("/applications/") && pathname.endsWith("/verify")) ||
      (pathname.startsWith("/api/recruitment-posts/") && pathname.endsWith("/verify-otp"))) &&
    method === "POST"
  ) {
    return "otp_verify";
  }

  // Anti-scraping rate limit on public data endpoints
  if (
    pathname.startsWith("/api/awards") ||
    pathname.startsWith("/api/tasks") ||
    pathname.startsWith("/api/recruitment-posts")
  ) {
    return "public_data";
  }

  // Enforce general rate limiting across all other /api/* routes
  return "general_api";
}

/**
 * Checks and increments rate limit counter for a client IP under a specific category.
 */
export function checkRateLimit(
  category: string,
  clientIp: string,
  now: number = Date.now(),
): RateLimitResult {
  cleanupExpiredEntries(now);

  const config = RATE_LIMIT_RULES[category] ?? RATE_LIMIT_RULES.general_api;
  const key = `${category}:${clientIp.trim()}`;

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  // Existing active window
  if (entry.count < config.max) {
    entry.count += 1;
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - entry.count,
      resetAt: entry.resetAt,
      retryAfterSeconds: 0,
    };
  }

  // Limit exceeded
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: false,
    limit: config.max,
    remaining: 0,
    resetAt: entry.resetAt,
    retryAfterSeconds,
  };
}

/**
 * Per-target (e.g. per-email) rate limiter to prevent distributed proxy/botnet
 * attacks against a single victim's email address or resource.
 */
export function checkTargetRateLimit(
  category: string,
  targetKey: string,
  config: RateLimitConfig = { windowMs: 5 * 60 * 1000, max: 3 },
  now: number = Date.now(),
): RateLimitResult {
  cleanupExpiredEntries(now);

  const key = `target:${category}:${targetKey.trim().toLowerCase()}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count < config.max) {
    entry.count += 1;
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - entry.count,
      resetAt: entry.resetAt,
      retryAfterSeconds: 0,
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: false,
    limit: config.max,
    remaining: 0,
    resetAt: entry.resetAt,
    retryAfterSeconds,
  };
}

/**
 * Resets the in-memory store. Primarily for testing.
 */
export function resetRateLimiter(): void {
  store.clear();
  lastCleanup = Date.now();
}
