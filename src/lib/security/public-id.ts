import crypto from "crypto";
import sharp from "sharp";

const SECRET_SEED =
  process.env.BETTER_AUTH_SECRET ||
  process.env.LOOKUP_TOKEN_ENCRYPTION_KEY ||
  "utt-innovation-public-id-hmac-secret-2026";

/**
 * Encodes a numeric internal ID (e.g. 9101, 8101) into a cryptographically signed
 * UUID-formatted string (e.g. "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d").
 * Prevents sequential ID enumeration / scraping while remaining O(1) verifiable.
 */
export function encodePublicId(id: number, namespace: "hl" | "news" = "hl"): string {
  const num = Number(id) & 0xffff;
  const maskHmac = crypto
    .createHmac("sha256", `${SECRET_SEED}:mask:${namespace}`)
    .update("mask")
    .digest();
  const mask16 = maskHmac.readUInt16BE(0);
  const obfuscatedHex = (num ^ mask16).toString(16).padStart(4, "0");

  const sig = crypto
    .createHmac("sha256", `${SECRET_SEED}:sig:${namespace}`)
    .update(String(num))
    .digest("hex");

  // Format as standard 8-4-4-4-12 UUID:
  // [4 hex obfuscated ID + 4 hex sig]-[4 hex sig]-4[3 hex sig]-a[3 hex sig]-[12 hex sig]
  const p1 = `${obfuscatedHex}${sig.slice(0, 4)}`;
  const p2 = sig.slice(4, 8);
  const p3 = `4${sig.slice(8, 11)}`;
  const p4 = `a${sig.slice(11, 14)}`;
  const p5 = sig.slice(14, 26);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * Decodes and verifies a signed UUID-formatted public ID back to its numeric ID.
 * Also accepts raw numeric IDs as fallback for backward compatibility with existing cached links.
 */
export function decodePublicId(
  rawParam: string,
  namespace: "hl" | "news" = "hl"
): number | null {
  const trimmed = (rawParam || "").trim().toLowerCase();

  // Check if standard signed UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(trimmed)) {
    const cleanHex = trimmed.replace(/-/g, "");
    const obfuscated = parseInt(cleanHex.slice(0, 4), 16);

    const maskHmac = crypto
      .createHmac("sha256", `${SECRET_SEED}:mask:${namespace}`)
      .update("mask")
      .digest();
    const mask16 = maskHmac.readUInt16BE(0);
    const candidateId = obfuscated ^ mask16;

    const expectedToken = encodePublicId(candidateId, namespace);
    if (
      expectedToken.length === trimmed.length &&
      crypto.timingSafeEqual(Buffer.from(expectedToken), Buffer.from(trimmed))
    ) {
      return candidateId;
    }
    return null;
  }

  // Fallback for legacy numeric IDs already stored in JSON metadata
  if (/^\d{4,6}$/.test(trimmed)) {
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

interface CachedImageEntry {
  buffer: Uint8Array;
  contentType: string;
}

const IMAGE_CACHE_MAX = 80;
const optimizedImageCache = new Map<string, CachedImageEntry>();

/**
 * Compresses and resizes a Base64 image into WebP format using sharp, with in-memory LRU caching.
 */
export async function optimizeApiImage(
  cacheKeyPrefix: string,
  base64Data: string,
  originalContentType: string,
  requestedWidth?: number | null,
  requestedQuality?: number | null
): Promise<CachedImageEntry> {
  const width = Math.min(Math.max(requestedWidth || 960, 120), 1600);
  const quality = Math.min(Math.max(requestedQuality || 88, 50), 95);
  const cacheKey = `${cacheKeyPrefix}:w${width}:q${quality}:${base64Data.length}`;

  const cached = optimizedImageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inputBuffer = Buffer.from(base64Data, "base64");

  if (originalContentType.includes("svg")) {
    const entry: CachedImageEntry = {
      buffer: new Uint8Array(inputBuffer),
      contentType: originalContentType,
    };
    return entry;
  }

  try {
    const webpBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality })
      .toBuffer();

    const entry: CachedImageEntry = {
      buffer: new Uint8Array(webpBuffer),
      contentType: "image/webp",
    };

    if (optimizedImageCache.size >= IMAGE_CACHE_MAX) {
      const oldestKey = optimizedImageCache.keys().next().value;
      if (oldestKey) optimizedImageCache.delete(oldestKey);
    }
    optimizedImageCache.set(cacheKey, entry);
    return entry;
  } catch {
    return {
      buffer: new Uint8Array(inputBuffer),
      contentType: originalContentType,
    };
  }
}
