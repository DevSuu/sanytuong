#!/usr/bin/env node
/**
 * PostgreSQL Production Backup & Retention Script
 * Phase 6B — Security & Reliability Hardening
 *
 * Backs up PostgreSQL database using pg_dump -Fc (custom compressed binary format)
 * outside of the container volume into backups/postgres/
 * Enforces retention policy: 7 Daily, 4 Weekly, 3 Monthly backups.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load local .env if present
dotenv.config();

const PG_USER = process.env.POSTGRES_USER || "utt";
const PG_DB = process.env.POSTGRES_DB || "utt_innovation";
const BACKUP_DIR = path.resolve(process.cwd(), "backups", "postgres");

function pad(num) {
  return String(num).padStart(2, "0");
}

function getFormattedTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function parseDumpDate(filename) {
  // Format: postgres_YYYY-MM-DD_HH-mm-ss.dump
  const match = filename.match(/postgres_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.dump$/);
  if (!match) return null;
  const [, yyyy, mm, dd, hh, min, ss] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function applyRetentionPolicy(backupDir) {
  console.log("\n[RETENTION] Evaluating backup retention policy (Target: 7 Daily, 4 Weekly, 3 Monthly)...");

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("postgres_") && f.endsWith(".dump"))
    .map((f) => ({
      name: f,
      fullPath: path.join(backupDir, f),
      date: parseDumpDate(f),
    }))
    .filter((f) => f.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first

  if (files.length <= 1) {
    console.log(`[RETENTION] Found ${files.length} backup file(s). No files to prune.`);
    return;
  }

  const keepSet = new Set();

  // Always keep the newest backup
  keepSet.add(files[0].name);

  // 1. Daily tier: keep 1 per day for up to 7 distinct days
  const dailyBuckets = new Map();
  for (const file of files) {
    const dayKey = `${file.date.getFullYear()}-${pad(file.date.getMonth() + 1)}-${pad(file.date.getDate())}`;
    if (!dailyBuckets.has(dayKey) && dailyBuckets.size < 7) {
      dailyBuckets.set(dayKey, file.name);
      keepSet.add(file.name);
    }
  }

  // 2. Weekly tier: keep 1 per week for up to 4 distinct weeks
  const weeklyBuckets = new Map();
  for (const file of files) {
    const weekKey = `${file.date.getFullYear()}-W${getWeekNumber(file.date)}`;
    if (!weeklyBuckets.has(weekKey) && weeklyBuckets.size < 4) {
      weeklyBuckets.set(weekKey, file.name);
      keepSet.add(file.name);
    }
  }

  // 3. Monthly tier: keep 1 per month for up to 3 distinct months
  const monthlyBuckets = new Map();
  for (const file of files) {
    const monthKey = `${file.date.getFullYear()}-${pad(file.date.getMonth() + 1)}`;
    if (!monthlyBuckets.has(monthKey) && monthlyBuckets.size < 3) {
      monthlyBuckets.set(monthKey, file.name);
      keepSet.add(file.name);
    }
  }

  let prunedCount = 0;
  for (const file of files) {
    if (!keepSet.has(file.name)) {
      try {
        fs.unlinkSync(file.fullPath);
        console.log(`[RETENTION] Pruned expired backup: ${file.name}`);
        prunedCount++;
      } catch (err) {
        console.error(`[RETENTION ERROR] Failed to prune ${file.name}:`, err.message);
      }
    }
  }

  console.log(`[RETENTION] Completed. Retained: ${keepSet.size} backup(s) | Pruned: ${prunedCount} backup(s).`);
}

async function main() {
  console.log("==================================================");
  console.log(" UTT INNOVATION — POSTGRESQL PRODUCTION BACKUP");
  console.log("==================================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[INIT] Created backup directory: ${BACKUP_DIR}`);
  }

  const timestamp = getFormattedTimestamp();
  const dumpFilename = `postgres_${timestamp}.dump`;
  const containerTempPath = `/tmp/${dumpFilename}`;
  const localOutputPath = path.join(BACKUP_DIR, dumpFilename);

  console.log(`- Database  : ${PG_DB}`);
  console.log(`- User      : ${PG_USER}`);
  console.log(`- Target File: ${dumpFilename}`);
  console.log(`- Format    : Custom Compressed Binary (-Fc)`);
  console.log("==================================================");

  try {
    console.log(`[STEP 1/3] Generating pg_dump -Fc inside container...`);
    const dumpCmd = `docker compose exec -T postgres pg_dump -U ${PG_USER} -d ${PG_DB} -Fc -f ${containerTempPath}`;
    execSync(dumpCmd, { stdio: "inherit" });

    console.log(`[STEP 2/3] Extracting dump to host filesystem (${localOutputPath})...`);
    const copyCmd = `docker compose cp postgres:${containerTempPath} "${localOutputPath}"`;
    execSync(copyCmd, { stdio: "inherit" });

    console.log(`[STEP 3/3] Cleaning up container temporary dump...`);
    const cleanupCmd = `docker compose exec -T postgres rm -f ${containerTempPath}`;
    execSync(cleanupCmd, { stdio: "inherit" });

    // Verify output file exists and is non-empty
    if (!fs.existsSync(localOutputPath)) {
      throw new Error(`Backup file was not created on host: ${localOutputPath}`);
    }

    const stats = fs.statSync(localOutputPath);
    if (stats.size === 0) {
      throw new Error(`Backup file is empty (0 bytes): ${localOutputPath}`);
    }

    const sizeKb = (stats.size / 1024).toFixed(2);
    console.log(`\n✅ BACKUP SUCCESSFUL!`);
    console.log(`- Path: ${localOutputPath}`);
    console.log(`- Size: ${sizeKb} KB (${stats.size} bytes)`);

    // Run Retention Policy
    applyRetentionPolicy(BACKUP_DIR);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ BACKUP FAILED:`, err.message);
    process.exit(1);
  }
}

main();
