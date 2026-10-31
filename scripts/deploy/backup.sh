#!/usr/bin/env bash
# Sao lưu database + .env của UTT Innovation Portal (không Docker)
# Chạy tự động mỗi đêm qua /etc/cron.d/utt-backup, hoặc chạy tay:
#   sudo bash scripts/deploy/backup.sh
# Giữ lại: 7 bản theo ngày, 4 bản theo tuần (Chủ nhật), 6 bản theo tháng (ngày 01)
set -Eeuo pipefail
. "$(dirname "$(readlink -f "$0")")/config.sh"

[[ $EUID -eq 0 ]] || die "Cần chạy bằng sudo"
umask 077
mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
chmod 700 "$BACKUP_DIR"

TS=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/daily/${DB_NAME}_${TS}.dump"

echo "[$(date '+%F %T')] Bắt đầu sao lưu $DB_NAME"
runuser -u postgres -- pg_dump -Fc -d "$DB_NAME" > "$FILE.part"
mv "$FILE.part" "$FILE"
pg_restore --list "$FILE" >/dev/null || die "File sao lưu hỏng: $FILE"
cp "$APP_DIR/.env" "$BACKUP_DIR/daily/env_${TS}" 2>/dev/null || true
echo "  Đã tạo $FILE ($(du -h "$FILE" | cut -f1))"

[[ $(date +%u) == 7 ]] && cp "$FILE" "$BACKUP_DIR/weekly/" && cp "$BACKUP_DIR/daily/env_${TS}" "$BACKUP_DIR/weekly/" 2>/dev/null || true
[[ $(date +%d) == 01 ]] && cp "$FILE" "$BACKUP_DIR/monthly/" && cp "$BACKUP_DIR/daily/env_${TS}" "$BACKUP_DIR/monthly/" 2>/dev/null || true

find "$BACKUP_DIR/daily"   -type f -mtime +7   -delete
find "$BACKUP_DIR/weekly"  -type f -mtime +28  -delete
find "$BACKUP_DIR/monthly" -type f -mtime +186 -delete
echo "[$(date '+%F %T')] Xong. Dung lượng thư mục sao lưu: $(du -sh "$BACKUP_DIR" | cut -f1)"
