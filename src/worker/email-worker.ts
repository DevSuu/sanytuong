import { getSafeEmailConfig } from "@/lib/email/config";
import {
  countPendingEmailJobs,
  processPendingEmailJobs,
  recoverStuckEmailJobs,
} from "@/lib/email/queue";
import { createEmailTransport, EmailTransport } from "@/lib/email/transport";
import { logger } from "@/lib/logger";
import { getDb } from "@/lib/db";
import {
  getGoogleSheetsConfig,
  getGoogleSheetsSyncStatus,
  computeDatabaseFingerprint,
  syncAllDataToGoogleSheets,
} from "@/lib/google-sheets/sync-service";

export interface WorkerOptions {
  pollIntervalMs?: number;
  batchSize?: number;
  transport?: EmailTransport;
}

/**
 * Persistent Email Worker Daemon
 * Phase 6B — Reliability & Security Hardening
 *
 * DELIVERY SEMANTICS: AT-LEAST-ONCE DELIVERY
 * -------------------------------------------
 * This worker operates on a transactional outbox table in PostgreSQL.
 * If SMTP dispatch succeeds but the process crashes before updating the
 * database record to SENT, the lock will expire and recoverStuckEmailJobs()
 * will reset the job to PENDING, resulting in a duplicate dispatch.
 * Exactly-once is theoretically impossible across independent non-transactional
 * SMTP services without distributed 2PC.
 */
export class EmailWorker {
  private isRunning = false;
  private isProcessing = false;
  private isSyncingSheets = false;
  private lastSheetsCheckAt = 0;
  private lastTokenCleanupAt = 0;
  private consecutiveErrors = 0;
  private pollIntervalMs: number;
  private batchSize: number;
  private transport: EmailTransport;

  constructor(options: WorkerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 3000;
    this.batchSize = options.batchSize ?? 1;
    this.transport = options.transport ?? createEmailTransport();
  }

  /**
   * Runs a single batch of pending email jobs.
   */
  async runOnce(): Promise<{
    processed: number;
    succeeded: number;
    retried: number;
    failed: number;
  }> {
    return processPendingEmailJobs(this.batchSize, this.transport);
  }

