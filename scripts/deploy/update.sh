#!/usr/bin/env bash
# Cập nhật phiên bản mới cho UTT Innovation Portal
# Cách chạy: sudo bash scripts/deploy/update.sh
# Thứ tự: sao lưu → git pull → npm ci → migrate → build → khởi động lại
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/config.sh"
trap 'printf "\n\e[31m[LỖI]\e[0m Lệnh ở dòng %s thất bại. Bản đang chạy chưa bị khởi động lại.\n" "$LINENO"' ERR

[[ $EUID -eq 0 ]] || die "Cần chạy bằng sudo"
cd "$APP_DIR"

sec "1. Sao lưu trước khi cập nhật"
bash "$SCRIPT_DIR/backup.sh"

sec "2. Lấy mã nguồn mới"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
OLD=$(as_app git rev-parse --short HEAD)
as_app git pull --ff-only
NEW=$(as_app git rev-parse --short HEAD)
info "Phiên bản: $OLD → $NEW"
chmod +x "$SCRIPT_DIR"/*.sh

sec "3. Cài thư viện, migrate, build"
as_app npm ci --no-audit --no-fund
as_app npm run db:migrate
as_app npm run build

sec "4. Khởi động lại"
install -m 644 "$SCRIPT_DIR/utt-app.service"    /etc/systemd/system/utt-app.service
install -m 644 "$SCRIPT_DIR/utt-worker.service" /etc/systemd/system/utt-worker.service
systemctl daemon-reload
systemctl restart utt-app
wait_healthy && ok "utt-app chạy bình thường ($NEW)" || die "utt-app không khởi động được: journalctl -u utt-app -n 100"
if systemctl is-enabled --quiet utt-worker; then
  systemctl restart utt-worker && ok "Đã khởi động lại utt-worker"
fi
