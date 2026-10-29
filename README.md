# UTT — Thử thách Sáng tạo 4.0 (Cổng thông tin Đổi mới Sáng tạo)

Hệ thống cổng thông tin trực tuyến phục vụ cuộc thi **Thử thách Sáng tạo 4.0 — Trường Đại học Công nghệ Giao thông vận tải (UTT)**, bao gồm:
- **Cổng thông tin công khai**: Trang chủ & Bảng tin sáng tạo, Gửi ý tưởng & xác thực Email, Tra cứu hồ sơ một liên kết duy nhất (AES-256-GCM), Nộp đề cương dự án, Sảnh nhiệm vụ đặt hàng (OTP xác thực), Hội chợ ý tưởng ghép nhóm liên khoa, và Sảnh giải thưởng — Dấu ấn các mùa.
- **Hệ thống Quản trị (`/quan-tri`)**: Xét duyệt ý tưởng & hồ sơ theo State Machine, quản lý Bảng tin, Dấu ấn mùa giải, Sảnh nhiệm vụ, Hội chợ ý tưởng, xuất báo cáo Excel (`.xlsx`) và đồng bộ tự động Google Sheets.

---

## 1. Kiến trúc & Công nghệ (Tech Stack)

| Thành phần | Công nghệ sử dụng |
| :--- | :--- |
| **Frontend** | React 19.3, Next.js 16.3 (App Router, Hybrid SPA Shell), Tailwind CSS v4, TypeScript 6 |
| **Backend API** | Node.js 24 LTS, Next.js Route Handlers (`/api/*`), Better Auth, Zod, Sharp (WebP LRU Cache), ExcelJS |
| **Background Worker** | Tiến trình độc lập (`src/worker/index.ts`) xử lý hàng đợi gửi Email (Nodemailer SMTP) & đồng bộ Google Sheets |
| **Cơ sở dữ liệu** | PostgreSQL 17 + Prisma ORM v7 (`prisma/schema.prisma`) |

---

## 2. Yêu cầu Máy chủ (Server Prerequisites)

- **Phương án 1 — Triển khai bằng Docker (Khuyến nghị)**:
  - Docker Engine `>= 24.0` & Docker Compose `v2`
- **Phương án 2 — Triển khai trực tiếp trên Host (PM2 / Systemd)**:
  - Node.js `24.x LTS` (`>= 24.0.0 < 25`), `npm >= 11`
  - PostgreSQL `16` hoặc `17`
- **Reverse Proxy phía trước (do bộ phận IT cấu hình)**:
  - Nginx / Caddy / Apache / IIS trỏ về cổng nội bộ `127.0.0.1:3000` (truyền đầy đủ header `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-For`).

---

## 3. Hướng dẫn Triển khai cho Bộ phận IT (Docker Compose)

### Bước 1: Clone mã nguồn và tạo tệp `.env`
```bash
git clone https://github.com/Detsur3012/sanytuong.git
cd sanytuong
cp .env.example .env
```

Chỉnh sửa tệp `.env` với thông số thực tế của máy chủ trường:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Thông tin khởi tạo PostgreSQL.
- `APP_URL`, `PUBLIC_APP_URL`, `BETTER_AUTH_URL`: Điền tên miền chính thức mới (ví dụ: `https://sanytuong.utt.edu.vn`).
- `BETTER_AUTH_TRUSTED_ORIGINS`: Danh sách tên miền tin cậy phân tách bằng dấu phẩy (ví dụ: `https://sanytuong.utt.edu.vn,http://localhost:3000`).
- `BETTER_AUTH_SECRET`: Khóa bí mật ngẫu nhiên tối thiểu 32 ký tự (`openssl rand -hex 32`). *(Lưu ý: Nếu khôi phục dữ liệu từ máy chủ cũ, giữ nguyên `BETTER_AUTH_SECRET` và `LOOKUP_TOKEN_ENCRYPTION_KEY` cũ để các liên kết tra cứu đã cấp cho sinh viên tiếp tục hợp lệ).*
- `EMAIL_DELIVERY_MODE=smtp` cùng `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`: Cấu hình SMTP gửi thư xác thực & OTP.

### Bước 2: Khởi tạo Cơ sở dữ liệu
```bash
# Khởi động container PostgreSQL 17
docker compose up -d postgres

# TH1: Khởi tạo mới hoàn toàn từ Prisma Migrations
docker compose run --rm --build app npx prisma migrate deploy

# TH2: Hoặc khôi phục từ bản sao lưu SQL bàn giao (nếu giữ dữ liệu hiện có)
cat utt_handover_latest.sql | docker compose exec -T postgres psql -U utt -d utt_innovation
```

### Bước 3: Build & Khởi chạy Web App + Background Worker
```bash
docker compose up -d --build
```
Sau khi khởi chạy:
- Dịch vụ `app` (Frontend + Backend API) lắng nghe tại `127.0.0.1:3000`.
- Endpoint kiểm tra sức khỏe hệ thống (Healthcheck): `GET http://127.0.0.1:3000/api/health`.
- Dịch vụ `worker` tự động chạy ngầm xử lý hàng đợi gửi email và đồng bộ Google Sheets.

---

## 4. Khởi tạo / Đổi mật khẩu Tài khoản Quản trị (CLI)

Hệ thống khóa hoàn toàn tính năng tự đăng ký Admin công khai. Để tạo mới hoặc đặt lại mật khẩu Admin trên máy chủ:

```bash
docker compose exec \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="<MatKhauManhTren8KyTu>" \
  -e ADMIN_NAME="Ban Tổ chức UTT" \
  worker npx tsx scripts/create-admin-users.ts
```

Đường dẫn đăng nhập quản trị: `https://<ten-mien-cua-truong>/quan-tri/dang-nhap`

---

## 5. Sao lưu & Khôi phục Dữ liệu Định kỳ

- **Sao lưu**: `./scripts/backup.sh` (tự động nén `pg_dump -Fc` ra thư mục `backups/postgres/` và xoay vòng giữ 7 bản ngày / 4 bản tuần / 3 bản tháng).
- **Kiểm tra / Khôi phục**: `./scripts/restore.sh verify` hoặc `./scripts/restore.sh overwrite <duong-dan-file.dump>`.