  /**
   * Starts the continuous background polling loop with reconnection resilience.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const safeConfig = getSafeEmailConfig();
    logger.info("Email worker daemon started", {
      context: {
        mode: safeConfig.deliveryMode.toUpperCase(),
        host: safeConfig.host,
        port: safeConfig.port,
        user: safeConfig.user,
        pollIntervalMs: this.pollIntervalMs,
        batchSize: this.batchSize,
        pacing: "ADAPTIVE_PRIORITY_POOL",
        semantics: "AT_LEAST_ONCE",
      },
    });

    // Run startup stuck job recovery (e.g. from prior process crashes)
    try {
      const recovered = await recoverStuckEmailJobs(5 * 60 * 1000);
      if (recovered > 0) {
        logger.info(`Startup recovery: restored ${recovered} stuck email jobs to PENDING`, {
          context: { recoveredCount: recovered },
        });
      }
    } catch (startupErr) {
      logger.warn("Initial stuck job recovery encountered error, will retry in loop", {
        error: startupErr instanceof Error ? startupErr.message : String(startupErr),
      });
    }

    while (this.isRunning) {
      try {
        this.isProcessing = true;
        const result = await this.runOnce();
        this.isProcessing = false;
        this.consecutiveErrors = 0; // Reset error counter on successful cycle

        let sleepTime = this.pollIntervalMs;

        if (result.processed > 0) {
          const remainingQueue = await countPendingEmailJobs();
          if (this.transport.getMode() === "smtp") {
            if (remainingQueue === 0) {
              sleepTime = this.pollIntervalMs;
            } else if (remainingQueue <= 3) {
              sleepTime = 3000; // Fast adaptive pace (3s) when queue is light
            } else {
              sleepTime = 5500; // Steady safe pace (~11 emails/min) when queue is busy
            }
          } else {
            sleepTime = 500;
          }

          logger.info(
            `[EMAIL WORKER BATCH] Processed: ${result.processed} | Succeeded: ${result.succeeded} | Retried: ${result.retried} | Failed: ${result.failed} | RemainingQueue: ${remainingQueue} | NextPaceMs: ${sleepTime}`,
            {
              context: {
                processed: result.processed,
                succeeded: result.succeeded,
                retried: result.retried,
                failed: result.failed,
                remainingQueue,
                nextPaceMs: sleepTime,
              },
            },
          );
        }

        await this.checkAndSyncGoogleSheets();
        await this.cleanupExpiredVerificationTokens();
        await this.sleep(sleepTime);
      } catch (err) {
        this.isProcessing = false;
        this.consecutiveErrors += 1;

        // Exponential backoff for database reconnection during restarts/maintenance
        // 2s -> 4s -> 8s -> max 15s
        const backoffMs = Math.min(15000, 2000 * Math.pow(2, Math.min(this.consecutiveErrors - 1, 3)));

        logger.error(
          `[EMAIL WORKER ERROR] Loop error (attempt ${this.consecutiveErrors}). Reconnecting in ${backoffMs}ms...`,
          {
            error: err instanceof Error ? err.message : String(err),
            context: { consecutiveErrors: this.consecutiveErrors, backoffMs },
          },
        );

        await this.sleep(backoffMs);
      }
    }

    logger.info("Email worker daemon shutdown cleanly", {
      context: { status: "STOPPED" },
    });
  }

  /**
   * Gracefully signals the worker to stop after the current batch finishes.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    let waitCount = 0;
    while (this.isProcessing && waitCount < 30) {
      await this.sleep(200);
      waitCount++;
    }
  }

  private async checkAndSyncGoogleSheets(): Promise<void> {
    const now = Date.now();
    if (this.isSyncingSheets || now - this.lastSheetsCheckAt < 10000) {
      return;
    }
    this.lastSheetsCheckAt = now;

    try {
      const config = await getGoogleSheetsConfig();
      if (!config.enabled || !config.webhookUrl) {
        return;
      }

      const [status, currentFingerprint] = await Promise.all([
        getGoogleSheetsSyncStatus(),
        computeDatabaseFingerprint(),
      ]);

      if (status.lastFingerprint !== currentFingerprint) {
        this.isSyncingSheets = true;
        await syncAllDataToGoogleSheets("AUTO_SYNC_WORKER");
      }
    } catch (err) {
      logger.warn("Google Sheets auto-sync check encountered an error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isSyncingSheets = false;
    }
  }

  /**
   * Periodically purges expired verification / OTP tokens older than 24 hours (unused)
   * or 7 days (all expired) to keep PostgreSQL indexes lean and fast.
   */
  private async cleanupExpiredVerificationTokens(): Promise<void> {
    const now = Date.now();
    // Run once every hour (and once on initial worker startup)
    if (now - this.lastTokenCleanupAt < 60 * 60 * 1000) {
      return;
    }
    this.lastTokenCleanupAt = now;

    try {
      const db = getDb();
      const cutoffDate = new Date(now - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const [deletedEmailTokens, deletedTaskOtps, deletedRecruitmentOtps] =
        await Promise.all([
          db.emailVerificationToken.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffDate }, consumedAt: null },
                { expiresAt: { lt: sevenDaysAgo } },
              ],
            },
          }),
          db.taskApplicationVerification.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffDate }, consumedAt: null },
                { expiresAt: { lt: sevenDaysAgo } },
              ],
            },
          }),
          db.ideaRecruitmentVerification.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffDate }, consumedAt: null },
                { expiresAt: { lt: sevenDaysAgo } },
              ],
            },
          }),
        ]);

      const totalDeleted =
        deletedEmailTokens.count +
        deletedTaskOtps.count +
        deletedRecruitmentOtps.count;

      if (totalDeleted > 0) {
        logger.info(
          `[TOKEN CLEANUP] Purged ${totalDeleted} expired verification/OTP tokens`,
          {
            context: {
              emailVerificationTokens: deletedEmailTokens.count,
              taskApplicationOtps: deletedTaskOtps.count,
              ideaRecruitmentOtps: deletedRecruitmentOtps.count,
            },
          },
        );
      }
    } catch (err) {
      logger.warn("Expired verification token cleanup encountered an error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

