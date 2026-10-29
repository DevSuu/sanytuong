import "dotenv/config";
import { EmailWorker } from "./email-worker";
import { getEmailConfig, validateEmailConfig, getSafeEmailConfig } from "@/lib/email/config";

async function main() {
  const args = process.argv.slice(2);
  const runOnceFlag = args.includes("--once");

  const config = getEmailConfig();
  const safeConfig = getSafeEmailConfig(config);

  console.log("==================================================");
  console.log(" UTT INNOVATION — PERSISTENT EMAIL WORKER (PHASE 2B-1)");
  console.log("==================================================");
  console.log(`- Delivery Mode : ${safeConfig.deliveryMode.toUpperCase()}`);
  console.log(`- SMTP Server   : ${safeConfig.host}:${safeConfig.port} (Secure: ${safeConfig.secure})`);
  console.log(`- SMTP User     : ${safeConfig.user}`);
  console.log(`- Email From    : ${safeConfig.from}`);
  console.log(`- App Password  : ${safeConfig.hasPassword ? "[CONFIGURED]" : "[NOT SET / PLACEHOLDER]"}`);
  console.log("==================================================");

  // If running in SMTP mode, validate configuration strictly
  if (config.deliveryMode === "smtp") {
    const validation = validateEmailConfig(config);
    if (!validation.valid) {
      console.error("\n❌ FATAL: Invalid SMTP Configuration for production/SMTP mode:");
      for (const err of validation.errors) {
        console.error(`   - ${err}`);
      }
      console.error("\nPlease check your .env configuration. Worker exiting.");
      process.exit(1);
    }
  }

  const worker = new EmailWorker({
    pollIntervalMs: 3000,
    batchSize: runOnceFlag ? 10 : 1,
  });

  if (runOnceFlag) {
    console.log("[CLI] Running in one-shot mode (--once)...");
    const result = await worker.runOnce();
    console.log(
      `[CLI] Batch completed: Processed=${result.processed}, Succeeded=${result.succeeded}, Retried=${result.retried}, Failed=${result.failed}`,
    );
    process.exit(0);
  }

  // Handle graceful termination
  const shutdown = async (signal: string) => {
    console.log(`\n[SIGNAL] Received ${signal}. Stopping email worker gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await worker.start();
}

main().catch((err) => {
  console.error("[FATAL] Email worker crashed:", err);
  process.exit(1);
});
