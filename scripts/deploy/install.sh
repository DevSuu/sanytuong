#!/usr/bin/env bash
# ==============================================================
# Cài đặt lần đầu UTT Innovation Portal trên server (không Docker)
#   Tên miền : sanytuong.utt.edu.vn   (xem scripts/deploy/config.sh)
#   Thư mục  : /var/www/html/sanytuong
#
# Cách chạy (mã nguồn đã nằm ở /var/www/html/sanytuong):
#   sudo bash scripts/deploy/install.sh
#   sudo bash scripts/deploy/install.sh /duong-dan/ban-sao-luu.sql   # cài + khôi phục dữ liệu cũ
#
# Chạy lại nhiều lần được: bước nào đã làm sẽ được giữ nguyên.
# ==============================================================
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/config.sh"
trap 'printf "\n\e[31m[LỖI]\e[0m Lệnh ở dòng %s thất bại.\n" "$LINENO"' ERR

RESTORE_FILE="${1:-}"
ENV_FILE="$APP_DIR/.env"

[[ $EUID -eq 0 ]] || die "Cần chạy bằng sudo"
[[ -f "$APP_DIR/package.json" ]] || die "Không thấy mã nguồn tại $APP_DIR"
[[ -z "$RESTORE_FILE" || -f "$RESTORE_FILE" ]] || die "Không thấy file khôi phục: $RESTORE_FILE"
[[ "$(node -v 2>/dev/null)" == v24.* ]] || die "Cần Node 24 (hiện tại: $(node -v 2>/dev/null || echo 'chưa có'))"
runuser -u postgres -- psql -XtAc 'SELECT 1' >/dev/null 2>&1 || die "Không kết nối được PostgreSQL"

# --------------------------------------------------------------
sec "1. User hệ thống '$APP_USER'"
# --------------------------------------------------------------
if id "$APP_USER" >/dev/null 2>&1; then
  ok "Đã có user $APP_USER"
else
  useradd --system --create-home --home-dir /var/lib/$APP_USER --shell /usr/sbin/nologin "$APP_USER"
  ok "Đã tạo user $APP_USER"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" || git config --system --add safe.directory "$APP_DIR"

# --------------------------------------------------------------
sec "2. Database"
# --------------------------------------------------------------
NEW_ENV=0
[[ -f "$ENV_FILE" ]] || NEW_ENV=1
psqlq() { runuser -u postgres -- psql -XtAv ON_ERROR_STOP=1 "$@"; }

if [[ $NEW_ENV == 1 ]]; then
  DB_PASS=$(openssl rand -hex 24)
  if [[ -n "$(psqlq -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" ]]; then
    psqlq -c "ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS'" >/dev/null
    ok "Role $DB_USER đã có, đặt mật khẩu mới (ghi vào .env)"
  else
    psqlq -c "CREATE ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS'" >/dev/null
    ok "Đã tạo role $DB_USER"
  fi
else
  ok "Đã có $ENV_FILE, giữ nguyên mật khẩu database trong đó"
fi
if [[ -z "$(psqlq -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" ]]; then
  runuser -u postgres -- createdb -O "$DB_USER" -E UTF8 -T template0 "$DB_NAME"
  ok "Đã tạo database $DB_NAME"
else
  ok "Đã có database $DB_NAME"
fi

# --------------------------------------------------------------
sec "3. File cấu hình .env"
# --------------------------------------------------------------
set_env() {   # set_env KEY VALUE : thay dòng KEY=... hoặc thêm mới
  local k="$1" v="$2" tmp
  tmp=$(mktemp)
  K="$k" V="$v" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; done=0}
    index($0, k"=")==1 {print k"="v; done=1; next} {print}
    END{if(!done) print k"="v}' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}
get_env() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

