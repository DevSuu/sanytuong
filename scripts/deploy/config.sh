# Cấu hình chung cho các script deploy (được source bởi các script khác)
DOMAIN="sanytuong.utt.edu.vn"
APP_DIR="/var/www/html/sanytuong"
APP_USER="utt_innovation"           # user hệ thống chạy app & worker, sở hữu mã nguồn
APP_PORT="3000"

DB_NAME="utt_innovation"
DB_USER="utt"

SSL_DIR="/etc/nginx/ssl/${DOMAIN}"
SSL_CERT="${SSL_DIR}/fullchain.pem"  # chứng chỉ + chuỗi trung gian (CA bundle)
SSL_KEY="${SSL_DIR}/privkey.pem"     # khóa riêng

NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

BACKUP_DIR="/var/backups/utt"

ok()   { printf "  \e[32m[OK]\e[0m %s\n" "$*"; }
info() { printf "  %s\n" "$*"; }
warn() { printf "  \e[33m[CẢNH BÁO]\e[0m %s\n" "$*"; }
die()  { printf "\n\e[31m[DỪNG]\e[0m %s\n" "$*"; exit 1; }
sec()  { printf "\n\e[1m==== %s ====\e[0m\n" "$*"; }
as_app() { runuser -u "$APP_USER" -- env HOME="$(getent passwd "$APP_USER" | cut -d: -f6)" "$@"; }

wait_healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS -m 3 "http://127.0.0.1:${APP_PORT}/api/health/ready" 2>/dev/null | grep -q '"ready"'; then
      return 0
    fi
    sleep 2
  done
  return 1
}
