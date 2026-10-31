#!/usr/bin/env bash
# Bật HTTPS cho sanytuong.utt.edu.vn sau khi đã dán chứng chỉ vào:
#   /etc/nginx/ssl/sanytuong.utt.edu.vn/fullchain.pem  (chứng chỉ của tên miền, rồi đến các CA trung gian)
#   /etc/nginx/ssl/sanytuong.utt.edu.vn/privkey.pem    (khóa riêng)
# Cách chạy: sudo bash scripts/deploy/enable-ssl.sh
# Script kiểm tra chứng chỉ trước; nếu nginx báo lỗi sẽ tự quay về cấu hình HTTP cũ.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/config.sh"

[[ $EUID -eq 0 ]] || die "Cần chạy bằng sudo"

sec "1. Kiểm tra chứng chỉ"
[[ -s "$SSL_CERT" ]] || die "File chứng chỉ trống hoặc chưa có: $SSL_CERT"
[[ -s "$SSL_KEY"  ]] || die "File khóa riêng trống hoặc chưa có: $SSL_KEY"
sed -i 's/\r$//' "$SSL_CERT" "$SSL_KEY"   # bỏ ký tự xuống dòng kiểu Windows nếu có

openssl x509 -in "$SSL_CERT" -noout >/dev/null 2>&1 || die "$SSL_CERT không phải chứng chỉ PEM hợp lệ (phải bắt đầu bằng -----BEGIN CERTIFICATE-----)"
openssl pkey -in "$SSL_KEY" -noout >/dev/null 2>&1   || die "$SSL_KEY không phải khóa riêng PEM hợp lệ, hoặc khóa đang có mật khẩu"

CERT_PUB=$(openssl x509 -in "$SSL_CERT" -noout -pubkey | openssl sha256)
KEY_PUB=$(openssl pkey -in "$SSL_KEY" -pubout | openssl sha256)
[[ "$CERT_PUB" == "$KEY_PUB" ]] || die "Khóa riêng KHÔNG khớp với chứng chỉ"
ok "Khóa riêng khớp với chứng chỉ"

info "Chủ thể : $(openssl x509 -in "$SSL_CERT" -noout -subject | sed 's/^subject=//')"
info "Cấp bởi : $(openssl x509 -in "$SSL_CERT" -noout -issuer  | sed 's/^issuer=//')"
info "Hết hạn : $(openssl x509 -in "$SSL_CERT" -noout -enddate | cut -d= -f2)"
openssl x509 -in "$SSL_CERT" -noout -checkend 0 >/dev/null || die "Chứng chỉ đã hết hạn"
openssl x509 -in "$SSL_CERT" -noout -checkend $((30*86400)) >/dev/null || warn "Chứng chỉ sẽ hết hạn trong vòng 30 ngày"

NAMES=$(openssl x509 -in "$SSL_CERT" -noout -text | grep -A1 'Subject Alternative Name' | tail -1 || true)
DOM_RE=$(sed 's/\./\\./g' <<<"$DOMAIN")
WILD_RE='\*\.'$(sed 's/\./\\./g' <<<"${DOMAIN#*.}")
if grep -qE "DNS:(${DOM_RE}|${WILD_RE})(,|$)" <<<"$NAMES"; then
  ok "Chứng chỉ áp dụng cho $DOMAIN"
else
  die "Chứng chỉ không dành cho $DOMAIN (tên trong chứng chỉ: ${NAMES:-không có})"
fi

N=$(grep -c 'BEGIN CERTIFICATE' "$SSL_CERT")
(( N >= 2 )) && ok "Có $N chứng chỉ trong file (gồm chuỗi CA trung gian)" \
             || warn "File chỉ có 1 chứng chỉ, thiếu CA trung gian. Một số trình duyệt/điện thoại có thể báo lỗi, nên nối thêm file CA bundle vào cuối $SSL_CERT"

chmod 644 "$SSL_CERT"; chmod 600 "$SSL_KEY"; chown root:root "$SSL_CERT" "$SSL_KEY"

sec "2. Chuyển nginx sang HTTPS"
BAK=$(mktemp)
[[ -f "$NGINX_SITE" ]] && cp "$NGINX_SITE" "$BAK"
install -m 644 "$SCRIPT_DIR/nginx-proxy-snippet.conf" /etc/nginx/snippets/utt-proxy.conf
install -m 644 "$SCRIPT_DIR/nginx-ssl.conf" "$NGINX_SITE"
ln -sf "$NGINX_SITE" "$NGINX_LINK"
if nginx -t 2>/tmp/utt-nginx-test.log; then
  systemctl reload nginx
  ok "Nginx đã bật HTTPS"
else
  cat /tmp/utt-nginx-test.log
  if [[ -s "$BAK" ]]; then cp "$BAK" "$NGINX_SITE"; else rm -f "$NGINX_LINK"; fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
  die "Nginx báo lỗi, đã quay lại cấu hình cũ."
fi
rm -f "$BAK"

sec "3. Kiểm tra"
sleep 1
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" || true)
[[ "$CODE" == "200" ]] && ok "https://$DOMAIN/api/health trả về 200" \
                       || warn "https://$DOMAIN/api/health trả về '$CODE'. Kiểm tra: systemctl status utt-app"
REDIR=$(curl -s -o /dev/null -w '%{redirect_url}' -m 10 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/" || true)
[[ "$REDIR" == https://* ]] && ok "HTTP tự chuyển sang HTTPS" || warn "HTTP chưa chuyển sang HTTPS"
info ""
info "Xong. Mở https://$DOMAIN và https://$DOMAIN/quan-tri/dang-nhap để kiểm tra."