if [[ $NEW_ENV == 1 ]]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  set_env POSTGRES_USER "$DB_USER"
  set_env POSTGRES_PASSWORD "$DB_PASS"
  set_env POSTGRES_DB "$DB_NAME"
  set_env DATABASE_URL "postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
  set_env APP_ENV production
  set_env APP_URL "https://$DOMAIN"
  set_env PUBLIC_APP_URL "https://$DOMAIN"
  set_env BETTER_AUTH_URL "https://$DOMAIN"
  set_env BETTER_AUTH_TRUSTED_ORIGINS "https://$DOMAIN"
  set_env BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  set_env LOOKUP_TOKEN_ENCRYPTION_KEY "$(openssl rand -hex 32)"
  set_env EMAIL_DELIVERY_MODE smtp
  set_env EMAIL_REDIRECT_ALL false
  set_env DEV_ADMIN_PASSWORD ""
  ok "Đã tạo $ENV_FILE với khóa bí mật ngẫu nhiên"
  if [[ -n "$RESTORE_FILE" ]]; then
    warn "Bạn đang khôi phục dữ liệu cũ: hãy chép BETTER_AUTH_SECRET và LOOKUP_TOKEN_ENCRYPTION_KEY"
    warn "của server cũ vào $ENV_FILE, nếu không các link tra cứu đã gửi cho sinh viên sẽ mất hiệu lực."
  fi
fi

# SMTP: hỏi nếu còn để giá trị mẫu
SMTP_PW=$(get_env SMTP_PASSWORD || true)
if [[ -z "$SMTP_PW" || "$SMTP_PW" == replace_with* ]]; then
  info "Chưa có mật khẩu ứng dụng Gmail cho $(get_env SMTP_USER). Nhập để bật gửi email (Enter để bỏ qua):"
  read -r -s -p "  App Password: " SMTP_PW </dev/tty || SMTP_PW=""
  echo
  if [[ -n "$SMTP_PW" ]]; then set_env SMTP_PASSWORD "\"$SMTP_PW\""; ok "Đã lưu SMTP_PASSWORD"; fi
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
SMTP_PW=$(get_env SMTP_PASSWORD || true)
SMTP_READY=1
[[ -z "$SMTP_PW" || "$SMTP_PW" == replace_with* ]] && SMTP_READY=0

# --------------------------------------------------------------
sec "4. Khôi phục dữ liệu cũ (nếu có)"
# --------------------------------------------------------------
if [[ -n "$RESTORE_FILE" ]]; then
  HAS_TABLES=$(psqlq -d "$DB_NAME" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  [[ "$HAS_TABLES" == "0" ]] || die "Database $DB_NAME đã có $HAS_TABLES bảng, không khôi phục đè. Xóa database trước nếu thật sự muốn."
  DB_URL=$(get_env DATABASE_URL)
  case "$RESTORE_FILE" in
    *.sql)    PGCLIENTENCODING=UTF8 psql -X -v ON_ERROR_STOP=0 "$DB_URL" -f "$RESTORE_FILE" >/dev/null ;;
    *.sql.gz) gunzip -c "$RESTORE_FILE" | psql -X "$DB_URL" >/dev/null ;;
    *)        pg_restore --no-owner --no-privileges -d "$DB_URL" "$RESTORE_FILE" || true ;;
  esac
  ok "Đã khôi phục từ $RESTORE_FILE"
else
  info "Không khôi phục, cài mới hoàn toàn."
fi

# --------------------------------------------------------------
sec "5. Cài thư viện, migrate, build"
# --------------------------------------------------------------
cd "$APP_DIR"
as_app npm ci --no-audit --no-fund
as_app npm run db:migrate
as_app npm run build
ok "Build xong"

# --------------------------------------------------------------
sec "6. Dịch vụ systemd"
# --------------------------------------------------------------
install -m 644 "$SCRIPT_DIR/utt-app.service"    /etc/systemd/system/utt-app.service
install -m 644 "$SCRIPT_DIR/utt-worker.service" /etc/systemd/system/utt-worker.service
systemctl daemon-reload
systemctl enable utt-app >/dev/null 2>&1
systemctl restart utt-app
if wait_healthy; then ok "utt-app đang chạy, /api/health/ready trả về ready"
else die "utt-app không khởi động được. Xem log: journalctl -u utt-app -n 100"; fi

if [[ $SMTP_READY == 1 ]]; then
  systemctl enable utt-worker >/dev/null 2>&1
  systemctl restart utt-worker
  sleep 5
  systemctl is-active --quiet utt-worker && ok "utt-worker đang chạy" || warn "utt-worker lỗi, xem: journalctl -u utt-worker -n 100"
