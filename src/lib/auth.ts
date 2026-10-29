import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";

function getTrustedOrigins(): string[] {
  const origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "https://ttst.i4t.pro.vn",
    "http://ttst.i4t.pro.vn",
    "https://*.i4t.pro.vn",
    "http://*.i4t.pro.vn",
  ];
  for (const urlStr of [
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  ]) {
    if (urlStr) {
      for (const piece of urlStr.split(",")) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        try {
          const origin = new URL(trimmed).origin;
          if (!origins.includes(origin)) {
            origins.push(origin);
          }
        } catch {
          if (!origins.includes(trimmed)) {
            origins.push(trimmed);
          }
        }
      }
    }
  }
  return origins;
}

/**
 * Safely resolves BETTER_AUTH_SECRET with production fail-fast enforcement.
 * In production environments, missing or short (<32 chars) secrets trigger an immediate fatal error.
 */
export function getBetterAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

  if (!secret || secret.trim().length < 32) {
    if (isProduction) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: BETTER_AUTH_SECRET must be configured with at least 32 characters in production.",
      );
    }
    return "dev_insecure_better_auth_secret_minimum_32_characters_only";
  }

  return secret.trim();
}

export const auth = betterAuth({
  database: prismaAdapter(getDb(), {
    provider: "postgresql",
  }),
  advanced: {
    trustedProxyHeaders: true,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // STRICT: No public signup! Admin accounts are created strictly by internal seed/CLI.
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "ADMIN",
        input: false, // Cannot be modified from client payload
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  rateLimit: {
    enabled: false,
  },
  secret: getBetterAuthSecret(),
  baseURL: getAppUrl(),
  trustedOrigins: async (request) => {
    const list = getTrustedOrigins();
    if (request) {
      try {
        const origin = request.headers?.get?.("origin");
        const forwardedHost =
          request.headers?.get?.("x-forwarded-host") ||
          request.headers?.get?.("host");
        if (origin && !list.includes(origin)) {
          const u = new URL(origin);
          if (
            u.hostname === "localhost" ||
            u.hostname === "127.0.0.1" ||
            u.hostname === "0.0.0.0" ||
            u.hostname.endsWith(".i4t.pro.vn") ||
            u.hostname === "i4t.pro.vn" ||
            u.hostname.endsWith(".utt.edu.vn") ||
            u.hostname === "utt.edu.vn" ||
            (forwardedHost && u.host === forwardedHost)
          ) {
            list.push(origin);
          }
        }
      } catch {
        // ignore invalid URL
      }
    }
    return Array.from(new Set(list));
  },
});

/**
 * Server-side session retrieval helper.
 */
export async function getServerSession() {
  try {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    return session;
  } catch {
    return null;
  }
}

/**
 * Server-side authorization helper.
 * Strictly verifies that a session exists AND the user's role is ADMIN.
 */
export async function getAdminSession() {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
