import {
  EmailJob,
  EmailJobStatus,
  EmailJobType,
  PrismaClient,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { renderEmail } from "./templates";
import { createEmailTransport, EmailTransport } from "./transport";
import {
  calculateNextAvailableAt,
  isRetryableError,
  maskEmail,
} from "./errors";
import { triggerGoogleSheetsSync } from "@/lib/google-sheets/sync-service";

export interface EnqueueEmailJobParams {
  type: EmailJobType;
  recipient: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  availableAt?: Date;
  maxAttempts?: number;
}

/**
 * Enqueues an email job within a database transaction or client.
 * Part of the Transactional Outbox pattern: business state and email job commit atomically.
 */
export async function enqueueEmailJob(
  client: { emailJob: PrismaClient["emailJob"] },
  params: EnqueueEmailJobParams,
) {
  if (params.idempotencyKey) {
    const existing = await client.emailJob.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  try {
    const created = await client.emailJob.create({
      data: {
        type: params.type,
        recipient: params.recipient.trim().toLowerCase(),
        payload: params.payload as object,
        status: EmailJobStatus.PENDING,
        idempotencyKey: params.idempotencyKey,
        availableAt: params.availableAt ?? new Date(),
        maxAttempts: params.maxAttempts ?? 5,
      },
    });
    triggerGoogleSheetsSync(`EMAIL_ENQUEUED_${params.type}`);
    return created;
  } catch (err: unknown) {
    if (params.idempotencyKey && (err as { code?: string })?.code === "P2002") {
      const existing = await client.emailJob.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
}

/**
 * Classifies email job types into 3 priority tiers:
 * - Tier 1 (Urgent interactive): OTPs, email verification, lookup links
 * - Tier 2 (Operational notices): new task/recruitment application alerts
 * - Tier 3 (Background status notifications): idea approved/rejected/revision, profile & application status updates
 */
export function getEmailJobPriority(type: EmailJobType): 1 | 2 | 3 {
  switch (type) {
    case EmailJobType.VERIFY_EMAIL:
    case EmailJobType.VERIFY_TASK_APPLICATION:
    case EmailJobType.RECRUITMENT_APPLICATION_OTP:
    case EmailJobType.LOOKUP_LINK:
      return 1;
    case EmailJobType.TASK_APPLICATION_SUBMITTED:
    case EmailJobType.RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE:
      return 2;
    default:
      return 3;
  }
}

function sortJobsByPriorityAndCreatedAt(jobs: EmailJob[]): EmailJob[] {
  return [...jobs].sort((a, b) => {
    const priorityDiff = getEmailJobPriority(a.type) - getEmailJobPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return timeA - timeB;
  });
}

/**
 * Counts how many pending email jobs are currently ready for dispatch.
 */
export async function countPendingEmailJobs(client?: PrismaClient): Promise<number> {
  const db = client || getDb();
  return db.emailJob.count({
    where: {
      status: EmailJobStatus.PENDING,
      availableAt: { lte: new Date() },
    },
  });
}

/**
 * Claims a batch of pending email jobs using transaction-safe row locking (FOR UPDATE SKIP LOCKED).
 * Prioritizes interactive OTP/verification emails (Tier 1) ahead of status notifications (Tier 3).
 * Ensures multiple workers can run concurrently without processing the same job twice.
 */
export async function claimPendingEmailJobs(
  limit = 10,
  client?: PrismaClient,
): Promise<EmailJob[]> {
  const db = client || getDb();

  return db.$transaction(async (tx) => {
    try {
      // Native PostgreSQL FOR UPDATE SKIP LOCKED with Priority Tier ordering
      const claimed = await tx.$queryRaw<EmailJob[]>`
        WITH claimable AS (
          SELECT id,
            CASE "type"::text
              WHEN 'VERIFY_EMAIL' THEN 1
              WHEN 'VERIFY_TASK_APPLICATION' THEN 1
              WHEN 'RECRUITMENT_APPLICATION_OTP' THEN 1
              WHEN 'LOOKUP_LINK' THEN 1
              WHEN 'TASK_APPLICATION_SUBMITTED' THEN 2
              WHEN 'RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE' THEN 2
              ELSE 3
            END AS priority_tier
          FROM "email_job"
          WHERE "status" = 'PENDING'::"EmailJobStatus"
            AND "availableAt" <= NOW()
          ORDER BY priority_tier ASC, "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "email_job"
        SET "status" = 'PROCESSING'::"EmailJobStatus",
            "lockedAt" = NOW(),
            "attempts" = "attempts" + 1
        WHERE id IN (SELECT id FROM claimable)
        RETURNING *;
      `;

      return sortJobsByPriorityAndCreatedAt(claimed);
    } catch {
      // Fallback conditional claim for mock/dialect resilience
      const candidateJobs = await tx.emailJob.findMany({
        where: {
          status: EmailJobStatus.PENDING,
          availableAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      const sortedCandidates = sortJobsByPriorityAndCreatedAt(candidateJobs).slice(0, limit);

      const claimedList: EmailJob[] = [];
      for (const candidate of sortedCandidates) {
        const updateRes = await tx.emailJob.updateMany({
          where: {
            id: candidate.id,
            status: EmailJobStatus.PENDING,
          },
          data: {
            status: EmailJobStatus.PROCESSING,
            lockedAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        if (updateRes.count > 0) {
          claimedList.push({
            ...candidate,
            attempts: candidate.attempts + 1,
            status: EmailJobStatus.PROCESSING,
            lockedAt: new Date(),
          });
        }
      }

      return claimedList;
    }
  });
}

/**
 * Recovers stuck jobs where a worker previously crashed or disconnected while processing.
 */
export async function recoverStuckEmailJobs(
  stuckThresholdMs = 10 * 60 * 1000, // 10 minutes
  client?: PrismaClient,
): Promise<number> {
  const db = client || getDb();
  const thresholdTime = new Date(Date.now() - stuckThresholdMs);

  const stuckJobs = await db.emailJob.findMany({
    where: {
      status: EmailJobStatus.PROCESSING,
      lockedAt: { lte: thresholdTime },
    },
  });

  let recoveredCount = 0;

  for (const job of stuckJobs) {
    if (job.attempts >= job.maxAttempts) {
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.FAILED,
          lastError: "Worker timeout: Exceeded max attempts while locked.",
          lockedAt: null,
        },
      });
    } else {
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.PENDING,
          lockedAt: null,
          availableAt: new Date(), // Available immediately for another worker
          lastError: "Recovered from stuck/crashed worker lock.",
        },
      });
      recoveredCount++;
    }
  }

  return recoveredCount;
}

export interface ProcessJobResult {
  jobId: string;
  status: "SENT" | "RETRY" | "FAILED";
  error?: string;
  simulated?: boolean;
  messageId?: string;
  intendedRecipient?: string;
  actualRecipient?: string;
  isRedirected?: boolean;
}

/**
 * Processes a single claimed email job.
 * Renders template, dispatches via transport, handles retry/backoff or permanent failure.
 */
export async function processEmailJob(
  job: EmailJob,
  transport: EmailTransport = createEmailTransport(),
  client?: PrismaClient,
): Promise<ProcessJobResult> {
  const db = client || getDb();
  const masked = maskEmail(job.recipient);

  try {
    // 1. Render template (or use custom payload if provided for test jobs)
    const payload = job.payload as Record<string, unknown>;
    const rendered =
      payload.subject && payload.text && payload.html
        ? {
            subject: String(payload.subject),
            text: String(payload.text),
            html: String(payload.html),
          }
        : renderEmail(job.type, payload);

    // 2. Dispatch via transport
    const dispatchResult = await transport.send({
      to: job.recipient,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      jobId: job.id,
      jobType: job.type,
    });

    // 3. Mark as SENT in database
    await db.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.SENT,
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });

    return {
      jobId: job.id,
      status: "SENT",
      simulated: dispatchResult.simulated,
      messageId: dispatchResult.messageId,
      intendedRecipient: job.recipient,
      actualRecipient: dispatchResult.actualRecipient || job.recipient,
      isRedirected: dispatchResult.isRedirected,
    };
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return {
        jobId: job.id,
        status: "FAILED",
        error: "Job record no longer exists in database.",
      };
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    const retryable = isRetryableError(err);
    const willRetry = retryable && job.attempts < job.maxAttempts;

    console.error(
      `[EMAIL WORKER ERROR] Job: ${job.id} | Type: ${job.type} | To: ${masked} | Attempt: ${job.attempts}/${job.maxAttempts} | Retryable: ${retryable} | Error: ${errorMsg}`,
    );

    try {
      if (willRetry) {
        const nextAvailableAt = calculateNextAvailableAt(job.attempts);
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            status: EmailJobStatus.PENDING,
            availableAt: nextAvailableAt,
            lockedAt: null,
            lastError: `[Attempt ${job.attempts}] ${errorMsg}`,
          },
        });

        return {
          jobId: job.id,
          status: "RETRY",
          error: errorMsg,
        };
      } else {
        // Permanent failure or max attempts exhausted
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            status: EmailJobStatus.FAILED,
            lockedAt: null,
            lastError: `[Permanent Failure] ${errorMsg}`,
          },
        });

        return {
          jobId: job.id,
          status: "FAILED",
          error: errorMsg,
        };
      }
    } catch (updateErr: unknown) {
      if ((updateErr as { code?: string })?.code === "P2025") {
        return {
          jobId: job.id,
          status: "FAILED",
          error: "Job record no longer exists in database.",
        };
      }
      throw updateErr;
    }
  }
}