else
  systemctl disable --now utt-worker >/dev/null 2>&1 || true
  warn "CHƯA bật utt-worker vì thiếu SMTP_PASSWORD: email xác thực/OTP sẽ nằm chờ trong hàng đợi."
  warn "Điền SMTP_PASSWORD trong $ENV_FILE rồi chạy: sudo systemctl enable --now utt-worker"
fi

# --------------------------------------------------------------
sec "7. Nginx"
# --------------------------------------------------------------
install -d -m 755 /etc/nginx/snippets
install -m 644 "$SCRIPT_DIR/nginx-proxy-snippet.conf" /etc/nginx/snippets/utt-proxy.conf

# Tạo sẵn file chứng chỉ trống để dán nội dung sau
install -d -m 755 "$SSL_DIR"
[[ -e "$SSL_CERT" ]] || install -m 644 /dev/null "$SSL_CERT"
[[ -e "$SSL_KEY"  ]] || install -m 600 /dev/null "$SSL_KEY"
ok "File chứng chỉ chờ điền: $SSL_CERT và $SSL_KEY"

DOM_RE=$(sed 's/\./\\./g' <<<"$DOMAIN")
OTHER=$(grep -rlE "server_name[^;]*\b${DOM_RE}\b" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v "^$NGINX_LINK\$" || true)
[[ -n "$OTHER" ]] && warn "File nginx khác cũng khai báo $DOMAIN (sẽ bị trùng): $OTHER"

if [[ -f "$NGINX_SITE" ]] && grep -q 'listen 443' "$NGINX_SITE"; then
  ok "Site đã ở chế độ HTTPS, giữ nguyên"
else
  [[ -f "$NGINX_SITE" ]] && cp "$NGINX_SITE" "$NGINX_SITE.bak"
  install -m 644 "$SCRIPT_DIR/nginx-http.conf" "$NGINX_SITE"
  ln -sf "$NGINX_SITE" "$NGINX_LINK"
  if nginx -t 2>/tmp/utt-nginx-test.log; then
    systemctl reload nginx
    ok "Nginx đã phục vụ http://$DOMAIN"
  else
    cat /tmp/utt-nginx-test.log
    rm -f "$NGINX_LINK"
    [[ -f "$NGINX_SITE.bak" ]] && mv "$NGINX_SITE.bak" "$NGINX_SITE"
    die "Cấu hình nginx lỗi, đã gỡ site mới để không ảnh hưởng các site khác."
  fi
fi
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 'Nginx Full' >/dev/null && ok "ufw cho phép cổng 80/443"
fi

# --------------------------------------------------------------
sec "8. Sao lưu tự động"
# --------------------------------------------------------------
chmod +x "$SCRIPT_DIR"/*.sh
cat > /etc/cron.d/utt-backup <<EOF
# Sao lưu database UTT Innovation Portal lúc 02:30 mỗi ngày
30 2 * * * root $SCRIPT_DIR/backup.sh >> /var/log/utt-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/utt-backup
ok "Đã đặt lịch sao lưu 02:30 hằng ngày vào $BACKUP_DIR"

# --------------------------------------------------------------
sec "Hoàn tất"
# --------------------------------------------------------------
cat <<EOF
  Việc cần làm tiếp:
  1. Tạo tài khoản quản trị:
       cd $APP_DIR && sudo -u $APP_USER ADMIN_USERNAME=admin ADMIN_PASSWORD='<mật-khẩu ≥8 ký tự>' \\
         ADMIN_NAME='Ban Tổ chức UTT' npx tsx scripts/create-admin-users.ts
  2. Dán chứng chỉ SSL vào:
       $SSL_CERT   (chứng chỉ + chuỗi CA trung gian)
       $SSL_KEY    (khóa riêng)
     rồi chạy: sudo bash $SCRIPT_DIR/enable-ssl.sh
  3. Trước khi bật SSL, đăng nhập quản trị và link trong email (https://) CHƯA dùng được.

  Log ứng dụng : journalctl -u utt-app -u utt-worker -f
  Cập nhật code: sudo bash $SCRIPT_DIR/update.sh
EOF
