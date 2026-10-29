#!/usr/bin/env bash
# PostgreSQL Production Backup & Retention Script (POSIX Bash)
# Phase 6B — Security & Reliability Hardening
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DUMP_FILE="postgres_${TIMESTAMP}.dump"
CONTAINER_TEMP="/tmp/${DUMP_FILE}"
HOST_TARGET="${BACKUP_DIR}/${DUMP_FILE}"

PG_USER="${POSTGRES_USER:-utt}"
PG_DB="${POSTGRES_DB:-utt_innovation}"

echo "=================================================="
echo " UTT INNOVATION — POSTGRESQL PRODUCTION BACKUP"
echo "=================================================="
echo "- Database  : ${PG_DB}"
echo "- User      : ${PG_USER}"
echo "- Output    : ${HOST_TARGET}"
echo "=================================================="

# 1. Generate pg_dump -Fc inside container
echo "[1/3] Running pg_dump -Fc in PostgreSQL container..."
docker compose exec -T postgres pg_dump -U "${PG_USER}" -d "${PG_DB}" -Fc -f "${CONTAINER_TEMP}"

# 2. Extract dump to host
echo "[2/3] Extracting dump to host..."
docker compose cp "postgres:${CONTAINER_TEMP}" "${HOST_TARGET}"

# 3. Clean container temporary file
echo "[3/3] Removing container temporary file..."
docker compose exec -T postgres rm -f "${CONTAINER_TEMP}"

if [ ! -s "${HOST_TARGET}" ]; then
  echo "❌ ERROR: Backup file is missing or empty: ${HOST_TARGET}" >&2
  exit 1
fi

echo "✅ Backup successfully created at: ${HOST_TARGET}"

# 4. Retention: Node script handles tiered retention
node scripts/backup-db.mjs || true
