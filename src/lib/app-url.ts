/**
 * Resolves the application public base URL.
 * Prefers APP_URL, falls back to PUBLIC_APP_URL, then localhost default.
 */
export function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.PUBLIC_APP_URL;
  if (!url) return "http://localhost:3000";
  // Strip trailing slash if present for consistent URL composition
  return url.replace(/\/+$/, "");
}
