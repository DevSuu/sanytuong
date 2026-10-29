#!/usr/bin/env bash
# PostgreSQL Restore & Verification Script (POSIX Bash)
# Phase 6B — Security & Reliability Hardening
set -euo pipefail

MODE="${1:-verify}"
DUMP_FILE="${2:-}"

if [ -z "${DUMP_FILE}" ]; then
  DUMP_FILE=$(ls -t backups/postgres/postgres_*.dump 2>/dev/null | head -n 1 || true)
fi

if [ -z "${DUMP_FILE}" ] || [ ! -f "${DUMP_FILE}" ]; then
  echo "❌ ERROR: No valid dump file found or specified." >&2
  echo "Usage: ./scripts/restore.sh [verify|overwrite] [path/to/file.dump]" >&2
  exit 1
fi

if [ "${MODE}" = "overwrite" ]; then
  read -r -p "⚠️ WARNING: This will overwrite production database! Type 'YES' to confirm: " CONFIRM
  if [ "${CONFIRM}" != "YES" ]; then
    echo "Aborted."
    exit 1
  fi
  node scripts/restore-db.mjs "${DUMP_FILE}" --production-overwrite --confirm
else
  node scripts/restore-db.mjs "${DUMP_FILE}"
fi
