import crypto from "node:crypto";

/**
 * Normalizes email address according to Phase 2A security requirements:
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. CRITICAL: Never remove dots '.' or plus tags '+alias' (prevent accidental account merging)
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new Error("Invalid email input");
  }
  return email.trim().toLowerCase();
}

/**
 * Generates a cryptographically secure random token (256-bit entropy by default).
 * Never contains PII, studentCode, or predictable timestamp.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * SHA-256 hash for fast, one-way database lookups.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Gets the symmetric key for AES-256-GCM encryption of lookup tokens.
 * Enforces production fail-fast check: in production, LOOKUP_TOKEN_ENCRYPTION_KEY or
 * BETTER_AUTH_SECRET must be configured with at least 32 characters.
 */
export function getEncryptionKey(): Buffer {
  const secret =
    process.env.LOOKUP_TOKEN_ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET;
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

  if (!secret || secret.trim().length < 32) {
    if (isProduction) {
      throw new Error(
        "FATAL SECURITY ERROR: LOOKUP_TOKEN_ENCRYPTION_KEY or BETTER_AUTH_SECRET must be configured with at least 32 characters in production environment.",
      );
    }
    return crypto
      .createHash("sha256")
      .update("dev_insecure_lookup_encryption_key_for_testing_only_32c")
      .digest();
  }

  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Authenticated symmetric encryption (AES-256-GCM) for permanent lookup tokens.
 * Supports optional Additional Authenticated Data (AAD) to bind ciphertext to submitter identity.
 * Output format: v1:iv:ciphertext:tag
 */
export function encryptToken(token: string, aad?: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) {
    cipher.setAAD(Buffer.from(aad, "utf8"));
  }
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Authenticated symmetric decryption (AES-256-GCM) for recovering permanent lookup tokens.
 * Verifies authentication tag and AAD.
 */
export function decryptToken(encryptedString: string, aad?: string): string {
  const parts = encryptedString.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported or corrupted encrypted token format");
  }

  const [, ivHex, ciphertextHex, tagHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  if (aad) {
    decipher.setAAD(Buffer.from(aad, "utf8"));
  }
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Formats an official sequential reference code: TTST-02-XX (e.g. TTST-02-01)
 */
export function formatSequentialReferenceCode(seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  return `TTST-02-${String(safeSeq).padStart(2, "0")}`;
}

/**
 * Generates an official, human-readable reference code: TTST-02-XXXX
 */
export function generateReferenceCode(seq = 1): string {
  return formatSequentialReferenceCode(seq);
}

/**
 * Generates a cryptographically secure numeric OTP (CSPRNG).
 * Never uses Math.random(). Formats with leading zeros (000000–999999).
 */
export function generateOtp(length = 6): string {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, "0");
}

/**
 * SHA-256 hash for secure storage of OTP codes in database.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

/**
 * Constant-time comparison between user input OTP and stored OTP hash.
 */
export function verifyOtpConstantTime(inputOtp: string, expectedHash: string): boolean {
  if (!inputOtp || typeof inputOtp !== "string" || !expectedHash) return false;
  const inputHash = hashOtp(inputOtp);
  const inputBuf = Buffer.from(inputHash, "hex");
  const expectedBuf = Buffer.from(expectedHash, "hex");
  if (inputBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

