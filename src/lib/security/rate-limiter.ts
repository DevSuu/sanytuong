/**
 * Lightweight In-Memory Sliding Window Rate Limiter
 * Phase 6B — Security & Reliability Hardening
 *
 * Designed to mitigate brute-force and spam on sensitive endpoints
 * while safely accommodating university campus Wi-Fi / lecture-hall NAT
 * where hundreds of students share a single public IPv4 address.
 * Individual abuse on form/email endpoints is strictly enforced per-email
 * via checkTargetRateLimit() and per-OTP maxAttempts in PostgreSQL.
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
  // Admin authentication sign-in attempts: 30 attempts per minute per IP
  auth: { windowMs: 60 * 1000, max: 30 },
  // Public idea submission: 120 submissions/min per shared campus NAT IP (per-email remains 5 / 5 min)
  idea_submit: { windowMs: 60 * 1000, max: 120 },
  // Email verification token check: 180 checks/min per shared campus NAT IP
  email_verify: { windowMs: 60 * 1000, max: 180 },
  // Lookup link request: 80 requests/min per shared campus NAT IP (per-email remains strictly capped)
  lookup: { windowMs: 60 * 1000, max: 80 },
  // Task / Recruitment application submission: 80/min per shared IP (per-email remains 5 / 5 min)
  task_apply: { windowMs: 60 * 1000, max: 80 },
  // Task / Recruitment OTP verification: 120/min per shared IP (each OTP locks after maxAttempts in DB)
  otp_verify: { windowMs: 60 * 1000, max: 120 },
  // Task / Recruitment OTP resend: 60/min per shared IP (per-application cooldown enforced in DB)
  otp_resend: { windowMs: 60 * 1000, max: 60 },
  // Public data listing APIs: 1200 requests/min per shared campus NAT IP
  public_data: { windowMs: 60 * 1000, max: 1200 },
  // General API fallback: 1500 requests/min per shared campus NAT IP
  general_api: { windowMs: 60 * 1000, max: 1500 },
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

  // Public binary image endpoints (8-15 images per page view) are exempted like static assets
  if (
    (method === "GET" || method === "HEAD") &&
    pathname.endsWith("/image") &&
    (pathname.startsWith("/api/awards/") ||
      pathname.startsWith("/api/tasks/") ||
      pathname.startsWith("/api/highlights/") ||
      pathname.startsWith("/api/news/"))
  ) {
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
