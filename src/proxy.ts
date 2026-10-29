import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  matchEndpointCategory,
} from "@/lib/security/rate-limiter";
import { logger } from "@/lib/logger";

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
const ALLOWED_HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
// Mutating HTTP methods handled via Origin validation below

/**
 * Validates incoming client X-Request-ID or creates a cryptographically secure UUID.
 */
export function resolveRequestId(headerValue: string | null): string {
  if (headerValue && REQUEST_ID_REGEX.test(headerValue)) {
    return headerValue;
  }
  return crypto.randomUUID();
}

/**
 * Resolves the client IP address from Cloudflare Tunnel and proxy headers.
 */
export function resolveClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Checks whether an incoming request carries a Better-Auth session cookie or Authorization header.
 */
function hasAuthenticationCredential(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.trim().length > 10) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (
    cookieHeader.includes("better-auth.session_token=") ||
    cookieHeader.includes("__Secure-better-auth.session_token=")
  ) {
    return true;
  }

  return false;
}

const CSP_HEADER_VALUE =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

function resolveAllowedOrigins(): string[] {
  const raw = [
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    "https://ttst.i4t.pro.vn,http://ttst.i4t.pro.vn,http://localhost:3000,http://127.0.0.1:3000",
  ]
    .filter(Boolean)
    .join(",");

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    )
  );
}

function validateRequestOrigin(request: NextRequest): {
  valid: boolean;
  matchedOrigin: string;
} {
  const origin = request.headers.get("origin");
  const allowedOrigins = resolveAllowedOrigins();
  const defaultOrigin = allowedOrigins[0] || "https://ttst.i4t.pro.vn";

  if (!origin) {
    return { valid: true, matchedOrigin: defaultOrigin };
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;
    const isSameHost = Boolean(host && originHost === host);
    const isTrustedOrigin = allowedOrigins.some((trusted) => {
      try {
        return new URL(trusted).host === originHost;
      } catch {
        return false;
      }
    });

    if (isSameHost || isTrustedOrigin) {
      return { valid: true, matchedOrigin: originUrl.origin };
    }
    return { valid: false, matchedOrigin: defaultOrigin };
  } catch {
    return { valid: false, matchedOrigin: defaultOrigin };
  }
}

/**
 * Attaches standard security and CORS headers to every response passing through the middleware.
 */
function applySecurityHeaders(
  response: NextResponse,
  pathname: string,
  corsOrigin = "https://ttst.i4t.pro.vn"
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Content-Security-Policy", CSP_HEADER_VALUE);

  if (pathname.startsWith("/api/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Access-Control-Allow-Origin", corsOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin, Accept-Encoding");
  }

  return response;
}

export function proxy(request: NextRequest) {
  const start = Date.now();
  const rawRequestId = request.headers.get("x-request-id");
  const requestId = resolveRequestId(rawRequestId);
  const clientIp = resolveClientIp(request);
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // 1. Block disallowed HTTP verbs (TRACE, TRACK, CONNECT, etc.)
  if (!ALLOWED_HTTP_METHODS.has(method)) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Method Not Allowed" },
        { status: 405, headers: { "X-Request-ID": requestId } },
      ),
      pathname,
    );
  }

  // 2. Centralized Access Control & CORS Enforcement for /api/* routes
  const originCheck = validateRequestOrigin(request);
  if (pathname.startsWith("/api/")) {
    // 2a. Strict CORS Origin check across all API requests (including GET/OPTIONS/POST)
    if (!originCheck.valid) {
      logger.warn("Blocked untrusted cross-origin API request", {
        requestId,
        method,
        path: pathname,
        ip: clientIp,
        status: 403,
      });

      return applySecurityHeaders(
        NextResponse.json(
          { ok: false, error: "Forbidden: Nguồn truy cập (Origin) không được phép." },
          { status: 403, headers: { "X-Request-ID": requestId } },
        ),
        pathname,
        originCheck.matchedOrigin,
      );
    }

    if (method === "OPTIONS") {
      return applySecurityHeaders(
        new NextResponse(null, {
          status: 204,
          headers: { "X-Request-ID": requestId },
        }),
        pathname,
        originCheck.matchedOrigin,
      );
    }

    // 2b. Edge Authentication Guard for /api/admin/*
    // Rejects unauthenticated requests before hitting route handlers or PostgreSQL
    if (pathname.startsWith("/api/admin/") && !hasAuthenticationCredential(request)) {
      logger.warn("Blocked unauthenticated request to /api/admin/* at middleware", {
        requestId,
        method,
        path: pathname,
        ip: clientIp,
        status: 401,
      });

      return applySecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            error: "Unauthorized: Yêu cầu xác thực quyền Quản trị viên.",
          },
          {
            status: 401,
            headers: {
              "X-Request-ID": requestId,
              "Cache-Control": "no-store, no-cache, must-revalidate, private",
            },
          },
        ),
        pathname,
        originCheck.matchedOrigin,
      );
    }
  }

  // 3. Endpoint Rate Limiting & Anti-Scraping Protection
  const rateLimitCategory = matchEndpointCategory(pathname, method);
  let rateLimitResult = null;

  if (rateLimitCategory) {
    rateLimitResult = checkRateLimit(rateLimitCategory, clientIp);

    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit exceeded for category: ${rateLimitCategory}`, {
        requestId,
        method,
        path: pathname,
        ip: clientIp,
        status: 429,
        durationMs: Date.now() - start,
      });

      return applySecurityHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Quá nhiều yêu cầu từ địa chỉ của bạn. Vui lòng thử lại sau.",
            retryAfter: rateLimitResult.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimitResult.retryAfterSeconds),
              "X-Request-ID": requestId,
              "X-RateLimit-Limit": String(rateLimitResult.limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(rateLimitResult.resetAt),
            },
          },
        ),
        pathname,
      );
    }
  }

  // 4. Clone headers and forward X-Request-ID upstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-pathname", pathname);

  // 5. Forward request
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 6. Attach observability, rate-limit, and security headers to downstream response
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-pathname", pathname);

  if (rateLimitResult) {
    response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
  }

  return applySecurityHeaders(response, pathname, originCheck.matchedOrigin);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