/**
 * Batch processor for pending email jobs.
 * Used by background worker loops and one-shot triggers.
 * When invoked inline from Next.js API routes without an explicit transport in SMTP mode,
 * it defers dispatch to the dedicated EmailWorker daemon so all SMTP connections stay pooled and paced.
 */
export async function processPendingEmailJobs(
  limit = 10,
  transport?: EmailTransport,
  client?: PrismaClient,
): Promise<{
  processed: number;
  succeeded: number;
  retried: number;
  failed: number;
}> {
  const isInlineRouteTrigger = transport === undefined;
  const resolvedTransport = transport ?? createEmailTransport();
  const isSmtpMode = resolvedTransport.getMode() === "smtp";

  if (isInlineRouteTrigger && isSmtpMode) {
    return {
      processed: 0,
      succeeded: 0,
      retried: 0,
      failed: 0,
    };
  }

  // 1. Recover any stuck jobs from crashed processes
  await recoverStuckEmailJobs(10 * 60 * 1000, client);

  // 2. Claim pending batch with row lock (ordered by priority tier)
  const jobs = await claimPendingEmailJobs(limit, client);

  let succeeded = 0;
  let retried = 0;
  let failed = 0;
  const interEmailDelayMs = jobs.length > 3 ? 5500 : 3000;

  // 3. Process each claimed job
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const result = await processEmailJob(job, resolvedTransport, client);
    if (result.status === "SENT") succeeded++;
    else if (result.status === "RETRY") retried++;
    else failed++;

    // Adaptive pacing between emails in a batch for real SMTP dispatch
    if (isSmtpMode && i < jobs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, interEmailDelayMs));
    }
  }

  return {
    processed: jobs.length,
    succeeded,
    retried,
    failed,
  };
}

